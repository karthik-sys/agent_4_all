use super::trait_::ProtocolInterceptor;
use anyhow::{anyhow, Result};
use axum::body::Body;
use axum::http::{Request, Response, StatusCode};
use security_gateway::{PaymentMethodType, Protocol, SecurityContext};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

pub struct MCPInterceptor {
    client: reqwest::Client,
}

impl MCPInterceptor {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

/// MCP Tool Call format (simplified)
#[derive(Debug, Deserialize, Serialize)]
struct MCPToolCall {
    jsonrpc: String,
    method: String,
    params: MCPParams,
    id: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
struct MCPParams {
    name: String,
    arguments: HashMap<String, serde_json::Value>,
}

#[async_trait::async_trait]
impl ProtocolInterceptor for MCPInterceptor {
    fn protocol_name(&self) -> &str {
        "MCP"
    }
    
    fn can_handle(&self, request: &Request<Body>) -> bool {
        // Detect MCP by checking for MCP-specific headers or path
        if let Some(content_type) = request.headers().get("content-type") {
            if content_type.to_str().unwrap_or("").contains("application/json") {
                // Check if path suggests MCP
                let path = request.uri().path();
                return path.contains("/mcp") || path.contains("/tools/call");
            }
        }
        
        // Also check for MCP-specific header
        request.headers().get("x-mcp-version").is_some()
    }
    
    async fn extract_security_context(
        &self,
        request: Request<Body>,
    ) -> Result<SecurityContext> {
        info!("=== MCP Interceptor: Extracting Security Context ===");
        
        // Parse MCP tool call from request body
        let (parts, body) = request.into_parts();
        let bytes = axum::body::to_bytes(body, usize::MAX).await?;
        let mcp_call: MCPToolCall = serde_json::from_slice(&bytes)?;
        
        info!("MCP Tool: {}", mcp_call.params.name);
        
        // Extract payment-related data from arguments
        let args = &mcp_call.params.arguments;
        
        let agent_id = args.get("agent_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing agent_id in MCP call"))?
            .to_string();
        
        let amount = args.get("amount")
            .and_then(|v| v.as_f64());
        
        let merchant_id = args.get("merchant_id")
            .or_else(|| args.get("merchant"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing merchant_id in MCP call"))?
            .to_string();
        
        let nonce = args.get("nonce")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                // Generate nonce if not provided
                uuid::Uuid::new_v4().to_string()
            });
        
        let transaction_id = mcp_call.id
            .as_ref()
            .and_then(|v| v.as_str())
            .unwrap_or(&nonce)
            .to_string();
        
        info!("Agent: {}, Merchant: {}, Amount: {:?}", agent_id, merchant_id, amount);
        
        Ok(SecurityContext {
            agent_id,
            agent_owner: None,
            foundational_model: Some("OpenAI".to_string()), // MCP commonly used by OpenAI
            protocol: Protocol::MCP,
            transaction_id,
            amount,
            currency: "USD".to_string(),
            merchant_id,
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
            payment_method_type: args.get("payment_method")
                .and_then(|v| v.as_str())
                .map(|_| PaymentMethodType::Card),
            payment_token: args.get("payment_method")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            signature: None,
            nonce,
            risk_score: None,
            metadata: args.clone(),
            raw_request: serde_json::to_value(&mcp_call)?,
        })
    }
    
    async fn forward_request(
        &self,
        request: Request<Body>,
        context: &SecurityContext,
    ) -> Result<Response<Body>> {
        info!("=== MCP Interceptor: Forwarding Request ===");
        
        // Forward the original MCP request to the merchant's MCP server
        let merchant_url = format!("https://{}/mcp/tools/call", context.merchant_id);
        
        info!("Forwarding to: {}", merchant_url);
        
        let (parts, body) = request.into_parts();
        let bytes = axum::body::to_bytes(body, usize::MAX).await?;
        
        let response = self.client
            .post(&merchant_url)
            .headers(parts.headers)
            .body(bytes.to_vec())
            .send()
            .await?;
        
        // Convert reqwest response to axum response
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