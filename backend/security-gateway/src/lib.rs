use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use tracing::{info, warn};

pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub async fn connect() -> Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://agentpay_user:agentpay_dev_password@localhost:5432/agentpay".to_string());
        
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await?;
        
        info!("✅ Database connected");
        Ok(Database { pool })
    }
}

pub struct SecurityGateway {
    db: Database,
}

impl SecurityGateway {
    pub async fn new() -> Result<Self> {
        let db = Database::connect().await?;
        Ok(SecurityGateway { db })
    }

    pub async fn validate_transaction(
        &self,
        agent_id: &str,
        merchant_id: &str,
        amount: f64,
    ) -> Result<ValidationResult> {
        info!("🔍 Validating transaction: agent={}, merchant={}, amount=${}", 
              agent_id, merchant_id, amount);

        // Check if agent exists and is active
        let agent = sqlx::query(
            "SELECT status, spending_limit_daily, spending_limit_per_tx, balance 
             FROM agents WHERE id = $1"
        )
        .bind(agent_id)
        .fetch_optional(&self.db.pool)
        .await?;

        if agent.is_none() {
            warn!("❌ Agent not found: {}", agent_id);
            return Ok(ValidationResult {
                approved: false,
                risk_score: 100.0,
                reason: Some("Agent not found".to_string()),
            });
        }

        let agent = agent.unwrap();
        let status: String = agent.get("status");
        
        if status != "active" {
            warn!("❌ Agent not active: {}", agent_id);
            return Ok(ValidationResult {
                approved: false,
                risk_score: 100.0,
                reason: Some("Agent not active".to_string()),
            });
        }

        // Check balance
        let balance: rust_decimal::Decimal = agent.get("balance");
        let balance_f64: f64 = balance.to_string().parse().unwrap_or(0.0);
        
        if balance_f64 < amount {
            warn!("❌ Insufficient balance: {} < {}", balance_f64, amount);
            return Ok(ValidationResult {
                approved: false,
                risk_score: 90.0,
                reason: Some(format!("Insufficient balance: ${:.2} < ${:.2}", balance_f64, amount)),
            });
        }

        // Check spending limits
        let limit_per_tx: rust_decimal::Decimal = agent.get("spending_limit_per_tx");
        let limit_per_tx_f64: f64 = limit_per_tx.to_string().parse().unwrap_or(100.0);
        
        if amount > limit_per_tx_f64 {
            warn!("❌ Amount exceeds per-transaction limit: {} > {}", amount, limit_per_tx_f64);
            return Ok(ValidationResult {
                approved: false,
                risk_score: 80.0,
                reason: Some(format!("Amount ${:.2} exceeds per-transaction limit ${:.2}", amount, limit_per_tx_f64)),
            });
        }

        // Check if merchant has blocked this agent
        let blocked = sqlx::query(
            "SELECT id FROM merchant_agent_blocks 
             WHERE merchant_id::text = $1 AND agent_id = $2"
        )
        .bind(merchant_id)
        .bind(agent_id)
        .fetch_optional(&self.db.pool)
        .await?;

        if blocked.is_some() {
            warn!("❌ Agent blocked by merchant: {}", agent_id);
            return Ok(ValidationResult {
                approved: false,
                risk_score: 100.0,
                reason: Some("Agent blocked by merchant".to_string()),
            });
        }

        // Calculate risk score based on transaction characteristics
        let mut risk_score: f64 = 0.0;

        // Small transactions are lower risk
        if amount < 50.0 {
            risk_score += 5.0;
        } else if amount < 200.0 {
            risk_score += 10.0;
        } else if amount < 1000.0 {
            risk_score += 20.0;
        } else {
            risk_score += 30.0;
        }

        // Check transaction history (velocity)
        let recent_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM transactions 
             WHERE agent_id = $1 
             AND created_at > NOW() - INTERVAL '1 hour'"
        )
        .bind(agent_id)
        .fetch_one(&self.db.pool)
        .await
        .unwrap_or(0);

        if recent_count > 10 {
            risk_score += 30.0; // High velocity
        } else if recent_count > 5 {
            risk_score += 15.0; // Medium velocity
        } else {
            risk_score += 5.0;  // Low velocity
        }

        // Cap risk score at 40 for normal transactions
        if risk_score > 40.0 {
            risk_score = 40.0;
        }

        info!("✅ Transaction approved: risk_score={:.1}", risk_score);

        Ok(ValidationResult {
            approved: true,
            risk_score,
            reason: None,
        })
    }
}

#[derive(Debug)]
pub struct ValidationResult {
    pub approved: bool,
    pub risk_score: f64,
    pub reason: Option<String>,
}
