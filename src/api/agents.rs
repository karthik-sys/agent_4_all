use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;
use tracing::error;

// Import AppState from main
use crate::AppState;

// ... keep all the Request/Response models the same ...

#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub agent_name: String,
    pub owner_company: String,
    pub owner_email: String,
    pub protocol: String,
    pub foundational_model: Option<String>,
    pub spending_limits: SpendingLimits,
}

#[derive(Debug, Deserialize)]
pub struct SpendingLimits {
    pub per_transaction: f64,
    pub daily: f64,
    pub monthly: f64,
}

#[derive(Debug, Serialize)]
pub struct RegisterAgentResponse {
    pub agent_id: String,
    pub api_key: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct AgentInfo {
    pub id: String,
    pub agent_name: String,
    pub owner_company: String,
    pub owner_email: String,
    pub protocol: String,
    pub foundational_model: Option<String>,
    pub spending_limits: SpendingLimitsResponse,
    pub status: String,
    pub total_volume: f64,
    pub transaction_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct SpendingLimitsResponse {
    pub per_transaction: f64,
    pub daily: f64,
    pub monthly: f64,
}

#[derive(Debug, Serialize)]
pub struct TransactionInfo {
    pub id: String,
    pub amount: Option<f64>,
    pub currency: String,
    pub merchant_id: String,
    pub protocol: String,
    pub status: String,
    pub risk_score: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLimitsRequest {
    pub per_transaction: Option<f64>,
    pub daily: Option<f64>,
    pub monthly: Option<f64>,
}

/// POST /api/v1/agents/register
pub async fn register_agent(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterAgentRequest>,
) -> Result<Json<RegisterAgentResponse>, StatusCode> {
    let agent_id = format!(
        "agent_{}_{}",
        req.protocol.to_lowercase(),
        uuid::Uuid::new_v4().to_string().replace("-", "")[..16].to_string()
    );
    
    let api_key = format!("sk_live_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    
    let result = sqlx::query(
        "INSERT INTO agents (
            id, owner_company, owner_email, protocol, foundational_model,
            spending_limit_per_tx, spending_limit_daily, spending_limit_monthly,
            status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
    )
    .bind(&agent_id)
    .bind(&req.owner_company)
    .bind(&req.owner_email)
    .bind(&req.protocol)
    .bind(&req.foundational_model)
    .bind(rust_decimal::Decimal::from_f64_retain(req.spending_limits.per_transaction).unwrap())
    .bind(rust_decimal::Decimal::from_f64_retain(req.spending_limits.daily).unwrap())
    .bind(rust_decimal::Decimal::from_f64_retain(req.spending_limits.monthly).unwrap())
    .bind("active")
    .bind(Utc::now())
    .execute(&state.db.pool)
    .await;
    
    match result {
        Ok(_) => {
            Ok(Json(RegisterAgentResponse {
                agent_id,
                api_key,
                status: "active".to_string(),
                created_at: Utc::now().to_rfc3339(),
            }))
        }
        Err(e) => {
            error!("Failed to register agent: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/v1/agents
pub async fn list_agents(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AgentInfo>>, StatusCode> {
    let rows = sqlx::query_as::<_, AgentRow>(
        "SELECT 
            id, owner_company, owner_email, protocol, foundational_model,
            spending_limit_per_tx, spending_limit_daily, spending_limit_monthly,
            status, total_volume, transaction_count, created_at
        FROM agents 
        ORDER BY created_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to list agents: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let agents: Vec<AgentInfo> = rows.into_iter().map(|row| {
        AgentInfo {
            id: row.id.clone(),
            agent_name: row.id.clone(),
            owner_company: row.owner_company,
            owner_email: row.owner_email,
            protocol: row.protocol,
            foundational_model: row.foundational_model,
            spending_limits: SpendingLimitsResponse {
                per_transaction: row.spending_limit_per_tx.to_string().parse().unwrap_or(0.0),
                daily: row.spending_limit_daily.to_string().parse().unwrap_or(0.0),
                monthly: row.spending_limit_monthly.to_string().parse().unwrap_or(0.0),
            },
            status: row.status,
            total_volume: row.total_volume.to_string().parse().unwrap_or(0.0),
            transaction_count: row.transaction_count,
            created_at: row.created_at.to_rfc3339(),
        }
    }).collect();
    
    Ok(Json(agents))
}

/// GET /api/v1/agents/{id}
pub async fn get_agent(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<AgentInfo>, StatusCode> {
    let row = sqlx::query_as::<_, AgentRow>(
        "SELECT 
            id, owner_company, owner_email, protocol, foundational_model,
            spending_limit_per_tx, spending_limit_daily, spending_limit_monthly,
            status, total_volume, transaction_count, created_at
        FROM agents 
        WHERE id = $1"
    )
    .bind(&agent_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;
    
    Ok(Json(AgentInfo {
        id: row.id.clone(),
        agent_name: row.id.clone(),
        owner_company: row.owner_company,
        owner_email: row.owner_email,
        protocol: row.protocol,
        foundational_model: row.foundational_model,
        spending_limits: SpendingLimitsResponse {
            per_transaction: row.spending_limit_per_tx.to_string().parse().unwrap_or(0.0),
            daily: row.spending_limit_daily.to_string().parse().unwrap_or(0.0),
            monthly: row.spending_limit_monthly.to_string().parse().unwrap_or(0.0),
        },
        status: row.status,
        total_volume: row.total_volume.to_string().parse().unwrap_or(0.0),
        transaction_count: row.transaction_count,
        created_at: row.created_at.to_rfc3339(),
    }))
}

/// GET /api/v1/agents/{id}/transactions
pub async fn get_agent_transactions(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<Vec<TransactionInfo>>, StatusCode> {
    let rows = sqlx::query_as::<_, TransactionRow>(
        "SELECT 
            id, amount, currency, merchant_id, protocol, status, risk_score, created_at
        FROM transactions 
        WHERE agent_id = $1 
        ORDER BY created_at DESC 
        LIMIT 100"
    )
    .bind(&agent_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to get transactions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let transactions: Vec<TransactionInfo> = rows.into_iter().map(|row| {
        TransactionInfo {
            id: row.id.to_string(),
            amount: row.amount.map(|d| d.to_string().parse().unwrap_or(0.0)),
            currency: row.currency,
            merchant_id: row.merchant_id,
            protocol: row.protocol,
            status: row.status,
            risk_score: row.risk_score,
            created_at: row.created_at.to_rfc3339(),
        }
    }).collect();
    
    Ok(Json(transactions))
}

/// PUT /api/v1/agents/{id}/limits
pub async fn update_agent_limits(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    Json(req): Json<UpdateLimitsRequest>,
) -> Result<StatusCode, StatusCode> {
    let mut updates = Vec::new();
    let mut values: Vec<String> = Vec::new();
    
    if let Some(per_tx) = req.per_transaction {
        updates.push(format!("spending_limit_per_tx = ${}", values.len() + 2));
        values.push(per_tx.to_string());
    }
    
    if let Some(daily) = req.daily {
        updates.push(format!("spending_limit_daily = ${}", values.len() + 2));
        values.push(daily.to_string());
    }
    
    if let Some(monthly) = req.monthly {
        updates.push(format!("spending_limit_monthly = ${}", values.len() + 2));
        values.push(monthly.to_string());
    }
    
    if updates.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    let query = format!(
        "UPDATE agents SET {} WHERE id = $1",
        updates.join(", ")
    );
    
    let mut query_builder = sqlx::query(&query).bind(&agent_id);
    for value in values {
        query_builder = query_builder.bind(rust_decimal::Decimal::from_str_exact(&value).unwrap());
    }
    
    query_builder
        .execute(&state.db.pool)
        .await
        .map_err(|e| {
            error!("Failed to update limits: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    Ok(StatusCode::OK)
}

/// DELETE /api/v1/agents/{id}
pub async fn delete_agent(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("UPDATE agents SET status = 'suspended' WHERE id = $1")
        .bind(&agent_id)
        .execute(&state.db.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::OK)
}

#[derive(sqlx::FromRow)]
struct AgentRow {
    id: String,
    owner_company: String,
    owner_email: String,
    protocol: String,
    foundational_model: Option<String>,
    spending_limit_per_tx: rust_decimal::Decimal,
    spending_limit_daily: rust_decimal::Decimal,
    spending_limit_monthly: rust_decimal::Decimal,
    status: String,
    total_volume: rust_decimal::Decimal,
    transaction_count: i64,
    created_at: chrono::DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct TransactionRow {
    id: uuid::Uuid,
    amount: Option<rust_decimal::Decimal>,
    currency: String,
    merchant_id: String,
    protocol: String,
    status: String,
    risk_score: Option<i32>,
    created_at: chrono::DateTime<Utc>,
}