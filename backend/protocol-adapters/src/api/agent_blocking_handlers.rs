use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct DenyTransactionRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct BlockAgentRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct BlockWithRefundRequest {
    pub transaction_id: String,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ReviewBlockRequestRequest {
    pub admin_notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BlockRequestResponse {
    pub id: String,
    pub merchant_id: String,
    pub merchant_name: String,
    pub agent_id: String,
    pub agent_name: String,
    pub agent_owner_email: String,
    pub transaction_id: Option<String>,
    pub reason: String,
    pub refund_amount: Option<f64>,
    pub status: String,
    pub created_at: String,
    pub reviewed_at: Option<String>,
    pub admin_notes: Option<String>,
}

pub async fn deny_transaction(
    State(state): State<Arc<AppState>>,
    Path(transaction_id): Path<String>,
    Json(req): Json<DenyTransactionRequest>,
) -> Result<StatusCode, StatusCode> {
    info!("❌ Denying transaction: {}", transaction_id);

    let transaction_uuid = Uuid::parse_str(&transaction_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let result = sqlx::query(
        "UPDATE transactions 
         SET status = 'failed', completed_at = NOW() 
         WHERE id = $1 AND status = 'pending'"
    )
    .bind(transaction_uuid)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                error!("Transaction not found or not pending: {}", transaction_id);
                return Err(StatusCode::NOT_FOUND);
            }
            info!("✅ Transaction denied: {} - Reason: {}", transaction_id, req.reason);
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to deny transaction: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn block_agent_simple(
    State(state): State<Arc<AppState>>,
    Path((merchant_id, agent_id)): Path<(String, String)>,
    Json(req): Json<BlockAgentRequest>,
) -> Result<Json<BlockRequestResponse>, StatusCode> {
    info!("🚫 Creating block request for agent {} by merchant {}", agent_id, merchant_id);

    let merchant_uuid = Uuid::parse_str(&merchant_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Get merchant user (optional - can be NULL)
    let merchant_user_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT linked_user_id FROM merchants WHERE id = $1"
    )
    .bind(merchant_uuid)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch merchant user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .flatten(); // Flatten Option<Option<Uuid>> to Option<Uuid>

    // Create block request (no refund, no transaction)
    let request_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO agent_block_requests 
         (id, merchant_id, agent_id, transaction_id, reason, requested_by, refund_amount, status, created_at)
         VALUES ($1, $2, $3, NULL, $4, $5, NULL, 'pending', NOW())"
    )
    .bind(request_id)
    .bind(merchant_uuid)
    .bind(&agent_id)
    .bind(&req.reason)
    .bind(merchant_user_id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to create block request: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Fetch and return the created request
    let row = sqlx::query(
        "SELECT 
            br.id, br.merchant_id, br.agent_id, br.transaction_id, br.reason,
            br.refund_amount, br.status, br.created_at, br.reviewed_at, br.admin_notes,
            m.merchant_name,
            a.agent_name,
            a.owner_email
         FROM agent_block_requests br
         JOIN merchants m ON m.id = br.merchant_id
         LEFT JOIN agents a ON a.id = br.agent_id
         WHERE br.id = $1"
    )
    .bind(request_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch created request: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = BlockRequestResponse {
        id: row.get::<Uuid, _>("id").to_string(),
        merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
        merchant_name: row.get("merchant_name"),
        agent_id: row.get("agent_id"),
        agent_name: row.get::<Option<String>, _>("agent_name").unwrap_or_else(|| "Unknown".to_string()),
        agent_owner_email: row.get::<Option<String>, _>("owner_email").unwrap_or_else(|| "Unknown".to_string()),
        transaction_id: None,
        reason: row.get("reason"),
        refund_amount: None,
        status: row.get("status"),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .format("%Y-%m-%d %H:%M:%S").to_string(),
        reviewed_at: None,
        admin_notes: None,
    };

    info!("✅ Block request created (pending admin approval): {}", request_id);
    Ok(Json(response))
}

pub async fn request_block_with_refund(
    State(state): State<Arc<AppState>>,
    Path((merchant_id, agent_id)): Path<(String, String)>,
    Json(req): Json<BlockWithRefundRequest>,
) -> Result<Json<BlockRequestResponse>, StatusCode> {
    info!("🔐 Block+refund request for agent {} by merchant {}", agent_id, merchant_id);

    let merchant_uuid = Uuid::parse_str(&merchant_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let transaction_uuid = Uuid::parse_str(&req.transaction_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let transaction: (f64, String) = sqlx::query_as(
        "SELECT amount::FLOAT8, status FROM transactions WHERE id = $1"
    )
    .bind(transaction_uuid)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let (amount, status) = transaction;

    if status != "completed" {
        error!("Cannot refund non-completed transaction");
        return Err(StatusCode::BAD_REQUEST);
    }

    let merchant_user_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT linked_user_id FROM merchants WHERE id = $1"
    )
    .bind(merchant_uuid)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .flatten();

    let request_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO agent_block_requests 
         (id, merchant_id, agent_id, transaction_id, reason, requested_by, refund_amount, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())"
    )
    .bind(request_id)
    .bind(merchant_uuid)
    .bind(&agent_id)
    .bind(transaction_uuid)
    .bind(&req.reason)
    .bind(merchant_user_id)
    .bind(amount)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to create block request: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let row = sqlx::query(
        "SELECT 
            br.id, br.merchant_id, br.agent_id, br.transaction_id, br.reason,
            br.refund_amount, br.status, br.created_at, br.reviewed_at, br.admin_notes,
            m.merchant_name,
            a.agent_name,
            a.owner_email
         FROM agent_block_requests br
         JOIN merchants m ON m.id = br.merchant_id
         LEFT JOIN agents a ON a.id = br.agent_id
         WHERE br.id = $1"
    )
    .bind(request_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch created request: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = BlockRequestResponse {
        id: row.get::<Uuid, _>("id").to_string(),
        merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
        merchant_name: row.get("merchant_name"),
        agent_id: row.get("agent_id"),
        agent_name: row.get::<Option<String>, _>("agent_name").unwrap_or_else(|| "Unknown".to_string()),
        agent_owner_email: row.get::<Option<String>, _>("owner_email").unwrap_or_else(|| "Unknown".to_string()),
        transaction_id: Some(row.get::<Uuid, _>("transaction_id").to_string()),
        reason: row.get("reason"),
        refund_amount: row.get::<Option<rust_decimal::Decimal>, _>("refund_amount")
            .map(|d| d.to_string().parse().unwrap_or(0.0)),
        status: row.get("status"),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .format("%Y-%m-%d %H:%M:%S").to_string(),
        reviewed_at: None,
        admin_notes: None,
    };

    info!("✅ Block+refund request created: {}", request_id);
    Ok(Json(response))
}

pub async fn list_block_requests(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BlockRequestResponse>>, StatusCode> {
    info!("📋 Fetching all block requests");

    let rows = sqlx::query(
        "SELECT 
            br.id, br.merchant_id, br.agent_id, br.transaction_id, br.reason,
            br.refund_amount, br.status, br.created_at, br.reviewed_at, br.admin_notes,
            m.merchant_name,
            a.agent_name,
            a.owner_email
         FROM agent_block_requests br
         JOIN merchants m ON m.id = br.merchant_id
         LEFT JOIN agents a ON a.id = br.agent_id
         ORDER BY br.created_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch block requests: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let requests: Vec<BlockRequestResponse> = rows
        .iter()
        .map(|row| BlockRequestResponse {
            id: row.get::<Uuid, _>("id").to_string(),
            merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
            merchant_name: row.get("merchant_name"),
            agent_id: row.get("agent_id"),
            agent_name: row.get::<Option<String>, _>("agent_name").unwrap_or_else(|| "Unknown".to_string()),
            agent_owner_email: row.get::<Option<String>, _>("owner_email").unwrap_or_else(|| "Unknown".to_string()),
            transaction_id: row.get::<Option<Uuid>, _>("transaction_id").map(|id| id.to_string()),
            reason: row.get("reason"),
            refund_amount: row.get::<Option<rust_decimal::Decimal>, _>("refund_amount")
                .map(|d| d.to_string().parse().unwrap_or(0.0)),
            status: row.get("status"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
            reviewed_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("reviewed_at")
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
            admin_notes: row.get("admin_notes"),
        })
        .collect();

    info!("✅ Found {} block requests", requests.len());
    Ok(Json(requests))
}

pub async fn approve_block_request(
    State(state): State<Arc<AppState>>,
    Path(request_id): Path<String>,
    Json(req): Json<ReviewBlockRequestRequest>,
) -> Result<StatusCode, StatusCode> {
    info!("✅ Approving block request: {}", request_id);

    let request_uuid = Uuid::parse_str(&request_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let row = sqlx::query(
        "SELECT agent_id, transaction_id, refund_amount, merchant_id, reason
         FROM agent_block_requests
         WHERE id = $1 AND status = 'pending'"
    )
    .bind(request_uuid)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch block request: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let agent_id: String = row.get("agent_id");
    let transaction_id: Option<Uuid> = row.get("transaction_id");
    let refund_amount: Option<rust_decimal::Decimal> = row.get("refund_amount");
    let merchant_id: Uuid = row.get("merchant_id");
    let reason: String = row.get("reason");

    // Get merchant name for notification
    let merchant_name: String = sqlx::query_scalar(
        "SELECT merchant_name FROM merchants WHERE id = $1"
    )
    .bind(merchant_id)
    .fetch_one(&state.db.pool)
    .await
    .unwrap_or_else(|_| "Unknown Merchant".to_string());

    let mut tx = state.db.pool.begin().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. Add to merchant_agent_blocks (actual block)
    sqlx::query(
        "INSERT INTO merchant_agent_blocks (merchant_id, agent_id, reason, blocked_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (merchant_id, agent_id) DO NOTHING"
    )
    .bind(merchant_id)
    .bind(&agent_id)
    .bind(&reason)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to block agent: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2. Update agent risk score by 20
    sqlx::query(
        "UPDATE agents 
         SET risk_score = LEAST(risk_score + 20, 100)
         WHERE id = $1"
    )
    .bind(&agent_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to update agent risk score: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3. If there's a refund, process it
    if let (Some(trans_id), Some(amount)) = (transaction_id, refund_amount) {
        sqlx::query(
            "UPDATE transactions 
             SET refunded = TRUE, refunded_at = NOW(), refund_reason = $1
             WHERE id = $2"
        )
        .bind(&reason)
        .bind(trans_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("Failed to mark transaction as refunded: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        sqlx::query(
            "UPDATE agents 
             SET remaining_balance = remaining_balance + $1,
                 total_volume = total_volume - $1,
                 transaction_count = GREATEST(transaction_count - 1, 0)
             WHERE id = $2"
        )
        .bind(amount)
        .bind(&agent_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("Failed to refund agent: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        sqlx::query(
            "UPDATE merchants 
             SET total_revenue = GREATEST(total_revenue - $1, 0)
             WHERE id = $2"
        )
        .bind(amount)
        .bind(merchant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("Failed to update merchant revenue: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        info!("✅ Refunded ${} to agent {} and decreased merchant revenue", amount, agent_id);
    }

    // 4. Update block request status
    sqlx::query(
        "UPDATE agent_block_requests
         SET status = 'approved', reviewed_at = NOW(), admin_notes = $1
         WHERE id = $2"
    )
    .bind(&req.admin_notes)
    .bind(request_uuid)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to update block request: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. NOTIFY AGENT OWNER
    let notification_msg = if refund_amount.is_some() {
        format!(
            "Your agent '{}' has been blocked by {} and a refund has been issued. Reason: {}",
            agent_id, merchant_name, reason
        )
    } else {
        format!(
            "Your agent '{}' has been blocked by {}. Reason: {}",
            agent_id, merchant_name, reason
        )
    };

    let _ = notify_agent_owner_of_block(&state.db.pool, &agent_id, &notification_msg).await;

    info!("✅ Block request approved and agent blocked: {}", agent_id);
    Ok(StatusCode::OK)
}

pub async fn deny_block_request(
    State(state): State<Arc<AppState>>,
    Path(request_id): Path<String>,
    Json(req): Json<ReviewBlockRequestRequest>,
) -> Result<StatusCode, StatusCode> {
    info!("❌ Denying block request: {}", request_id);

    let request_uuid = Uuid::parse_str(&request_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let result = sqlx::query(
        "UPDATE agent_block_requests
         SET status = 'denied', reviewed_at = NOW(), admin_notes = $1
         WHERE id = $2 AND status = 'pending'"
    )
    .bind(&req.admin_notes)
    .bind(request_uuid)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err(StatusCode::NOT_FOUND);
            }
            info!("✅ Block request denied");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to deny block request: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn notify_agent_owner_of_block(
    pool: &sqlx::PgPool,
    agent_id: &str,
    message: &str,
) -> Result<(), sqlx::Error> {
    let user_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM agents WHERE id = $1"
    )
    .bind(agent_id)
    .fetch_optional(pool)
    .await?;

    if let Some(user_id) = user_id {
        sqlx::query(
            "INSERT INTO notifications (user_id, agent_id, title, message, type, created_at)
             VALUES ($1, $2, $3, $4, 'warning', NOW())"
        )
        .bind(user_id)
        .bind(agent_id)
        .bind("Agent Blocked")
        .bind(message)
        .execute(pool)
        .await?;

        info!("📧 Notification sent to agent owner for agent: {}", agent_id);
    }

    Ok(())
}
