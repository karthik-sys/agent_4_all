use crate::models::*;
use anyhow::Result;
use chrono::{Duration, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;

pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn connect() -> Result<Self> {
        dotenv::dotenv().ok();
        let database_url = std::env::var("DATABASE_URL")?;
        let pool = PgPool::connect(&database_url).await?;
        Ok(Self { pool })
    }
    
    pub async fn get_agent(&self, agent_id: &str) -> Result<Agent> {
        let agent = sqlx::query_as::<_, Agent>(
            "SELECT * FROM agents WHERE id = $1"
        )
        .bind(agent_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(agent)
    }
    
    pub async fn check_and_store_nonce(&self, agent_id: &str, nonce: &str) -> Result<bool> {
        let result = sqlx::query(
            "INSERT INTO nonces (agent_id, nonce) VALUES ($1, $2)"
        )
        .bind(agent_id)
        .bind(nonce)
        .execute(&self.pool)
        .await;
        
        Ok(result.is_ok())
    }
    
    pub async fn get_daily_spending(&self, agent_id: &str) -> Result<f64> {
        let start_of_day = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        
        let row: Option<(Option<Decimal>,)> = sqlx::query_as(
            "SELECT SUM(amount) FROM transactions 
             WHERE agent_id = $1 
             AND created_at >= $2 
             AND status = 'completed'"
        )
        .bind(agent_id)
        .bind(start_of_day)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(row.and_then(|(sum,)| sum).map(|d| d.to_string().parse().unwrap_or(0.0)).unwrap_or(0.0))
    }
    
    pub async fn count_recent_transactions(&self, agent_id: &str, seconds: i64) -> Result<i64> {
        let cutoff = Utc::now() - Duration::seconds(seconds);
        
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM transactions 
             WHERE agent_id = $1 
             AND created_at >= $2"
        )
        .bind(agent_id)
        .bind(cutoff)
        .fetch_one(&self.pool)
        .await?;
        
        Ok(row.0)
    }
    
    pub async fn log_transaction(&self, ctx: &SecurityContext, verification: &VerificationResult) -> Result<()> {
        sqlx::query(
            "INSERT INTO transactions (
                agent_id, merchant_id, protocol, amount, currency, 
                status, nonce, risk_score, raw_request, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
        )
        .bind(&ctx.agent_id)
        .bind(&ctx.merchant_id)
        .bind(ctx.protocol.to_string())
        .bind(ctx.amount.map(Decimal::from_f64_retain).flatten())
        .bind(&ctx.currency)
        .bind(if verification.approved { "completed" } else { "declined" })
        .bind(&ctx.nonce)
        .bind(verification.risk_score as i32)
        .bind(&ctx.raw_request)
        .bind(ctx.timestamp)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
}

// Agent model from database
#[derive(Debug, sqlx::FromRow)]
pub struct Agent {
    pub id: String,
    pub owner_company: String,
    pub owner_email: String,
    pub protocol: String,
    pub spending_limit_per_tx: Decimal,
    pub spending_limit_daily: Decimal,
    pub status: String,
}