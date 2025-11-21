use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unified security context extracted from any protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityContext {
    // Identity
    pub agent_id: String,
    pub agent_owner: Option<String>,
    pub foundational_model: Option<String>, // "OpenAI", "Anthropic", etc.
    pub protocol: Protocol,
    
    // Transaction Details
    pub transaction_id: String,
    pub amount: Option<f64>,
    pub currency: String,
    pub merchant_id: String,
    pub merchant_name: Option<String>,
    
    // Metadata
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    
    // Payment
    pub payment_method_type: Option<PaymentMethodType>,
    pub payment_token: Option<String>,
    
    // Security
    pub signature: Option<String>,
    pub nonce: String,
    pub risk_score: Option<f64>,
    
    // Protocol-Specific Raw Data
    pub metadata: HashMap<String, serde_json::Value>,
    pub raw_request: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Protocol {
    MCP,
    ACP,
    Custom(String),
}

impl std::fmt::Display for Protocol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Protocol::MCP => write!(f, "MCP"),
            Protocol::ACP => write!(f, "ACP"),
            Protocol::Custom(name) => write!(f, "{}", name),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PaymentMethodType {
    Card,
    SharedPaymentToken,
    NetworkToken,
    BankTransfer,
    Crypto,
}