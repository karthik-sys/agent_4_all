use axum::{extract::State, http::StatusCode, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct MerchantRegisterRequest {
    pub email: String,
    pub password: String,
    pub merchant_name: String,
    pub domain: String,
    pub business_email: Option<String>,
    pub business_address: Option<String>,
    pub checkout_url_pattern: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MerchantLoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct MerchantAuthResponse {
    pub token: String,
    pub merchant: MerchantInfo,
}

#[derive(Debug, Serialize)]
pub struct MerchantInfo {
    pub id: String,
    pub email: String,
    pub merchant_name: String,
    pub domain: String,
    pub status: String,
    pub trust_score: i32,
}

pub async fn merchant_register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MerchantRegisterRequest>,
) -> Result<Json<MerchantAuthResponse>, StatusCode> {
    info!("🏪 Merchant registration attempt: {}", req.email);

    // Hash password
    let password_hash = hash(&req.password, DEFAULT_COST)
        .map_err(|e| {
            error!("Failed to hash password: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Generate API key
    let api_key = format!("mk_live_{}", Uuid::new_v4().to_string().replace("-", ""));

    // Insert merchant
    let merchant_id = Uuid::new_v4();
    let result = sqlx::query(
        "INSERT INTO merchants (
            id, email, password_hash, merchant_name, domain, 
            business_email, business_address, checkout_url_pattern, 
            api_key, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())"
    )
    .bind(&merchant_id)
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.merchant_name)
    .bind(&req.domain)
    .bind(&req.business_email)
    .bind(&req.business_address)
    .bind(&req.checkout_url_pattern)
    .bind(&api_key)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(_) => {
            info!("✅ Merchant registered: {}", req.email);

            // Generate JWT token - FIXED: pass Uuid, email, role
            let token = crate::auth::handlers::generate_token(&merchant_id, &req.email, "merchant")
                .map_err(|e| {
                    error!("Failed to generate token: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(Json(MerchantAuthResponse {
                token,
                merchant: MerchantInfo {
                    id: merchant_id.to_string(),
                    email: req.email,
                    merchant_name: req.merchant_name,
                    domain: req.domain,
                    status: "pending".to_string(),
                    trust_score: 0,
                },
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

pub async fn merchant_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MerchantLoginRequest>,
) -> Result<Json<MerchantAuthResponse>, StatusCode> {
    info!("🔐 Merchant login attempt: {}", req.email);

    // Get merchant
    let row = sqlx::query(
        "SELECT id, email, password_hash, merchant_name, domain, status, trust_score 
         FROM merchants 
         WHERE email = $1"
    )
    .bind(&req.email)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| {
        error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match row {
        Some(row) => {
            let password_hash: String = row.get("password_hash");

            // Verify password
            let valid = verify(&req.password, &password_hash)
                .map_err(|e| {
                    error!("Password verification error: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            if !valid {
                info!("❌ Invalid password for: {}", req.email);
                return Err(StatusCode::UNAUTHORIZED);
            }

            let merchant_id: Uuid = row.get("id");
            let email: String = row.get("email");

            // Generate JWT token - FIXED: pass Uuid, email, role
            let token = crate::auth::handlers::generate_token(&merchant_id, &email, "merchant")
                .map_err(|e| {
                    error!("Failed to generate token: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            info!("✅ Merchant login successful: {}", req.email);

            Ok(Json(MerchantAuthResponse {
                token,
                merchant: MerchantInfo {
                    id: merchant_id.to_string(),
                    email: row.get("email"),
                    merchant_name: row.get("merchant_name"),
                    domain: row.get("domain"),
                    status: row.get("status"),
                    trust_score: row.get("trust_score"),
                },
            }))
        }
        None => {
            info!("❌ Merchant not found: {}", req.email);
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}
