use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;
use sqlx::Row;

use crate::AppState;

// Request/Response models
#[derive(Debug, Deserialize)]
pub struct RegisterMerchantRequest {
    pub merchant_name: String,
    pub domain: String,
    pub business_email: String,
    pub business_address: Option<String>,
    pub checkout_url_pattern: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RegisterMerchantResponse {
    pub merchant_id: Uuid,
    pub api_key: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct Merchant {
    pub id: Uuid,
    pub merchant_name: String,
    pub domain: String,
    pub business_email: String,
    pub business_address: Option<String>,
    pub trust_score: i32,
    pub status: String,
    pub checkout_url_pattern: Option<String>,
    pub created_at: String,
    pub approved_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MerchantAgent {
    pub agent_id: String,
    pub agent_name: String,
    pub owner_email: String,
    pub transaction_count: i64,
    pub total_volume: f64,
    pub avg_risk_score: f64,
    pub last_transaction: Option<String>,
    pub is_blocked: bool,
}

#[derive(Debug, Deserialize)]
pub struct BlockAgentRequest {
    pub agent_id: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveMerchantRequest {
    pub trust_score: i32,
}

// Extract user_id from JWT
fn extract_user_from_header(headers: &axum::http::HeaderMap) -> Option<(Uuid, String)> {
    let token = headers.get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))?;
    
    let claims = crate::auth::verify_token(token).ok()?;
    let user_id = Uuid::parse_str(&claims.sub).ok()?;
    Some((user_id, claims.role))
}

pub async fn register_merchant(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<RegisterMerchantRequest>,
) -> Result<Json<RegisterMerchantResponse>, StatusCode> {
    info!("🏪 Merchant registration request: {}", req.merchant_name);

    // Get user from JWT token
    let (user_id, _user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Generate API key
    let api_key = format!("mk_live_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

    let result = sqlx::query(
        "INSERT INTO merchants (
            user_id, merchant_name, domain, business_email, business_address,
            checkout_url_pattern, api_key, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
        RETURNING id"
    )
    .bind(&user_id)
    .bind(&req.merchant_name)
    .bind(&req.domain)
    .bind(&req.business_email)
    .bind(&req.business_address)
    .bind(&req.checkout_url_pattern)
    .bind(&api_key)
    .fetch_one(&state.db.pool)
    .await;

    match result {
        Ok(row) => {
            let merchant_id: Uuid = row.get("id");
            info!("✅ Merchant registered: {}", merchant_id);
            Ok(Json(RegisterMerchantResponse {
                merchant_id,
                api_key,
                status: "pending".to_string(),
                message: "Merchant registration submitted. Awaiting admin approval.".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to register merchant: {}", e);
            if e.to_string().contains("duplicate key") {
                Err(StatusCode::CONFLICT)
            } else {
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}

pub async fn list_merchants(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Vec<Merchant>>, StatusCode> {
    info!("📋 Listing merchants");

    let (user_id, user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Admin sees all merchants, users see only their own
    let query = if user_role == "admin" {
        "SELECT id, merchant_name, domain, business_email, business_address,
                trust_score, status, checkout_url_pattern, created_at, approved_at
         FROM merchants
         ORDER BY created_at DESC"
    } else {
        "SELECT id, merchant_name, domain, business_email, business_address,
                trust_score, status, checkout_url_pattern, created_at, approved_at
         FROM merchants
         WHERE user_id = $1
         ORDER BY created_at DESC"
    };

    let rows = if user_role == "admin" {
        sqlx::query(query)
            .fetch_all(&state.db.pool)
            .await
    } else {
        sqlx::query(query)
            .bind(&user_id)
            .fetch_all(&state.db.pool)
            .await
    };

    match rows {
        Ok(rows) => {
            let merchants: Vec<Merchant> = rows.iter().map(|row| {
                Merchant {
                    id: row.get("id"),
                    merchant_name: row.get("merchant_name"),
                    domain: row.get("domain"),
                    business_email: row.get("business_email"),
                    business_address: row.get("business_address"),
                    trust_score: row.get("trust_score"),
                    status: row.get("status"),
                    checkout_url_pattern: row.get("checkout_url_pattern"),
                    created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                    approved_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("approved_at")
                        .map(|dt| dt.to_rfc3339()),
                }
            }).collect();

            info!("✅ Returning {} merchants", merchants.len());
            Ok(Json(merchants))
        }
        Err(e) => {
            error!("Failed to list merchants: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_merchant(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(merchant_id): Path<Uuid>,
) -> Result<Json<Merchant>, StatusCode> {
    info!("🔍 Getting merchant: {}", merchant_id);

    let (user_id, user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let query = if user_role == "admin" {
        "SELECT id, merchant_name, domain, business_email, business_address,
                trust_score, status, checkout_url_pattern, created_at, approved_at
         FROM merchants WHERE id = $1"
    } else {
        "SELECT id, merchant_name, domain, business_email, business_address,
                trust_score, status, checkout_url_pattern, created_at, approved_at
         FROM merchants WHERE id = $1 AND user_id = $2"
    };

    let row = if user_role == "admin" {
        sqlx::query(query)
            .bind(&merchant_id)
            .fetch_optional(&state.db.pool)
            .await
    } else {
        sqlx::query(query)
            .bind(&merchant_id)
            .bind(&user_id)
            .fetch_optional(&state.db.pool)
            .await
    };

    match row {
        Ok(Some(row)) => {
            let merchant = Merchant {
                id: row.get("id"),
                merchant_name: row.get("merchant_name"),
                domain: row.get("domain"),
                business_email: row.get("business_email"),
                business_address: row.get("business_address"),
                trust_score: row.get("trust_score"),
                status: row.get("status"),
                checkout_url_pattern: row.get("checkout_url_pattern"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                approved_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("approved_at")
                    .map(|dt| dt.to_rfc3339()),
            };
            Ok(Json(merchant))
        }
        Ok(None) => {
            info!("❌ Merchant not found or unauthorized: {}", merchant_id);
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            error!("Failed to get merchant: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_merchant_agents(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(merchant_id): Path<Uuid>,
) -> Result<Json<Vec<MerchantAgent>>, StatusCode> {
    info!("🤖 Getting agents for merchant: {}", merchant_id);

    let (user_id, user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify user owns this merchant (unless admin)
    if user_role != "admin" {
        let check = sqlx::query("SELECT id FROM merchants WHERE id = $1 AND user_id = $2")
            .bind(&merchant_id)
            .bind(&user_id)
            .fetch_optional(&state.db.pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if check.is_none() {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    // Get merchant domain
    let merchant_domain: String = sqlx::query_scalar("SELECT domain FROM merchants WHERE id = $1")
        .bind(&merchant_id)
        .fetch_one(&state.db.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get agents that have transacted with this merchant
    let rows = sqlx::query(
        "SELECT 
            a.id as agent_id,
            a.agent_name,
            a.owner_email,
            COUNT(t.id) as transaction_count,
            COALESCE(SUM(t.amount), 0) as total_volume,
            COALESCE(AVG(t.risk_score), 0) as avg_risk_score,
            MAX(t.created_at) as last_transaction,
            EXISTS(
                SELECT 1 FROM merchant_agent_blocks 
                WHERE merchant_id = $1 AND agent_id = a.id
            ) as is_blocked
         FROM agents a
         LEFT JOIN transactions t ON t.agent_id = a.id AND t.merchant_id LIKE $2
         WHERE t.id IS NOT NULL
         GROUP BY a.id, a.agent_name, a.owner_email
         ORDER BY total_volume DESC"
    )
    .bind(&merchant_id)
    .bind(format!("%{}%", merchant_domain))
    .fetch_all(&state.db.pool)
    .await;

    match rows {
        Ok(rows) => {
            let agents: Vec<MerchantAgent> = rows.iter().map(|row| {
                MerchantAgent {
                    agent_id: row.get("agent_id"),
                    agent_name: row.get("agent_name"),
                    owner_email: row.get("owner_email"),
                    transaction_count: row.get("transaction_count"),
                    total_volume: row.get::<rust_decimal::Decimal, _>("total_volume")
                        .to_string().parse().unwrap_or(0.0),
                    avg_risk_score: row.get::<rust_decimal::Decimal, _>("avg_risk_score")
                        .to_string().parse().unwrap_or(0.0),
                    last_transaction: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_transaction")
                        .map(|dt| dt.to_rfc3339()),
                    is_blocked: row.get("is_blocked"),
                }
            }).collect();

            Ok(Json(agents))
        }
        Err(e) => {
            error!("Failed to get merchant agents: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn block_agent(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(merchant_id): Path<Uuid>,
    Json(req): Json<BlockAgentRequest>,
) -> Result<StatusCode, StatusCode> {
    info!("🚫 Blocking agent {} for merchant {}", req.agent_id, merchant_id);

    let (user_id, user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify user owns this merchant (unless admin)
    if user_role != "admin" {
        let check = sqlx::query("SELECT id FROM merchants WHERE id = $1 AND user_id = $2")
            .bind(&merchant_id)
            .bind(&user_id)
            .fetch_optional(&state.db.pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if check.is_none() {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let result = sqlx::query(
        "INSERT INTO merchant_agent_blocks (merchant_id, agent_id, reason, blocked_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (merchant_id, agent_id) DO NOTHING"
    )
    .bind(&merchant_id)
    .bind(&req.agent_id)
    .bind(&req.reason)
    .bind(&user_id)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(_) => {
            info!("✅ Agent blocked");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to block agent: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn unblock_agent(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path((merchant_id, agent_id)): Path<(Uuid, String)>,
) -> Result<StatusCode, StatusCode> {
    info!("✅ Unblocking agent {} for merchant {}", agent_id, merchant_id);

    let (user_id, user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify user owns this merchant (unless admin)
    if user_role != "admin" {
        let check = sqlx::query("SELECT id FROM merchants WHERE id = $1 AND user_id = $2")
            .bind(&merchant_id)
            .bind(&user_id)
            .fetch_optional(&state.db.pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if check.is_none() {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let result = sqlx::query(
        "DELETE FROM merchant_agent_blocks 
         WHERE merchant_id = $1 AND agent_id = $2"
    )
    .bind(&merchant_id)
    .bind(&agent_id)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(_) => {
            info!("✅ Agent unblocked");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to unblock agent: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Admin only: Approve merchant
pub async fn approve_merchant(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(merchant_id): Path<Uuid>,
    Json(req): Json<ApproveMerchantRequest>,
) -> Result<StatusCode, StatusCode> {
    info!("✅ Approving merchant: {}", merchant_id);

    let (user_id, user_role) = extract_user_from_header(&headers)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Only admins can approve
    if user_role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let result = sqlx::query(
        "UPDATE merchants 
         SET status = 'approved', trust_score = $1, approved_at = NOW(), approved_by = $2
         WHERE id = $3"
    )
    .bind(req.trust_score)
    .bind(&user_id)
    .bind(&merchant_id)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(_) => {
            info!("✅ Merchant approved");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to approve merchant: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
