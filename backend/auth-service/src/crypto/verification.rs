use anyhow::{Result, anyhow};
use ed25519_dalek::{VerifyingKey, Signature, Verifier};
use crate::models::transaction::TransactionRequest;

pub struct TransactionVerifier {
    verifying_key: VerifyingKey,
}

impl TransactionVerifier {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != 32 {
            return Err(anyhow!("Invalid public key length"));
        }
        
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(bytes);
        
        let verifying_key = VerifyingKey::from_bytes(&key_bytes)
            .map_err(|e| anyhow!("Invalid public key: {}", e))?;
        
        Ok(Self { verifying_key })
    }
    
    pub fn verify_transaction(&self, tx: &TransactionRequest, signature: &[u8]) -> Result<bool> {
        if signature.len() != 64 {
            return Ok(false);
        }
        
        let mut sig_bytes = [0u8; 64];
        sig_bytes.copy_from_slice(signature);
        
        let signature = Signature::from_bytes(&sig_bytes);
        let message = tx.to_canonical_message();
        
        match self.verifying_key.verify(message.as_bytes(), &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}