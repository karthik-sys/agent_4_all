use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub approved: bool,
    pub reason: Option<String>,
    pub checks: SecurityChecks,
    pub risk_score: f64, // 0-100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityChecks {
    pub agent_exists: bool,
    pub agent_active: bool,
    pub within_per_tx_limit: bool,
    pub within_daily_limit: bool,
    pub within_monthly_limit: bool,
    pub merchant_allowed: bool,
    pub velocity_check_passed: bool,
    pub pattern_normal: bool,
    pub nonce_fresh: bool,
}

impl VerificationResult {
    pub fn declined(reason: String) -> Self {
        Self {
            approved: false,
            reason: Some(reason),
            checks: SecurityChecks::all_failed(),
            risk_score: 100.0,
        }
    }
    
    pub fn approved_with_score(score: f64) -> Self {
        Self {
            approved: true,
            reason: None,
            checks: SecurityChecks::all_passed(),
            risk_score: score,
        }
    }
}

impl SecurityChecks {
    pub fn all_passed() -> Self {
        Self {
            agent_exists: true,
            agent_active: true,
            within_per_tx_limit: true,
            within_daily_limit: true,
            within_monthly_limit: true,
            merchant_allowed: true,
            velocity_check_passed: true,
            pattern_normal: true,
            nonce_fresh: true,
        }
    }
    
    pub fn all_failed() -> Self {
        Self {
            agent_exists: false,
            agent_active: false,
            within_per_tx_limit: false,
            within_daily_limit: false,
            within_monthly_limit: false,
            merchant_allowed: false,
            velocity_check_passed: false,
            pattern_normal: false,
            nonce_fresh: false,
        }
    }
}