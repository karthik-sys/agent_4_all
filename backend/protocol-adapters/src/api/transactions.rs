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
pub struct CreateTransactionRequest {
    pub agent_id: String,
    pub merchant_id: String,
    pub amount: f64,
    pub checkout_url: Option<String>,
    pub items: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub id: String,
    pub agent_id: String,
    pub agent_name: String,
    pub agent_owner_name: String,
    pub agent_owner_email: String,
    pub merchant_id: String,
    pub merchant_name: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub checkout_url: Option<String>,
    pub items: Option<Vec<String>>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub is_blocked: bool,
}

pub async fn create_transaction(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTransactionRequest>,
) -> Result<Json<TransactionResponse>, StatusCode> {
    info!("💳 Creating transaction for agent: {}", req.agent_id);

    let merchant_uuid = Uuid::parse_str(&req.merchant_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Check if agent is blocked by this merchant
    let is_blocked: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM merchant_agent_blocks 
            WHERE merchant_id = $1 AND agent_id = $2
        )"
    )
    .bind(merchant_uuid)
    .bind(&req.agent_id)
    .fetch_one(&state.db.pool)
    .await
    .unwrap_or(false);

    if is_blocked {
        error!("Agent {} is blocked by merchant {}", req.agent_id, req.merchant_id);
        return Err(StatusCode::FORBIDDEN);
    }

    // Create transaction
    let transaction_id = Uuid::new_v4();
    let items_json = req.items.as_ref().map(|i| serde_json::to_value(i).ok()).flatten();

    sqlx::query(
        "INSERT INTO transactions 
         (id, agent_id, merchant_id, amount, currency, status, checkout_url, items, created_at)
         VALUES ($1, $2, $3, $4, 'USD', 'pending', $5, $6, NOW())"
    )
    .bind(transaction_id)
    .bind(&req.agent_id)
    .bind(merchant_uuid)
    .bind(req.amount)
    .bind(&req.checkout_url)
    .bind(&items_json)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to create transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Fetch complete transaction details
    let row = sqlx::query(
        "SELECT 
            t.id, t.agent_id, t.merchant_id, t.amount, t.currency, t.status,
            t.checkout_url, t.items, t.created_at, t.completed_at,
            a.agent_name, a.owner_company, a.owner_email,
            m.merchant_name,
            EXISTS(SELECT 1 FROM merchant_agent_blocks WHERE merchant_id = t.merchant_id AND agent_id = t.agent_id) as is_blocked
         FROM transactions t
         JOIN agents a ON a.id = t.agent_id
         JOIN merchants m ON m.id = t.merchant_id
         WHERE t.id = $1"
    )
    .bind(transaction_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = TransactionResponse {
        id: row.get::<Uuid, _>("id").to_string(),
        agent_id: row.get("agent_id"),
        agent_name: row.get("agent_name"),
        agent_owner_name: row.get("owner_company"),
        agent_owner_email: row.get("owner_email"),
        merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
        merchant_name: row.get("merchant_name"),
        amount: row.get::<rust_decimal::Decimal, _>("amount").to_string().parse().unwrap_or(0.0),
        currency: row.get("currency"),
        status: row.get("status"),
        checkout_url: row.get("checkout_url"),
        items: row.get::<Option<serde_json::Value>, _>("items")
            .and_then(|v| serde_json::from_value(v).ok()),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .format("%Y-%m-%d %H:%M:%S").to_string(),
        completed_at: None,
        is_blocked: row.get("is_blocked"),
    };

    info!("✅ Transaction created: {}", transaction_id);
    Ok(Json(response))
}

