use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyRequest {
    pub agent_id: String,
    pub merchant_id: String,
    pub amount: f64,
    pub currency: String,
    pub nonce: String,
    pub timestamp: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyResponse {
    pub authenticated: bool,
    pub agent_id: String,
    pub authorized: bool,
    pub checks: AuthorizationChecks,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthorizationChecks {
    pub signature_valid: bool,
    pub nonce_fresh: bool,
    pub within_spending_limit: bool,
    pub agent_active: bool,
    pub certificate_valid: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentResponse {
    pub id: String,
    pub provider_id: String,
    pub model_version: String,
    pub tier: String,
    pub status: String,
    pub spending_limit_daily: f64,
    pub spending_limit_per_tx: f64,
    pub created_at: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}