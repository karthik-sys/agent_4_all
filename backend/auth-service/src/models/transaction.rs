use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRequest {
    pub agent_id: String,
    pub merchant_id: String,
    pub amount: f64,
    pub currency: String,
    pub nonce: String,
    pub timestamp: DateTime<Utc>,
}

impl TransactionRequest {
    /// Create canonical message for signing
    /// This MUST match exactly between signing and verification
    pub fn to_canonical_message(&self) -> String {
        format!(
            "{}|{}|{:.2}|{}|{}|{}",
            self.agent_id,
            self.merchant_id,
            self.amount,
            self.currency,
            self.nonce,
            self.timestamp.to_rfc3339()
        )
    }
}