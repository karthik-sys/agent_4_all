use axum::{
    extract::State,
    http::StatusCode,
    middleware::{self, Next},
    routing::{delete, get, post, put},
    Router,
};
use axum::body::Body;
use axum::http::Request;
use security_gateway::{Database, SecurityGateway};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::info;
use tower_http::cors::CorsLayer;

mod api;
mod auth;

pub struct AppState {
    pub gateway: Arc<SecurityGateway>,
    pub db: Arc<Database>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    
    info!("🚀 Starting Protocol Adapters Service with API...");
    
    let gateway = Arc::new(SecurityGateway::new().await?);
    let db = Arc::new(Database::connect().await?);
    
    let state = Arc::new(AppState {
        gateway,
        db,
    });
    
    let app = Router::new()
        .route("/health", get(health_check))
        
        // User Auth routes (public)
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        
        // Merchant Auth routes (public)
        .route("/auth/merchant/register", post(auth::merchant_register))
        .route("/auth/merchant/login", post(auth::merchant_login))
        
        // Agent routes (require JWT)
        .route("/api/v1/agents/register", post(api::register_agent))
        .route("/api/v1/agents", get(api::list_agents))
        .route("/api/v1/agents/:id", get(api::get_agent))
        .route("/api/v1/agents/:id", delete(api::delete_agent))
        .route("/api/v1/agents/:id/transactions", get(api::get_agent_transactions))
        .route("/api/v1/agents/:id/limits", put(api::update_agent_limits))
        
        // Merchant routes (require JWT)
        .route("/api/v1/merchants", get(api::list_merchants))
        .route("/api/v1/merchants/:id/approve", post(api::approve_merchant))
        .route("/api/v1/merchants/:merchant_id/transactions", get(api::get_merchant_transactions))
        
        // Merchant: Block agents (require JWT)
        .route("/api/v1/merchants/:merchant_id/agents/:agent_id/block", post(api::block_agent_simple))
        .route("/api/v1/merchants/:merchant_id/agents/:agent_id/block-refund", post(api::request_block_with_refund))
        
        // Transaction routes (require JWT)
        .route("/api/v1/transactions", get(api::list_all_transactions))
        .route("/api/v1/transactions", post(api::create_transaction))
        .route("/api/v1/transactions/:id/complete", post(api::complete_transaction))
        .route("/api/v1/transactions/:id/deny", post(api::deny_transaction))
        
        // Admin: Block request management (require JWT + admin role)
        .route("/api/v1/admin/block-requests", get(api::list_block_requests))
        .route("/api/v1/admin/block-requests/:id/approve", post(api::approve_block_request))
        .route("/api/v1/admin/block-requests/:id/deny", post(api::deny_block_request))
        
        .layer(middleware::from_fn_with_state(state.clone(), request_middleware))
        .layer(CorsLayer::very_permissive())
        .with_state(state);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    info!("✅ Server listening on {}", addr);
    info!("✅ API: http://localhost:8081/api/v1");
    info!("✅ Auth: http://localhost:8081/auth");
    info!("✅ Merchant Auth: http://localhost:8081/auth/merchant");
    info!("✅ Health: http://localhost:8081/health");
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> &'static str {
    "Protocol Adapters Service with Auth & API"
}

async fn request_middleware(
    State(_state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Result<axum::response::Response, StatusCode> {
    let path = request.uri().path();
    let method = request.method();
    
    info!("📨 {} {}", method, path);
    
    // JWT authentication for /api/v1 routes
    if path.starts_with("/api/v1") {
        let auth_header = request.headers()
            .get("authorization")
            .and_then(|v| v.to_str().ok());
        
        if auth_header.is_none() {
            info!("❌ Unauthorized - missing authorization header");
            return Err(StatusCode::UNAUTHORIZED);
        }
        
        let token = auth_header.unwrap()
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;
        
        // Verify JWT token
        if auth::verify_token(token).is_err() {
            info!("❌ Unauthorized - invalid token");
            return Err(StatusCode::UNAUTHORIZED);
        }
        
        info!("✅ JWT validated");
    }
    
    Ok(next.run(request).await)
}