pub async fn complete_transaction(
    State(state): State<Arc<AppState>>,
    Path(transaction_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    info!("✅ Completing transaction: {}", transaction_id);

    let transaction_uuid = Uuid::parse_str(&transaction_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Get transaction details
    let row = sqlx::query(
        "SELECT agent_id, amount FROM transactions WHERE id = $1 AND status = 'pending'"
    )
    .bind(transaction_uuid)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let agent_id: String = row.get("agent_id");
    let amount: rust_decimal::Decimal = row.get("amount");

    let mut tx = state.db.pool.begin().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Update transaction status
    sqlx::query(
        "UPDATE transactions 
         SET status = 'completed', completed_at = NOW() 
         WHERE id = $1"
    )
    .bind(transaction_uuid)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to complete transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Update agent - NO last_transaction_at column
    sqlx::query(
        "UPDATE agents 
         SET remaining_balance = remaining_balance - $1,
             total_volume = total_volume + $1,
             transaction_count = transaction_count + 1
         WHERE id = $2"
    )
    .bind(amount)
    .bind(&agent_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to update agent: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    info!("✅ Transaction completed: {}", transaction_id);
    Ok(StatusCode::OK)
}

pub async fn get_merchant_transactions(
    State(state): State<Arc<AppState>>,
    Path(merchant_id): Path<String>,
) -> Result<Json<Vec<TransactionResponse>>, StatusCode> {
    info!("📋 Fetching transactions for merchant: {}", merchant_id);

    let merchant_uuid = Uuid::parse_str(&merchant_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let rows = sqlx::query(
        "SELECT 
            t.id, t.agent_id, t.merchant_id, t.amount, t.currency, t.status,
            t.checkout_url, t.items, t.created_at, t.completed_at,
            a.agent_name, a.owner_company, a.owner_email,
            m.merchant_name,
            EXISTS(SELECT 1 FROM merchant_agent_blocks WHERE merchant_id = t.merchant_id AND agent_id = t.agent_id) as is_blocked
         FROM transactions t
         JOIN agents a ON a.id = t.agent_id
         JOIN merchants m ON m.id = t.merchant_id
         WHERE t.merchant_id = $1
         ORDER BY t.created_at DESC"
    )
    .bind(merchant_uuid)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch transactions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let transactions: Vec<TransactionResponse> = rows
        .iter()
        .map(|row| TransactionResponse {
            id: row.get::<Uuid, _>("id").to_string(),
            agent_id: row.get("agent_id"),
            agent_name: row.get("agent_name"),
            agent_owner_name: row.get("owner_company"),
            agent_owner_email: row.get("owner_email"),
            merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
            merchant_name: row.get("merchant_name"),
            amount: row.get::<rust_decimal::Decimal, _>("amount").to_string().parse().unwrap_or(0.0),
            currency: row.get("currency"),
            status: row.get("status"),
            checkout_url: row.get("checkout_url"),
            items: row.get::<Option<serde_json::Value>, _>("items")
                .and_then(|v| serde_json::from_value(v).ok()),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
            completed_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("completed_at")
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
            is_blocked: row.get("is_blocked"),
        })
        .collect();

    info!("✅ Found {} transactions", transactions.len());
    Ok(Json(transactions))
}

pub async fn list_all_transactions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TransactionResponse>>, StatusCode> {
    info!("📋 Fetching all transactions");

    let rows = sqlx::query(
        "SELECT 
            t.id, t.agent_id, t.merchant_id, t.amount, t.currency, t.status,
            t.checkout_url, t.items, t.created_at, t.completed_at,
            a.agent_name, a.owner_company, a.owner_email,
            m.merchant_name,
            EXISTS(SELECT 1 FROM merchant_agent_blocks WHERE merchant_id = t.merchant_id AND agent_id = t.agent_id) as is_blocked
         FROM transactions t
         JOIN agents a ON a.id = t.agent_id
         JOIN merchants m ON m.id = t.merchant_id
         ORDER BY t.created_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch transactions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let transactions: Vec<TransactionResponse> = rows
        .iter()
        .map(|row| TransactionResponse {
            id: row.get::<Uuid, _>("id").to_string(),
            agent_id: row.get("agent_id"),
            agent_name: row.get("agent_name"),
            agent_owner_name: row.get("owner_company"),
            agent_owner_email: row.get("owner_email"),
            merchant_id: row.get::<Uuid, _>("merchant_id").to_string(),
            merchant_name: row.get("merchant_name"),
            amount: row.get::<rust_decimal::Decimal, _>("amount").to_string().parse().unwrap_or(0.0),
            currency: row.get("currency"),
            status: row.get("status"),
            checkout_url: row.get("checkout_url"),
            items: row.get::<Option<serde_json::Value>, _>("items")
                .and_then(|v| serde_json::from_value(v).ok()),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
            completed_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("completed_at")
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
            is_blocked: row.get("is_blocked"),
        })
        .collect();

    info!("✅ Found {} transactions", transactions.len());
    Ok(Json(transactions))
}
