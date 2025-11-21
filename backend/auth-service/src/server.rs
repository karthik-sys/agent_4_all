use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use tracing::info;
use base64::{engine::general_purpose, Engine as _};
use rust_decimal::prelude::ToPrimitive;

use crate::api::handlers;
use crate::crypto::{signing::TransactionSigner, verification::TransactionVerifier};
use crate::db::postgres::Database;
use crate::models::transaction::TransactionRequest;

#[derive(Debug, Deserialize, Serialize)]
pub struct SignRequest {
    pub agent_id: String,
    pub amount: f64,
    pub currency: String,
    pub merchant_id: String,
    pub nonce: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SignResponse {
    pub agent_id: String,
    pub amount: f64,
    pub currency: String,
    pub merchant_id: String,
    pub nonce: String,
    pub timestamp: String,
    pub signature: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct VerifyRequest {
    pub agent_id: String,
    pub amount: f64,
    pub currency: String,
    pub merchant_id: String,
    pub nonce: String,
    pub timestamp: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub authenticated: bool,
    pub authorized: bool,
    pub agent_id: String,
    pub checks: CheckResults,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CheckResults {
    pub signature_valid: bool,
    pub nonce_fresh: bool,
    pub within_spending_limit: bool,
    pub agent_active: bool,
    pub certificate_valid: bool,
}

pub async fn run_server() -> anyhow::Result<()> {
    info!("Starting HTTP server on 0.0.0.0:8080...");

    HttpServer::new(|| {
        let cors = Cors::permissive();
        
        App::new()
            .wrap(cors)
            .route("/health", web::get().to(health_check))
            .route("/auth/sign", web::post().to(sign_transaction))
            .route("/auth/verify", web::post().to(verify_transaction))
            .route("/auth/agent/{agent_id}/public-key", web::get().to(get_public_key))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await?;

    Ok(())
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().body("Auth Service is running")
}

async fn sign_transaction(request: web::Json<SignRequest>) -> impl Responder {
    info!("Signing transaction for agent: {}", request.agent_id);

    let private_key_file = format!("{}.private.key", request.agent_id);
    let private_key_b64 = match std::fs::read_to_string(&private_key_file) {
        Ok(key) => key,
        Err(e) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({"error": format!("Private key not found: {}", e)}));
        }
    };
    
    let private_key_bytes = match general_purpose::STANDARD.decode(private_key_b64.trim()) {
        Ok(bytes) => bytes,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Invalid key format: {}", e)}));
        }
    };

    let timestamp = match chrono::DateTime::parse_from_rfc3339(&request.timestamp) {
        Ok(ts) => ts.with_timezone(&chrono::Utc),
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": format!("Invalid timestamp: {}", e)}));
        }
    };

    let tx_request = TransactionRequest {
        agent_id: request.agent_id.clone(),
        merchant_id: request.merchant_id.clone(),
        amount: request.amount,
        currency: request.currency.clone(),
        nonce: request.nonce.clone(),
        timestamp,
    };

    println!("=== SIGNING MESSAGE ===");
    println!("Message: {}", tx_request.to_canonical_message());
    println!("=======================");

    let signer = match TransactionSigner::from_bytes(&private_key_bytes) {
        Ok(s) => s,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Signer error: {}", e)}));
        }
    };
    
    let signature = match signer.sign_transaction(&tx_request) {
        Ok(sig) => sig,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Signing error: {}", e)}));
        }
    };

    info!("Transaction signed successfully");

    HttpResponse::Ok().json(SignResponse {
        agent_id: request.agent_id.clone(),
        amount: request.amount,
        currency: request.currency.clone(),
        merchant_id: request.merchant_id.clone(),
        nonce: request.nonce.clone(),
        timestamp: request.timestamp.clone(),
        signature: general_purpose::STANDARD.encode(&signature),
    })
}

async fn verify_transaction(request: web::Json<VerifyRequest>) -> impl Responder {
    info!("Verifying transaction for agent: {}", request.agent_id);

    let db = match Database::connect().await {
        Ok(db) => db,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Database error: {}", e)}));
        }
    };

    let agent = match db.get_agent(&request.agent_id).await {
        Ok(agent) => agent,
        Err(e) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({"error": format!("Agent not found: {}", e)}));
        }
    };

    let mut checks = CheckResults {
        signature_valid: false,
        nonce_fresh: false,
        within_spending_limit: false,
        agent_active: false,
        certificate_valid: false,
    };

    checks.nonce_fresh = match db.check_and_store_nonce(&request.agent_id, &request.nonce).await {
        Ok(fresh) => fresh,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Nonce check error: {}", e)}));
        }
    };

    if !checks.nonce_fresh {
        return HttpResponse::Ok().json(VerifyResponse {
            authenticated: false,
            authorized: false,
            agent_id: request.agent_id.clone(),
            checks,
            reason: Some("Nonce already used - replay attack detected".to_string()),
        });
    }

    let timestamp = match chrono::DateTime::parse_from_rfc3339(&request.timestamp) {
        Ok(ts) => ts.with_timezone(&chrono::Utc),
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": format!("Invalid timestamp: {}", e)}));
        }
    };

    let tx_request = TransactionRequest {
        agent_id: request.agent_id.clone(),
        merchant_id: request.merchant_id.clone(),
        amount: request.amount,
        currency: request.currency.clone(),
        nonce: request.nonce.clone(),
        timestamp,
    };

    let signature = match general_purpose::STANDARD.decode(&request.signature) {
        Ok(sig) => sig,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": format!("Invalid signature format: {}", e)}));
        }
    };
    
    let public_key_bytes = match general_purpose::STANDARD.decode(&agent.public_key) {
        Ok(bytes) => bytes,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Invalid public key: {}", e)}));
        }
    };
    
    let verifier = match TransactionVerifier::from_bytes(&public_key_bytes) {
        Ok(v) => v,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Verifier error: {}", e)}));
        }
    };
    
    checks.signature_valid = match verifier.verify_transaction(&tx_request, &signature) {
        Ok(valid) => valid,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Verification error: {}", e)}));
        }
    };

    let agent_limit = agent.spending_limit_per_tx.to_f64().unwrap_or(0.0);
    checks.within_spending_limit = request.amount <= agent_limit;
    checks.agent_active = agent.status == "active";
    checks.certificate_valid = chrono::Utc::now() < agent.expires_at;

    let authenticated = checks.signature_valid && checks.nonce_fresh;
    let authorized = authenticated 
        && checks.within_spending_limit 
        && checks.agent_active 
        && checks.certificate_valid;

    let reason = if !authenticated {
        Some("Authentication failed".to_string())
    } else if !authorized {
        Some("Authorization checks failed".to_string())
    } else {
        None
    };

    info!("Verification complete: authenticated={}, authorized={}", authenticated, authorized);

    HttpResponse::Ok().json(VerifyResponse {
        authenticated,
        authorized,
        agent_id: request.agent_id.clone(),
        checks,
        reason,
    })
}

async fn get_public_key(agent_id: web::Path<String>) -> impl Responder {
    let db = match Database::connect().await {
        Ok(db) => db,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": format!("Database error: {}", e)}));
        }
    };

    let agent = match db.get_agent(&agent_id).await {
        Ok(agent) => agent,
        Err(e) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({"error": format!("Agent not found: {}", e)}));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "agent_id": agent_id.to_string(),
        "public_key": agent.public_key
    }))
}