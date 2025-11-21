use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::models::agent::{Agent, AgentTier};
use rust_decimal::Decimal;

pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn connect() -> Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://agentpay_user:agentpay_dev_password@localhost:5432/agentpay".to_string());
        
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await?;
        
        Ok(Self { pool })
    }
    
    pub async fn get_provider_id_by_name(&self, name: &str) -> Result<Uuid> {
        let row = sqlx::query("SELECT id FROM model_providers WHERE name = $1")
            .bind(name)
            .fetch_one(&self.pool)
            .await?;
        
        Ok(row.get("id"))
    }
    
    pub async fn create_agent(
        &self,
        agent_id: &str,
        provider_id: &Uuid,
        model_version: &str,
        public_key: &str,
        certificate: &str,
        tier: AgentTier,
        daily_limit: Decimal,
        tx_limit: Decimal,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO agents (id, provider_id, model_version, public_key, certificate, tier, spending_limit_daily, spending_limit_per_tx) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
        )
        .bind(agent_id)
        .bind(provider_id)
        .bind(model_version)
        .bind(public_key)
        .bind(certificate)
        .bind(tier.to_string())
        .bind(daily_limit)
        .bind(tx_limit)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn get_agent(&self, agent_id: &str) -> Result<Agent> {
        let row = sqlx::query_as::<_, Agent>(
            "SELECT id, provider_id, model_version, public_key, certificate, tier, 
                    spending_limit_daily, spending_limit_per_tx, status, created_at, expires_at
             FROM agents WHERE id = $1"
        )
        .bind(agent_id)
        .fetch_one(&self.pool)
        .await?;
        
        Ok(row)
    }
    
    pub async fn list_agents(&self) -> Result<Vec<Agent>> {
        let rows = sqlx::query_as::<_, Agent>(
            "SELECT id, provider_id, model_version, public_key, certificate, tier, 
                    spending_limit_daily, spending_limit_per_tx, status, created_at, expires_at
             FROM agents ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(rows)
    }

    pub async fn check_and_store_nonce(&self, agent_id: &str, nonce: &str) -> Result<bool> {
        // Try to insert the nonce
        let result = sqlx::query(
            "INSERT INTO used_nonces (agent_id, nonce) VALUES ($1, $2)
            ON CONFLICT (agent_id, nonce) DO NOTHING
            RETURNING id"
        )
        .bind(agent_id)
        .bind(nonce)
        .fetch_optional(&self.pool)
        .await?;
        
        // If we got a row back, the nonce was new (inserted successfully)
        // If we got None, the nonce already existed (replay attack!)
        Ok(result.is_some())
    }

    pub async fn cleanup_expired_nonces(&self) -> Result<u64> {
        let result = sqlx::query(
            "DELETE FROM used_nonces WHERE expires_at < NOW()"
        )
        .execute(&self.pool)
        .await?;
        
        Ok(result.rows_affected())
    }
}
