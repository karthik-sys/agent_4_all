use axum::{
    extract::{Path, State},
    http::{StatusCode, HeaderMap},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub agent_name: String,
    pub tier: String,
    pub spending_limits: SpendingLimits,
    pub balance: f64,
    pub protocol: Option<String>,
    pub foundational_model: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SpendingLimits {
    pub daily: f64,
    pub monthly: f64,
    pub per_transaction: f64,
}

#[derive(Debug, Serialize)]
pub struct AgentResponse {
    pub id: String,
    pub agent_name: String,
    pub tier: String,
    pub balance: f64,
    pub remaining_balance: f64,
    pub status: String,
    pub spending_limit_daily: f64,
    pub spending_limit_per_tx: f64,
    pub spending_limit_monthly: f64,
    pub total_volume: f64,
    pub transaction_count: i64,
    pub risk_score: i32,
    pub owner_email: String,
    pub owner_company: String,
    pub protocol: String,
    pub foundational_model: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub id: String,
    pub merchant_name: String,
    pub amount: f64,
    pub status: String,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub is_blocked: bool,
}

pub async fn register_agent(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<RegisterAgentRequest>,
) -> Result<Json<AgentResponse>, StatusCode> {
    // EXTRACT USER FROM JWT TOKEN
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    let owner_email = claims.email;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    info!("🤖 Registering new agent: {} for user: {}", req.agent_name, owner_email);

    let agent_id = format!("agent_{}_{}", 
        req.agent_name.to_lowercase().replace(" ", "_"), 
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap()
    );

    // Get owner_company from user
    let owner_company: String = sqlx::query_scalar(
        "SELECT COALESCE(full_name, email) FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.db.pool)
    .await
    .unwrap_or_else(|_| owner_email.clone());

    let result = sqlx::query(
        "INSERT INTO agents (
            id, agent_name, tier, balance, remaining_balance,
            spending_limit_daily, spending_limit_per_tx, spending_limit_monthly,
            owner_email, owner_company, protocol, foundational_model, user_id,
            status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', NOW())"
    )
    .bind(&agent_id)
    .bind(&req.agent_name)
    .bind(&req.tier)
    .bind(req.balance)
    .bind(req.balance)
    .bind(req.spending_limits.daily)
    .bind(req.spending_limits.per_transaction)
    .bind(req.spending_limits.monthly)
    .bind(&owner_email)
    .bind(&owner_company)
    .bind(req.protocol.as_deref().unwrap_or("Custom"))
    .bind(&req.foundational_model)
    .bind(user_id)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(_) => {
            info!("✅ Agent registered: {} owned by {}", agent_id, owner_email);
            
            let agent = AgentResponse {
                id: agent_id,
                agent_name: req.agent_name,
                tier: req.tier,
                balance: req.balance,
                remaining_balance: req.balance,
                status: "active".to_string(),
                spending_limit_daily: req.spending_limits.daily,
                spending_limit_per_tx: req.spending_limits.per_transaction,
                spending_limit_monthly: req.spending_limits.monthly,
                total_volume: 0.0,
                transaction_count: 0,
                risk_score: 0,
                owner_email,
                owner_company,
                protocol: req.protocol.unwrap_or_else(|| "Custom".to_string()),
                foundational_model: req.foundational_model,
                created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            };
            
            Ok(Json(agent))
        }
        Err(e) => {
            error!("Failed to register agent: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn list_agents(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<AgentResponse>>, StatusCode> {
    // EXTRACT USER FROM JWT TOKEN
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    // Check if admin
    if claims.role == "admin" {
        info!("📋 [ADMIN] Fetching ALL agents");
        return list_all_agents_internal(State(state)).await;
    }
    
    // Regular user - only their agents
    let owner_email = claims.email;
    info!("📋 Fetching agents for user: {}", owner_email);

    let rows = sqlx::query(
        "SELECT 
            id, agent_name, tier, balance, remaining_balance, status,
            spending_limit_daily, spending_limit_per_tx, spending_limit_monthly,
            total_volume, transaction_count, risk_score,
            owner_email, owner_company, protocol, foundational_model, created_at
         FROM agents
         WHERE owner_email = $1
         ORDER BY created_at DESC"
    )
    .bind(&owner_email)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch agents: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let agents: Vec<AgentResponse> = rows
        .iter()
        .map(|row| AgentResponse {
            id: row.get("id"),
            agent_name: row.get("agent_name"),
            tier: row.get("tier"),
            balance: row.get::<rust_decimal::Decimal, _>("balance").to_string().parse().unwrap_or(0.0),
            remaining_balance: row.get::<rust_decimal::Decimal, _>("remaining_balance").to_string().parse().unwrap_or(0.0),
            status: row.get("status"),
            spending_limit_daily: row.get::<rust_decimal::Decimal, _>("spending_limit_daily").to_string().parse().unwrap_or(0.0),
            spending_limit_per_tx: row.get::<rust_decimal::Decimal, _>("spending_limit_per_tx").to_string().parse().unwrap_or(0.0),
            spending_limit_monthly: row.get::<rust_decimal::Decimal, _>("spending_limit_monthly").to_string().parse().unwrap_or(0.0),
            total_volume: row.get::<rust_decimal::Decimal, _>("total_volume").to_string().parse().unwrap_or(0.0),
            transaction_count: row.get("transaction_count"),
            risk_score: row.get("risk_score"),
            owner_email: row.get("owner_email"),
            owner_company: row.get("owner_company"),
            protocol: row.get("protocol"),
            foundational_model: row.get("foundational_model"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();

    info!("✅ Found {} agents for {}", agents.len(), owner_email);
    Ok(Json(agents))
}

async fn list_all_agents_internal(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AgentResponse>>, StatusCode> {
    let rows = sqlx::query(
        "SELECT 
            id, agent_name, tier, balance, remaining_balance, status,
            spending_limit_daily, spending_limit_per_tx, spending_limit_monthly,
            total_volume, transaction_count, risk_score,
            owner_email, owner_company, protocol, foundational_model, created_at
         FROM agents
         ORDER BY created_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch agents: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let agents: Vec<AgentResponse> = rows
        .iter()
        .map(|row| AgentResponse {
            id: row.get("id"),
            agent_name: row.get("agent_name"),
            tier: row.get("tier"),
            balance: row.get::<rust_decimal::Decimal, _>("balance").to_string().parse().unwrap_or(0.0),
            remaining_balance: row.get::<rust_decimal::Decimal, _>("remaining_balance").to_string().parse().unwrap_or(0.0),
            status: row.get("status"),
            spending_limit_daily: row.get::<rust_decimal::Decimal, _>("spending_limit_daily").to_string().parse().unwrap_or(0.0),
            spending_limit_per_tx: row.get::<rust_decimal::Decimal, _>("spending_limit_per_tx").to_string().parse().unwrap_or(0.0),
            spending_limit_monthly: row.get::<rust_decimal::Decimal, _>("spending_limit_monthly").to_string().parse().unwrap_or(0.0),
            total_volume: row.get::<rust_decimal::Decimal, _>("total_volume").to_string().parse().unwrap_or(0.0),
            transaction_count: row.get("transaction_count"),
            risk_score: row.get("risk_score"),
            owner_email: row.get("owner_email"),
            owner_company: row.get("owner_company"),
            protocol: row.get("protocol"),
            foundational_model: row.get("foundational_model"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();

    info!("✅ [ADMIN] Found {} total agents", agents.len());
    Ok(Json(agents))
}

pub async fn get_agent(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<AgentResponse>, StatusCode> {
    info!("🔍 Fetching agent: {}", agent_id);

    let row = sqlx::query(
        "SELECT 
            id, agent_name, tier, balance, remaining_balance, status,
            spending_limit_daily, spending_limit_per_tx, spending_limit_monthly,
            total_volume, transaction_count, risk_score,
            owner_email, owner_company, protocol, foundational_model, created_at
         FROM agents
         WHERE id = $1"
    )
    .bind(&agent_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch agent: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let agent = AgentResponse {
        id: row.get("id"),
        agent_name: row.get("agent_name"),
        tier: row.get("tier"),
        balance: row.get::<rust_decimal::Decimal, _>("balance").to_string().parse().unwrap_or(0.0),
        remaining_balance: row.get::<rust_decimal::Decimal, _>("remaining_balance").to_string().parse().unwrap_or(0.0),
        status: row.get("status"),
        spending_limit_daily: row.get::<rust_decimal::Decimal, _>("spending_limit_daily").to_string().parse().unwrap_or(0.0),
        spending_limit_per_tx: row.get::<rust_decimal::Decimal, _>("spending_limit_per_tx").to_string().parse().unwrap_or(0.0),
        spending_limit_monthly: row.get::<rust_decimal::Decimal, _>("spending_limit_monthly").to_string().parse().unwrap_or(0.0),
        total_volume: row.get::<rust_decimal::Decimal, _>("total_volume").to_string().parse().unwrap_or(0.0),
        transaction_count: row.get("transaction_count"),
        risk_score: row.get("risk_score"),
        owner_email: row.get("owner_email"),
        owner_company: row.get("owner_company"),
        protocol: row.get("protocol"),
        foundational_model: row.get("foundational_model"),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    info!("✅ Agent found");
    Ok(Json(agent))
}

pub async fn delete_agent(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    info!("🗑️ Deleting agent: {}", agent_id);

    let result = sqlx::query("DELETE FROM agents WHERE id = $1")
        .bind(&agent_id)
        .execute(&state.db.pool)
        .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                error!("Agent not found: {}", agent_id);
                return Err(StatusCode::NOT_FOUND);
            }
            info!("✅ Agent deleted");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to delete agent: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_agent_transactions(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<Vec<TransactionResponse>>, StatusCode> {
    info!("📋 Fetching transactions for agent: {}", agent_id);

    let rows = sqlx::query(
        "SELECT 
            t.id, t.merchant_id, t.amount, t.status, t.created_at, t.completed_at,
            m.merchant_name,
            EXISTS(SELECT 1 FROM merchant_agent_blocks WHERE merchant_id = t.merchant_id AND agent_id = t.agent_id) as is_blocked
         FROM transactions t
         JOIN merchants m ON m.id = t.merchant_id
         WHERE t.agent_id = $1
         ORDER BY t.created_at DESC"
    )
    .bind(&agent_id)
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
            merchant_name: row.get("merchant_name"),
            amount: row.get::<rust_decimal::Decimal, _>("amount").to_string().parse().unwrap_or(0.0),
            status: row.get("status"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
            completed_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("completed_at")
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
            is_blocked: row.get("is_blocked"),
        })
        .collect();

    info!("✅ Found {} transactions for agent", transactions.len());
    Ok(Json(transactions))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAgentLimitsRequest {
    pub spending_limit_daily: Option<f64>,
    pub spending_limit_per_tx: Option<f64>,
    pub spending_limit_monthly: Option<f64>,
}

pub async fn update_agent_limits(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    Json(req): Json<UpdateAgentLimitsRequest>,
) -> Result<StatusCode, StatusCode> {
    info!("🔧 Updating limits for agent: {}", agent_id);

    let mut query = String::from("UPDATE agents SET ");
    let mut updates = Vec::new();
    let mut param_count = 1;

    if req.spending_limit_daily.is_some() {
        updates.push(format!("spending_limit_daily = ${}", param_count));
        param_count += 1;
    }
    if req.spending_limit_per_tx.is_some() {
        updates.push(format!("spending_limit_per_tx = ${}", param_count));
        param_count += 1;
    }
    if req.spending_limit_monthly.is_some() {
        updates.push(format!("spending_limit_monthly = ${}", param_count));
        param_count += 1;
    }

    if updates.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    query.push_str(&updates.join(", "));
    query.push_str(&format!(" WHERE id = ${}", param_count));

    let mut q = sqlx::query(&query);
    
    if let Some(daily) = req.spending_limit_daily {
        q = q.bind(daily);
    }
    if let Some(per_tx) = req.spending_limit_per_tx {
        q = q.bind(per_tx);
    }
    if let Some(monthly) = req.spending_limit_monthly {
        q = q.bind(monthly);
    }
    q = q.bind(&agent_id);

    let result = q.execute(&state.db.pool).await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err(StatusCode::NOT_FOUND);
            }
            info!("✅ Agent limits updated");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to update agent limits: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
