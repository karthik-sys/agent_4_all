use axum::{extract::Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use base64::{engine::general_purpose, Engine as _};

// Match the transaction structure from auth-service
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct OpenAITransaction {
    pub agent_id: String,
    pub amount: f64,
    pub currency: String,
    pub merchant_id: String,
    pub nonce: String,
    pub timestamp: String,
    pub signature: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProcessResponse {
    pub status: String,
    pub transaction_id: Option<String>,
    pub reason: Option<String>,
    pub checks: CheckResults,
}

#[derive(Debug, Serialize)]
pub struct CheckResults {
    pub authentication: String,
    pub authorization: String,
    pub fraud: String,
}



pub async fn process_payment(
    Json(transaction): Json<OpenAITransaction>,
) -> Result<Json<ProcessResponse>, (StatusCode, String)> {
    println!("=== Processing OpenAI Payment ===");
    println!("Agent ID: {}", transaction.agent_id);
    println!("Amount: {} {}", transaction.amount, transaction.currency);
    println!("Merchant: {}", transaction.merchant_id);
    println!("Nonce: {}", transaction.nonce);

    // Step 1: Fetch agent's public key from auth service
    let client = reqwest::Client::new();
    let public_key_response = client
        .get(format!("http://localhost:8080/auth/agent/{}/public-key", transaction.agent_id))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to fetch public key: {}", e)))?;
    
    let public_key_data: serde_json::Value = public_key_response
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse public key response: {}", e)))?;
    
    let public_key_b64 = public_key_data["public_key"]
        .as_str()
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Invalid public key format".to_string()))?;
    
    let public_key_bytes = general_purpose::STANDARD
        .decode(public_key_b64)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to decode public key: {}", e)))?;
    
    let public_key = VerifyingKey::from_bytes(
        &public_key_bytes.try_into()
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid public key length".to_string()))?
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Invalid public key: {}", e)))?;

    // Step 2: Verify signature
    let signature = transaction.signature.clone().ok_or_else(|| {
        (StatusCode::BAD_REQUEST, "Missing signature".to_string())
    })?;

    let auth_passed = verify_signature(&transaction, &signature, &public_key);
    
    println!("Authentication: {}", if auth_passed { "PASSED" } else { "FAILED" });

    if !auth_passed {
        return Ok(Json(ProcessResponse {
            status: "declined".to_string(),
            transaction_id: None,
            reason: Some("Invalid signature".to_string()),
            checks: CheckResults {
                authentication: "failed".to_string(),
                authorization: "passed".to_string(),
                fraud: "passed".to_string(),
            },
        }));
    }

    let auth_response = call_auth_service(&transaction).await?;

    // CRITICAL: Check BOTH authenticated AND authorized
    if !auth_response.authenticated || !auth_response.authorized {
        let reason = if !auth_response.authenticated {
            format!("Authentication failed: {}", auth_response.reason.unwrap_or_default())
        } else {
            format!("Authorization failed: {}", auth_response.reason.unwrap_or_default())
        };
        
        return Ok(Json(ProcessResponse {
            status: "declined".to_string(),
            transaction_id: None,
            reason: Some(reason),
            checks: CheckResults {
                authentication: if auth_response.authenticated { "passed" } else { "failed" }.to_string(),
                authorization: if auth_response.authorized { "passed" } else { "failed" }.to_string(),
                fraud: "passed".to_string(),
            },
        }));
    }

    // Step 3: OpenAI-specific business logic
    if transaction.amount > 1000.0 {
        return Ok(Json(ProcessResponse {
            status: "declined".to_string(),
            transaction_id: None,
            reason: Some("Amount exceeds OpenAI transaction limit".to_string()),
            checks: CheckResults {
                authentication: "passed".to_string(),
                authorization: "failed".to_string(),
                fraud: "passed".to_string(),
            },
        }));
    }

    // Success!
    println!("Transaction approved!");
    Ok(Json(ProcessResponse {
        status: "approved".to_string(),
        transaction_id: Some(transaction.nonce.clone()),
        reason: None,
        checks: CheckResults {
            authentication: "passed".to_string(),
            authorization: "passed".to_string(),
            fraud: "passed".to_string(),
        },
    }))
}

fn verify_signature(
    transaction: &OpenAITransaction,
    signature: &str,
    public_key: &VerifyingKey,
) -> bool {
    println!("=== Verifying Signature ===");
    println!("Signature (base64): {}", signature);
    
    let signature_bytes = match general_purpose::STANDARD.decode(signature) {
        Ok(bytes) => {
            println!("Decoded {} signature bytes", bytes.len());
            bytes
        },
        Err(e) => {
            println!("Failed to decode signature: {}", e);
            return false;
        }
    };

    // Convert Vec<u8> to [u8; 64] array
    if signature_bytes.len() != 64 {
        println!("Invalid signature length: expected 64 bytes, got {}", signature_bytes.len());
        return false;
    }
    
    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(&signature_bytes);
    
    // In ed25519-dalek 2.0, from_bytes returns Signature directly (not Result)
    let sig = Signature::from_bytes(&sig_array);

    // CRITICAL: Must match auth-service signing format exactly
    let message = format!(
        "{}|{}|{:.2}|{}|{}|{}",
        transaction.agent_id,
        transaction.merchant_id,
        transaction.amount,
        transaction.currency,
        transaction.nonce,
        transaction.timestamp
    );
    
    println!("Message to verify: {}", message);
    
    let result = public_key.verify(message.as_bytes(), &sig).is_ok();
    println!("Verification result: {}", if result { "VALID" } else { "INVALID" });
    println!("===========================");
    
    result
}

#[derive(Debug, Deserialize, Serialize)]
struct AuthServiceResponse {
    authenticated: bool,
    authorized: bool,
    agent_id: String,
    checks: AuthChecks,
    reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct AuthChecks {
    signature_valid: bool,
    nonce_fresh: bool,
    within_spending_limit: bool,
    agent_active: bool,
    certificate_valid: bool,
}

async fn call_auth_service(transaction: &OpenAITransaction) -> Result<AuthServiceResponse, (StatusCode, String)> {
    let client = reqwest::Client::new();
    
    let response = client
        .post("http://localhost:8080/auth/verify")
        .json(transaction)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Auth service error: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err((StatusCode::BAD_GATEWAY, format!("Auth service returned {}: {}", status, body)));
    }

    response
        .json::<AuthServiceResponse>()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse auth response: {}", e)))
}
