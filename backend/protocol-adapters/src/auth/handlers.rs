use axum::{
    extract::State,
    http::{StatusCode, HeaderMap},
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;

const JWT_SECRET: &[u8] = b"your-secret-key-change-in-production";

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // user_id
    pub email: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
}

pub fn generate_token(user_id: &Uuid, email: &str, role: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        exp: expiration,
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET))
}

pub fn verify_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

pub fn extract_user_from_headers(headers: &HeaderMap) -> Result<Claims, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    verify_token(token).map_err(|_| StatusCode::UNAUTHORIZED)
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    info!("📝 Registration attempt: {}", req.email);

    let password_hash = hash(&req.password, DEFAULT_COST)
        .map_err(|e| {
            error!("Failed to hash password: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let user_id = Uuid::new_v4();
    
    let result = sqlx::query(
        "INSERT INTO users (id, email, password_hash, full_name, role, created_at) 
         VALUES ($1, $2, $3, $4, 'user', NOW())"
    )
    .bind(&user_id)
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.full_name)
    .execute(&state.db.pool)
    .await;

    match result {
        Ok(_) => {
            info!("✅ User registered: {}", req.email);

            let token = generate_token(&user_id, &req.email, "user")
                .map_err(|e| {
                    error!("Failed to generate token: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(Json(AuthResponse {
                token,
                user: UserInfo {
                    id: user_id.to_string(),
                    email: req.email,
                    full_name: req.full_name,
                    role: "user".to_string(),
                },
            }))
        }
        Err(e) => {
            error!("Failed to register user: {}", e);
            if e.to_string().contains("duplicate key") {
                Err(StatusCode::CONFLICT)
            } else {
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    info!("🔐 Login attempt: {}", req.email);

    let row = sqlx::query(
        "SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1"
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

            let valid = verify(&req.password, &password_hash)
                .map_err(|e| {
                    error!("Password verification error: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            if !valid {
                info!("❌ Invalid password for: {}", req.email);
                return Err(StatusCode::UNAUTHORIZED);
            }

            let user_id: Uuid = row.get("id");
            let email: String = row.get("email");
            let role: String = row.get("role");

            let token = generate_token(&user_id, &email, &role)
                .map_err(|e| {
                    error!("Failed to generate token: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            info!("✅ Login successful: {}", req.email);

            Ok(Json(AuthResponse {
                token,
                user: UserInfo {
                    id: user_id.to_string(),
                    email: row.get("email"),
                    full_name: row.get("full_name"),
                    role,
                },
            }))
        }
        None => {
            info!("❌ User not found: {}", req.email);
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}
