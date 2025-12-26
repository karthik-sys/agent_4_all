use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};

use crate::AppState;

#[derive(Debug, Serialize)]
pub struct Agent {
    pub id: String,
    pub agent_name: String,
    pub foundational_model: String,
    pub tier: String,
    pub status: String,
    pub balance: f64,
    pub remaining_balance: f64,
    pub total_volume: f64,
    pub transaction_count: i64,
    pub risk_score: i32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAgentRequest {
    pub agent_name: String,
    pub foundational_model: String,
    pub tier: String,
    pub balance: i64,
}

pub async fn create_agent(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateAgentRequest>,
) -> Result<Json<Agent>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    info!("Creating agent: {} for user: {}", req.agent_name, claims.email);

    let agent_id = format!("agent_{}_{}", 
        req.agent_name.to_lowercase().replace(" ", "_"),
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap()
    );

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        "INSERT INTO agents 
         (id, user_id, agent_name, foundational_model, tier, status, balance, 
          remaining_balance, total_volume, transaction_count, risk_score, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, $6, 0, 0, 0, NOW())"
    )
    .bind(&agent_id)
    .bind(user_id)
    .bind(&req.agent_name)
    .bind(&req.foundational_model)
    .bind(&req.tier)
    .bind(req.balance)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to create agent: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let agent = Agent {
        id: agent_id,
        agent_name: req.agent_name,
        foundational_model: req.foundational_model,
        tier: req.tier,
        status: "active".to_string(),
        balance: req.balance as f64,
        remaining_balance: req.balance as f64,
        total_volume: 0.0,
        transaction_count: 0,
        risk_score: 0,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    info!("✅ Agent created: {}", agent.id);
    Ok(Json(agent))
}

pub async fn list_agents(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Agent>>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    info!("📋 Fetching agents for user: {}", claims.email);

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rows = sqlx::query(
        "SELECT id, agent_name, foundational_model, tier, status, balance,
                remaining_balance, total_volume, transaction_count, risk_score, created_at
         FROM agents 
         WHERE user_id = $1
         ORDER BY created_at DESC"
    )
    .bind(user_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch agents: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let agents: Vec<Agent> = rows
        .iter()
        .map(|row| Agent {
            id: row.get("id"),
            agent_name: row.get("agent_name"),
            foundational_model: row.get("foundational_model"),
            tier: row.get("tier"),
            status: row.get("status"),
            balance: row.get::<rust_decimal::Decimal, _>("balance")
                .to_string().parse().unwrap_or(0.0),
            remaining_balance: row.get::<rust_decimal::Decimal, _>("remaining_balance")
                .to_string().parse().unwrap_or(0.0),
            total_volume: row.get::<rust_decimal::Decimal, _>("total_volume")
                .to_string().parse().unwrap_or(0.0),
            transaction_count: row.get("transaction_count"),
            risk_score: row.get("risk_score"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();

    info!("✅ Found {} agents for {}", agents.len(), claims.email);
    Ok(Json(agents))
}

pub async fn get_agent(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Agent>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    info!("🔍 Fetching agent: {}", agent_id);

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = sqlx::query(
        "SELECT id, agent_name, foundational_model, tier, status, balance,
                remaining_balance, total_volume, transaction_count, risk_score, created_at
         FROM agents 
         WHERE id = $1 AND user_id = $2"
    )
    .bind(&agent_id)
    .bind(user_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch agent: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let agent = Agent {
        id: row.get("id"),
        agent_name: row.get("agent_name"),
        foundational_model: row.get("foundational_model"),
        tier: row.get("tier"),
        status: row.get("status"),
        balance: row.get::<rust_decimal::Decimal, _>("balance")
            .to_string().parse().unwrap_or(0.0),
        remaining_balance: row.get::<rust_decimal::Decimal, _>("remaining_balance")
            .to_string().parse().unwrap_or(0.0),
        total_volume: row.get::<rust_decimal::Decimal, _>("total_volume")
            .to_string().parse().unwrap_or(0.0),
        transaction_count: row.get("transaction_count"),
        risk_score: row.get("risk_score"),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    info!("✅ Agent found");
    Ok(Json(agent))
}

pub async fn delete_agent(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    headers: HeaderMap,
) -> Result<StatusCode, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    info!("🗑️ Deleting agent: {}", agent_id);

    let user_uuid = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Verify agent belongs to user
    let agent_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1 AND user_id = $2)"
    )
    .bind(&agent_id)
    .bind(user_uuid)
    .fetch_one(&state.db.pool)
    .await
    .unwrap_or(false);

    if !agent_exists {
        error!("Agent not found or doesn't belong to user");
        return Err(StatusCode::NOT_FOUND);
    }

    // Delete transactions first (no CASCADE on this FK)
    info!("🗑️ Deleting transactions...");
    sqlx::query("DELETE FROM transactions WHERE agent_id = $1")
        .bind(&agent_id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| {
            error!("Failed to delete transactions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Now delete agent (CASCADE will handle evaluations, team_members, blocks, nonces)
    info!("🗑️ Deleting agent...");
    sqlx::query("DELETE FROM agents WHERE id = $1")
        .bind(&agent_id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| {
            error!("Failed to delete agent: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    info!("✅ Agent and all related data deleted");
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_agent_transactions(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    info!("📋 Fetching transactions for agent: {}", agent_id);

    let rows = sqlx::query(
        "SELECT t.id, t.amount, t.description, t.status, t.created_at, t.merchant_id
         FROM transactions t
         JOIN agents a ON a.id = t.agent_id
         WHERE t.agent_id = $1 AND a.user_id = $2
         ORDER BY t.created_at DESC
         LIMIT 100"
    )
    .bind(&agent_id)
    .bind(uuid::Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch agent transactions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let transactions: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<uuid::Uuid, _>("id").to_string(),
                "amount": row.get::<rust_decimal::Decimal, _>("amount").to_string().parse::<f64>().unwrap_or(0.0),
                "description": row.get::<Option<String>, _>("description"),
                "status": row.get::<String, _>("status"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                "merchant_id": row.get::<uuid::Uuid, _>("merchant_id").to_string(),
            })
        })
        .collect();

    info!("✅ Found {} transactions for agent", transactions.len());
    Ok(Json(transactions))
}
