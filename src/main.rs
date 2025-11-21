use axum::{
    body::Body,
    extract::State,
    http::{Request, Response, StatusCode},
    middleware::{self, Next},
    routing::{delete, get, post, put},
    Router,
};
use security_gateway::{Database, SecurityGateway};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{error, info};

mod handlers;
mod interceptors;
mod api;

use interceptors::{ACPInterceptor, MCPInterceptor, ProtocolInterceptor};

// Combined state for the whole app
struct AppState {
    gateway: Arc<SecurityGateway>,
    interceptors: Vec<Arc<dyn ProtocolInterceptor>>,
    db: Arc<Database>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    
    info!("🚀 Starting Protocol Adapters Service with API...");
    
    let gateway = Arc::new(SecurityGateway::new().await?);
    let db = Arc::new(Database::connect().await?);
    
    let interceptors: Vec<Arc<dyn ProtocolInterceptor>> = vec![
        Arc::new(MCPInterceptor::new()),
        Arc::new(ACPInterceptor::new()),
    ];
    
    let state = Arc::new(AppState {
        gateway,
        interceptors,
        db,
    });
    
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/agents/register", post(api::register_agent))
        .route("/api/v1/agents", get(api::list_agents))
        .route("/api/v1/agents/:id", get(api::get_agent))
        .route("/api/v1/agents/:id", delete(api::delete_agent))
        .route("/api/v1/agents/:id/transactions", get(api::get_agent_transactions))
        .route("/api/v1/agents/:id/limits", put(api::update_agent_limits))
        .route("/acp/openai/process", post(handlers::process_openai_payment))
        .layer(middleware::from_fn_with_state(state.clone(), request_logger))
        .with_state(state);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    info!("✅ Server listening on {}", addr);
    info!("✅ API: http://localhost:8081/api/v1");
    info!("✅ Health: http://localhost:8081/health");
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> &'static str {
    "Protocol Adapters Service with API is running"
}

async fn request_logger(
    State(state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response<Body>, StatusCode> {
    let path = request.uri().path();
    let method = request.method();
    
    info!("📨 {} {}", method, path);
    
    // API routes need auth
    if path.starts_with("/api/v1") {
        let api_key = request.headers()
            .get("x-api-key")
            .and_then(|v| v.to_str().ok());
        
        if api_key != Some("dev_api_key_12345") {
            info!("❌ Unauthorized - missing or invalid API key");
            return Err(StatusCode::UNAUTHORIZED);
        }
        info!("✅ API key validated");
    }
    
    Ok(next.run(request).await)
}

fn reconstruct_request(context: &security_gateway::SecurityContext) -> Result<Request<Body>, StatusCode> {
    let body = serde_json::to_vec(&context.raw_request)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let request = Request::builder()
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(request)
}