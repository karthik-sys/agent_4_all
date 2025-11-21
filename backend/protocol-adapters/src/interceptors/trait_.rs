use anyhow::Result;
use axum::http::{Request, Response};
use axum::body::Body;
use security_gateway::SecurityContext;

/// Trait that all protocol interceptors must implement
#[async_trait::async_trait]  // This is correct
pub trait ProtocolInterceptor: Send + Sync {
    /// Name of the protocol
    fn protocol_name(&self) -> &str;
    
    /// Check if this interceptor can handle the request
    fn can_handle(&self, request: &Request<Body>) -> bool;
    
    /// Extract security context from the request
    async fn extract_security_context(
        &self,
        request: Request<Body>,
    ) -> Result<SecurityContext>;
    
    /// Forward the request to the merchant/service
    async fn forward_request(
        &self,
        request: Request<Body>,
        context: &SecurityContext,
    ) -> Result<Response<Body>>;
}