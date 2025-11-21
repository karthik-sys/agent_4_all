use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::str::FromStr;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar")]
pub enum AgentTier {
    #[sqlx(rename = "bronze")]
    Bronze,
    #[sqlx(rename = "silver")]
    Silver,
    #[sqlx(rename = "gold")]
    Gold,
    #[sqlx(rename = "platinum")]
    Platinum,
    #[sqlx(rename = "diamond")]
    Diamond,
}

impl ToString for AgentTier {
    fn to_string(&self) -> String {
        match self {
            AgentTier::Bronze => "bronze".to_string(),
            AgentTier::Silver => "silver".to_string(),
            AgentTier::Gold => "gold".to_string(),
            AgentTier::Platinum => "platinum".to_string(),
            AgentTier::Diamond => "diamond".to_string(),
        }
    }
}

impl FromStr for AgentTier {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "bronze" => Ok(AgentTier::Bronze),
            "silver" => Ok(AgentTier::Silver),
            "gold" => Ok(AgentTier::Gold),
            "platinum" => Ok(AgentTier::Platinum),
            "diamond" => Ok(AgentTier::Diamond),
            _ => Err(anyhow::anyhow!("Invalid tier: {}", s)),
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub provider_id: Uuid,
    pub model_version: String,
    pub public_key: String,
    pub certificate: String,
    pub tier: AgentTier,
    pub spending_limit_daily: Decimal,
    pub spending_limit_per_tx: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}