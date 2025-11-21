use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::Serialize;
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize)]
pub struct BlockLedgerEntry {
    pub id: String,
    pub block_type: String, // "simple" or "refund_request"
    pub merchant_id: String,
    pub merchant_name: String,
    pub agent_id: String,
    pub agent_name: String,
    pub agent_owner_email: String,
    pub reason: String,
    pub blocked_at: String,
    pub status: Option<String>, // Only for refund_requests
    pub refund_amount: Option<f64>, // Only for refund_requests
    pub transaction_id: Option<String>,
}

pub async fn get_all_blocks_ledger(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BlockLedgerEntry>>, StatusCode> {
    info!("📋 Fetching complete block ledger for admin");

    let mut ledger: Vec<BlockLedgerEntry> = Vec::new();

    // 1. Get simple blocks from merchant_agent_blocks
    let simple_blocks = sqlx::query(
        "SELECT 
            mab.id, mab.merchant_id, mab.agent_id, mab.reason, mab.blocked_at,
            m.merchant_name,
            a.agent_name,
            u.email as owner_email
         FROM merchant_agent_blocks mab
         JOIN merchants m ON m.id = mab.merchant_id
         LEFT JOIN agents a ON a.id = mab.agent_id
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY mab.blocked_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch simple blocks: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    for row in simple_blocks {
        ledger.push(BlockLedgerEntry {
            id: row.get::<Uuid, _>("id").to_string(),
            block_type: "simple".to_string(),
            merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
            merchant_name: row.get("merchant_name"),
            agent_id: row.get("agent_id"),
            agent_name: row.get::<Option<String>, _>("agent_name").unwrap_or_else(|| "Unknown".to_string()),
            agent_owner_email: row.get::<Option<String>, _>("owner_email").unwrap_or_else(|| "Unknown".to_string()),
            reason: row.get("reason"),
            blocked_at: row.get::<chrono::DateTime<chrono::Utc>, _>("blocked_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
            status: Some("blocked".to_string()),
            refund_amount: None,
            transaction_id: None,
        });
    }

    // 2. Get refund requests from agent_block_requests
    let refund_requests = sqlx::query(
        "SELECT 
            br.id, br.merchant_id, br.agent_id, br.transaction_id, br.reason,
            br.refund_amount, br.status, br.created_at,
            m.merchant_name,
            a.agent_name,
            u.email as owner_email
         FROM agent_block_requests br
         JOIN merchants m ON m.id = br.merchant_id
         LEFT JOIN agents a ON a.id = br.agent_id
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY br.created_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch refund requests: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    for row in refund_requests {
        ledger.push(BlockLedgerEntry {
            id: row.get::<Uuid, _>("id").to_string(),
            block_type: "refund_request".to_string(),
            merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
            merchant_name: row.get("merchant_name"),
            agent_id: row.get("agent_id"),
            agent_name: row.get::<Option<String>, _>("agent_name").unwrap_or_else(|| "Unknown".to_string()),
            agent_owner_email: row.get::<Option<String>, _>("owner_email").unwrap_or_else(|| "Unknown".to_string()),
            reason: row.get("reason"),
            blocked_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
            status: Some(row.get("status")),
            refund_amount: row.get::<Option<rust_decimal::Decimal>, _>("refund_amount")
                .map(|d| d.to_string().parse().unwrap_or(0.0)),
            transaction_id: row.get::<Option<Uuid>, _>("transaction_id").map(|id| id.to_string()),
        });
    }

    // Sort by blocked_at descending
    ledger.sort_by(|a, b| b.blocked_at.cmp(&a.blocked_at));

    info!("✅ Found {} total blocks in ledger", ledger.len());
    Ok(Json(ledger))
}
