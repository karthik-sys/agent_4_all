use super::trait_::ProtocolInterceptor;
use anyhow::{anyhow, Result};
use axum::body::Body;
use axum::http::{Request, Response};
use security_gateway::{PaymentMethodType, Protocol, SecurityContext};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info};

pub struct ACPInterceptor {
    client: reqwest::Client,
}

impl ACPInterceptor {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

/// ACP Checkout Request (simplified)
#[derive(Debug, Deserialize, Serialize)]
struct ACPCheckoutRequest {
    agent_id: String,
    items: Vec<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    shared_payment_token: Option<String>,
}

#[async_trait::async_trait]
impl ProtocolInterceptor for ACPInterceptor {
    fn protocol_name(&self) -> &str {
        "ACP"
    }
    
    fn can_handle(&self, request: &Request<Body>) -> bool {
        // Detect ACP by checking path
        let path = request.uri().path();
        path.contains("/acp/checkout") || path.contains("/checkout")
    }
    
    async fn extract_security_context(
        &self,
        request: Request<Body>,
    ) -> Result<SecurityContext> {
        info!("=== ACP Interceptor: Extracting Security Context ===");
        
        let uri = request.uri().clone();
        let path = uri.path();
        
        // Parse ACP request
        let (parts, body) = request.into_parts();
        let bytes = axum::body::to_bytes(body, usize::MAX).await?;
        let acp_request: ACPCheckoutRequest = serde_json::from_slice(&bytes)?;
        
        info!("ACP Agent: {}", acp_request.agent_id);
        
        // Determine operation from path
        let is_complete = path.contains("/complete");
        
        let nonce = uuid::Uuid::new_v4().to_string();
        let transaction_id = nonce.clone();
        
        Ok(SecurityContext {
            agent_id: acp_request.agent_id.clone(),
            agent_owner: None,
            foundational_model: Some("OpenAI".to_string()), // ACP created by OpenAI
            protocol: Protocol::ACP,
            transaction_id,
            amount: acp_request.total,
            currency: "USD".to_string(),
            merchant_id: extract_merchant_from_path(path)?,
            merchant_name: None,
            timestamp: Utc::now(),
            user_id: None,
            session_id: None,
            ip_address: parts.headers.get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            user_agent: parts.headers.get("user-agent")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            payment_method_type: if is_complete {
                Some(PaymentMethodType::SharedPaymentToken)
            } else {
                None
            },
            payment_token: acp_request.shared_payment_token.clone(),
            signature: None,
            nonce,
            risk_score: None,
            metadata: HashMap::new(),
            raw_request: serde_json::to_value(&acp_request)?,
        })
    }
    
    async fn forward_request(
        &self,
        request: Request<Body>,
        context: &SecurityContext,
    ) -> Result<Response<Body>> {
        info!("=== ACP Interceptor: Forwarding Request ===");
        
        // Forward to merchant's ACP endpoint
        let merchant_url = format!("https://{}{}", context.merchant_id, request.uri().path());
        
        info!("Forwarding to: {}", merchant_url);
        
        let (parts, body) = request.into_parts();
        let bytes = axum::body::to_bytes(body, usize::MAX).await?;
        
        let response = self.client
            .request(parts.method, &merchant_url)
            .headers(parts.headers)
            .body(bytes.to_vec())
            .send()
            .await?;
        
        // Convert to axum response
        let status = response.status();
        let headers = response.headers().clone();
        let body_bytes = response.bytes().await?;
        
        let mut builder = Response::builder().status(status);
        for (key, value) in headers.iter() {
            builder = builder.header(key, value);
        }
        
        Ok(builder.body(Body::from(body_bytes))?)
    }
}

fn extract_merchant_from_path(path: &str) -> Result<String> {
    // Extract merchant from path like /acp/{merchant_id}/checkout
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() >= 3 && parts[1] == "acp" {
        Ok(parts[2].to_string())
    } else {
        Err(anyhow!("Could not extract merchant from path: {}", path))
    }
}