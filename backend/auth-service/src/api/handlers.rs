use actix_web::{web, HttpResponse, Responder};
use crate::db::postgres::Database;
use crate::api::responses::{VerifyRequest, VerifyResponse, AuthorizationChecks, AgentResponse, ErrorResponse};
use crate::crypto::verification::TransactionVerifier;
use crate::models::transaction::TransactionRequest;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "auth-service"
    }))
}

pub async fn verify_transaction(
    db: web::Data<Database>,
    req: web::Json<VerifyRequest>,
) -> impl Responder {
    // Parse timestamp
    let timestamp = match chrono::DateTime::parse_from_rfc3339(&req.timestamp) {
        Ok(ts) => ts.with_timezone(&chrono::Utc),
        Err(_) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "invalid_timestamp".to_string(),
                message: "Invalid timestamp format".to_string(),
            });
        }
    };
    
    // Get agent from database
    let agent = match db.get_agent(&req.agent_id).await {
        Ok(a) => a,
        Err(_) => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "agent_not_found".to_string(),
                message: format!("Agent {} not found", req.agent_id),
            });
        }
    };
    
    // Check nonce (replay attack prevention)
    let nonce_fresh = match db.check_and_store_nonce(&req.agent_id, &req.nonce).await {
        Ok(fresh) => fresh,
        Err(_) => false,
    };
    
    if !nonce_fresh {
        return HttpResponse::Forbidden().json(VerifyResponse {
            authenticated: false,
            agent_id: req.agent_id.clone(),
            authorized: false,
            checks: AuthorizationChecks {
                signature_valid: false,
                nonce_fresh: false,
                within_spending_limit: false,
                agent_active: false,
                certificate_valid: false,
            },
            reason: Some("Nonce already used - replay attack detected".to_string()),
        });
    }
    
    // Create transaction request for signature verification
    let tx_request = TransactionRequest {
        agent_id: req.agent_id.clone(),
        merchant_id: req.merchant_id.clone(),
        amount: req.amount,
        currency: req.currency.clone(),
        nonce: req.nonce.clone(),
        timestamp,
    };
    
    // Decode signature
    let signature = match base64::decode(&req.signature) {
        Ok(sig) => sig,
        Err(_) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "invalid_signature".to_string(),
                message: "Invalid base64 signature".to_string(),
            });
        }
    };
    
    // Verify signature
    let public_key_bytes = match base64::decode(&agent.public_key) {
        Ok(bytes) => bytes,
        Err(_) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: "invalid_public_key".to_string(),
                message: "Failed to decode agent public key".to_string(),
            });
        }
    };
    
    let verifier = match TransactionVerifier::from_bytes(&public_key_bytes) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: "verifier_error".to_string(),
                message: "Failed to create verifier".to_string(),
            });
        }
    };
    
    let signature_valid = verifier.verify_transaction(&tx_request, &signature).unwrap_or(false);
    
    // Authorization checks
    let agent_limit = agent.spending_limit_per_tx.to_f64().unwrap_or(0.0);
    let within_spending_limit = req.amount <= agent_limit;
    let agent_active = agent.status == "active";
    let certificate_valid = chrono::Utc::now() < agent.expires_at;
    
    let all_checks_passed = signature_valid && nonce_fresh && within_spending_limit && agent_active && certificate_valid;
    
    let reason = if !signature_valid {
        Some("Invalid signature".to_string())
    } else if !within_spending_limit {
        Some(format!("Amount ${:.2} exceeds limit ${:.2}", req.amount, agent_limit))
    } else if !agent_active {
        Some(format!("Agent status is {}", agent.status))
    } else if !certificate_valid {
        Some("Certificate expired".to_string())
    } else {
        None
    };
    
    HttpResponse::Ok().json(VerifyResponse {
        authenticated: signature_valid,
        agent_id: req.agent_id.clone(),
        authorized: all_checks_passed,
        checks: AuthorizationChecks {
            signature_valid,
            nonce_fresh,
            within_spending_limit,
            agent_active,
            certificate_valid,
        },
        reason,
    })
}

pub async fn get_agent(
    db: web::Data<Database>,
    agent_id: web::Path<String>,
) -> impl Responder {
    match db.get_agent(&agent_id).await {
        Ok(agent) => {
            let response = AgentResponse {
                id: agent.id,
                provider_id: agent.provider_id.to_string(),
                model_version: agent.model_version,
                tier: agent.tier.to_string(),
                status: agent.status,
                spending_limit_daily: agent.spending_limit_daily.to_f64().unwrap_or(0.0),
                spending_limit_per_tx: agent.spending_limit_per_tx.to_f64().unwrap_or(0.0),
                created_at: agent.created_at.to_rfc3339(),
                expires_at: agent.expires_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(_) => {
            HttpResponse::NotFound().json(ErrorResponse {
                error: "agent_not_found".to_string(),
                message: format!("Agent {} not found", agent_id),
            })
        }
    }
}

pub async fn list_agents(db: web::Data<Database>) -> impl Responder {
    match db.list_agents().await {
        Ok(agents) => {
            let response: Vec<AgentResponse> = agents
                .into_iter()
                .map(|agent| AgentResponse {
                    id: agent.id,
                    provider_id: agent.provider_id.to_string(),
                    model_version: agent.model_version,
                    tier: agent.tier.to_string(),
                    status: agent.status,
                    spending_limit_daily: agent.spending_limit_daily.to_f64().unwrap_or(0.0),
                    spending_limit_per_tx: agent.spending_limit_per_tx.to_f64().unwrap_or(0.0),
                    created_at: agent.created_at.to_rfc3339(),
                    expires_at: agent.expires_at.to_rfc3339(),
                })
                .collect();
            HttpResponse::Ok().json(response)
        }
        Err(_) => {
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "database_error".to_string(),
                message: "Failed to fetch agents".to_string(),
            })
        }
    }
}

