use axum::{
    body::Body,
    extract::State,
    http::{Request, Response, StatusCode},
    middleware::{self, Next},
    routing::{get, post},
    Router,
};
use security_gateway::SecurityGateway;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{error, info};

mod handlers;
mod interceptors;

use interceptors::{ACPInterceptor, MCPInterceptor, ProtocolInterceptor};

struct AppState {
    gateway: Arc<SecurityGateway>,
    interceptors: Vec<Arc<dyn ProtocolInterceptor>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    info!("Starting Protocol Adapters Service with Interceptors...");
    
    // Initialize security gateway
    let gateway = Arc::new(SecurityGateway::new().await?);
    
    // Register interceptors
    let interceptors: Vec<Arc<dyn ProtocolInterceptor>> = vec![
        Arc::new(MCPInterceptor::new()),
        Arc::new(ACPInterceptor::new()),
    ];
    
    let state = Arc::new(AppState {
        gateway,
        interceptors,
    });
    
    let app = Router::new()
        .route("/health", get(health_check))
        // Legacy OpenAI handler (keep for backwards compatibility)
        .route("/acp/openai/process", post(handlers::process_openai_payment))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            security_middleware,
        ))
        .with_state(state);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    info!("Protocol adapters listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> &'static str {
    "Protocol Adapters Service with Interceptors is running"
}

async fn security_middleware(
    State(state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response<Body>, StatusCode> {
    // Skip security for health check
    if request.uri().path() == "/health" {
        return Ok(next.run(request).await);
    }
    
    // Try to find matching interceptor
    let mut matched_interceptor: Option<Arc<dyn ProtocolInterceptor>> = None;
    for interceptor in &state.interceptors {
        if interceptor.can_handle(&request) {
            info!("Request matched {} interceptor", interceptor.protocol_name());
            matched_interceptor = Some(interceptor.clone());
            break;
        }
    }
    
    if let Some(interceptor) = matched_interceptor {
        // Extract security context (consumes request)
        let context = match interceptor.extract_security_context(request).await {
            Ok(ctx) => ctx,
            Err(e) => {
                error!("Failed to extract security context: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        };
        
        // Verify through security gateway
        let verification = match state.gateway.verify(&context).await {
            Ok(v) => v,
            Err(e) => {
                error!("Security verification error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        };
        
        if !verification.approved {
            info!("Transaction DECLINED: {}", verification.reason.as_deref().unwrap_or("Unknown"));
            
            // Log the declined transaction
            let _ = state.gateway.log_transaction(&context, &verification).await;
            
            return Err(StatusCode::FORBIDDEN);
        }
        
        info!("Transaction APPROVED (risk score: {:.1})", verification.risk_score);
        
        // Reconstruct request from context for forwarding
        let reconstructed_request = reconstruct_request(&context)?;
        
        // Forward request to merchant
        let response = match interceptor.forward_request(reconstructed_request, &context).await {
            Ok(resp) => resp,
            Err(e) => {
                error!("Failed to forward request: {}", e);
                return Err(StatusCode::BAD_GATEWAY);
            }
        };
        
        // Log successful transaction
        let _ = state.gateway.log_transaction(&context, &verification).await;
        
        return Ok(response);
    }
    
    // No interceptor matched, pass through
    Ok(next.run(request).await)
}

fn reconstruct_request(context: &security_gateway::SecurityContext) -> Result<Request<Body>, StatusCode> {
    // Reconstruct request from raw_request stored in context
    let body = serde_json::to_vec(&context.raw_request)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let request = Request::builder()
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(request)
}