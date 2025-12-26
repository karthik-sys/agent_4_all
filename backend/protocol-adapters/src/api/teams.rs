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
pub struct CreateTeamRequest {
    pub team_name: String,
    pub team_color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddTeamMemberRequest {
    pub agent_id: String,
}

#[derive(Debug, Serialize)]
pub struct TeamResponse {
    pub id: String,
    pub team_name: String,
    pub team_color: String,
    pub member_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TeamWithMembersResponse {
    pub id: String,
    pub team_name: String,
    pub team_color: String,
    pub members: Vec<TeamMemberResponse>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TeamMemberResponse {
    pub agent_id: String,
    pub agent_name: String,
    pub foundational_model: Option<String>,
    pub tier: String,
    pub joined_at: String,
}

pub async fn create_team(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateTeamRequest>,
) -> Result<Json<TeamResponse>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    info!("👥 Creating team '{}' for user {}", req.team_name, claims.email);

    let team_id = Uuid::new_v4();
    let team_color = req.team_color.unwrap_or_else(|| "#3B82F6".to_string());

    sqlx::query(
        "INSERT INTO agent_teams (id, owner_user_id, team_name, team_color, created_at)
         VALUES ($1, $2, $3, $4, NOW())"
    )
    .bind(team_id)
    .bind(user_id)
    .bind(&req.team_name)
    .bind(&team_color)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to create team: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("✅ Team created: {}", team_id);

    Ok(Json(TeamResponse {
        id: team_id.to_string(),
        team_name: req.team_name,
        team_color,
        member_count: 0,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

pub async fn list_teams(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<TeamResponse>>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    info!("📋 Fetching teams for user: {}", claims.email);

    let rows = sqlx::query(
        "SELECT 
            t.id, t.team_name, t.team_color, t.created_at,
            COUNT(tm.agent_id) as member_count
         FROM agent_teams t
         LEFT JOIN agent_team_members tm ON tm.team_id = t.id
         WHERE t.owner_user_id = $1
         GROUP BY t.id, t.team_name, t.team_color, t.created_at
         ORDER BY t.created_at DESC"
    )
    .bind(user_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch teams: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let teams: Vec<TeamResponse> = rows
        .iter()
        .map(|row| TeamResponse {
            id: row.get::<Uuid, _>("id").to_string(),
            team_name: row.get("team_name"),
            team_color: row.get("team_color"),
            member_count: row.get("member_count"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();

    info!("✅ Found {} teams", teams.len());
    Ok(Json(teams))
}

pub async fn get_team_details(
    State(state): State<Arc<AppState>>,
    Path(team_id): Path<String>,
) -> Result<Json<TeamWithMembersResponse>, StatusCode> {
    let team_uuid = Uuid::parse_str(&team_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    info!("🔍 Fetching team details: {}", team_id);

    let team_row = sqlx::query(
        "SELECT id, team_name, team_color, created_at FROM agent_teams WHERE id = $1"
    )
    .bind(team_uuid)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch team: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let member_rows = sqlx::query(
        "SELECT 
            tm.agent_id, tm.joined_at,
            a.agent_name, a.foundational_model, a.tier
         FROM agent_team_members tm
         JOIN agents a ON a.id = tm.agent_id
         WHERE tm.team_id = $1
         ORDER BY tm.joined_at ASC"
    )
    .bind(team_uuid)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch team members: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let members: Vec<TeamMemberResponse> = member_rows
        .iter()
        .map(|row| TeamMemberResponse {
            agent_id: row.get("agent_id"),
            agent_name: row.get("agent_name"),
            foundational_model: row.get("foundational_model"),
            tier: row.get("tier"),
            joined_at: row.get::<chrono::DateTime<chrono::Utc>, _>("joined_at")
                .format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();

    Ok(Json(TeamWithMembersResponse {
        id: team_row.get::<Uuid, _>("id").to_string(),
        team_name: team_row.get("team_name"),
        team_color: team_row.get("team_color"),
        members,
        created_at: team_row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

pub async fn add_team_member(
    State(state): State<Arc<AppState>>,
    Path(team_id): Path<String>,
    Json(req): Json<AddTeamMemberRequest>,
) -> Result<StatusCode, StatusCode> {
    let team_uuid = Uuid::parse_str(&team_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    info!("➕ Adding agent {} to team {}", req.agent_id, team_id);

    sqlx::query(
        "INSERT INTO agent_team_members (team_id, agent_id, joined_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (team_id, agent_id) DO NOTHING"
    )
    .bind(team_uuid)
    .bind(&req.agent_id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to add team member: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("✅ Agent added to team");
    Ok(StatusCode::OK)
}

pub async fn remove_team_member(
    State(state): State<Arc<AppState>>,
    Path((team_id, agent_id)): Path<(String, String)>,
) -> Result<StatusCode, StatusCode> {
    let team_uuid = Uuid::parse_str(&team_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    info!("➖ Removing agent {} from team {}", agent_id, team_id);

    sqlx::query(
        "DELETE FROM agent_team_members WHERE team_id = $1 AND agent_id = $2"
    )
    .bind(team_uuid)
    .bind(&agent_id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to remove team member: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("✅ Agent removed from team");
    Ok(StatusCode::OK)
}

pub async fn delete_team(
    State(state): State<Arc<AppState>>,
    Path(team_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let team_uuid = Uuid::parse_str(&team_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    info!("🗑️ Deleting team: {}", team_id);

    let result = sqlx::query("DELETE FROM agent_teams WHERE id = $1")
        .bind(team_uuid)
        .execute(&state.db.pool)
        .await
        .map_err(|e| {
            error!("Failed to delete team: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    info!("✅ Team deleted");
    Ok(StatusCode::OK)
}

pub async fn get_team_evaluation_history(
    State(state): State<Arc<AppState>>,
    Path(team_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let claims = crate::auth::handlers::extract_user_from_headers(&headers)?;
    
    info!("📜 Fetching evaluation history for team: {}", team_id);

    // Get all evaluation sessions involving this team's agents
    let rows = sqlx::query(
        "SELECT DISTINCT 
            ae.evaluation_session_id,
            ae.item_description,
            MIN(ae.evaluated_at) as evaluated_at
         FROM agent_evaluations ae
         JOIN agents a ON a.id = ae.agent_id
         WHERE ae.team_id = $1 AND a.user_id = $2
         GROUP BY ae.evaluation_session_id, ae.item_description
         ORDER BY MIN(ae.evaluated_at) DESC
         LIMIT 50"
    )
    .bind(uuid::Uuid::parse_str(&team_id).map_err(|_| StatusCode::BAD_REQUEST)?)
    .bind(uuid::Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch evaluation history: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut sessions = Vec::new();

    for row in rows {
        let session_id: String = row.get::<uuid::Uuid, _>("evaluation_session_id").to_string();
        
        // Get all agent evaluations for this session
        let agent_evals = sqlx::query(
            "SELECT 
                ae.agent_id,
                a.agent_name,
                a.foundational_model,
                ae.predicted_price,
                ae.predicted_merchant_id,
                m.merchant_name as predicted_merchant_name,
                ae.predicted_risk_score,
                ae.was_selected
             FROM agent_evaluations ae
             JOIN agents a ON a.id = ae.agent_id
             LEFT JOIN merchants m ON m.id = ae.predicted_merchant_id
             WHERE ae.evaluation_session_id = $1
             ORDER BY ae.predicted_price ASC"
        )
        .bind(uuid::Uuid::parse_str(&session_id).unwrap())
        .fetch_all(&state.db.pool)
        .await
        .unwrap_or_default();

        let agents: Vec<serde_json::Value> = agent_evals
            .iter()
            .map(|r| {
                serde_json::json!({
                    "agent_id": r.get::<String, _>("agent_id"),
                    "agent_name": r.get::<String, _>("agent_name"),
                    "foundational_model": r.get::<String, _>("foundational_model"),
                    "predicted_price": r.get::<rust_decimal::Decimal, _>("predicted_price").to_string().parse::<f64>().unwrap_or(0.0),
                    "predicted_merchant_name": r.get::<Option<String>, _>("predicted_merchant_name"),
                    "predicted_risk_score": r.get::<i32, _>("predicted_risk_score"),
                    "was_selected": r.get::<bool, _>("was_selected"),
                })
            })
            .collect();

        // Get winner and transaction if exists
        let winner = agents.iter().find(|a| a["was_selected"].as_bool().unwrap_or(false));

        let transaction = if let Some(w) = winner {
            let tx_row = sqlx::query(
                "SELECT t.amount, t.status, m.merchant_name
                 FROM transactions t
                 JOIN merchants m ON m.id = t.merchant_id
                 WHERE t.agent_id::text = $1
                 ORDER BY t.created_at DESC
                 LIMIT 1"
            )
            .bind(w["agent_id"].as_str().unwrap())
            .fetch_optional(&state.db.pool)
            .await
            .ok()
            .flatten();

            tx_row.map(|r| {
                serde_json::json!({
                    "amount": r.get::<rust_decimal::Decimal, _>("amount").to_string().parse::<f64>().unwrap_or(0.0),
                    "merchant_name": r.get::<String, _>("merchant_name"),
                    "status": r.get::<String, _>("status"),
                })
            })
        } else {
            None
        };

        sessions.push(serde_json::json!({
            "session_id": session_id,
            "item_description": row.get::<String, _>("item_description"),
            "evaluated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("evaluated_at").to_rfc3339(),
            "agents": agents,
            "winner": winner,
            "transaction": transaction,
        }));
    }

    Ok(Json(sessions))
}
