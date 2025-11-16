use anyhow::{Result, anyhow};
use ed25519_dalek::{SigningKey, Signature, Signer};
use crate::models::transaction::TransactionRequest;

pub struct TransactionSigner {
    signing_key: SigningKey,
}

impl TransactionSigner {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != 32 {
            return Err(anyhow!("Invalid private key length"));
        }
        
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(bytes);
        
        let signing_key = SigningKey::from_bytes(&key_bytes);
        Ok(Self { signing_key })
    }
    
    pub fn sign_transaction(&self, tx: &TransactionRequest) -> Result<Vec<u8>> {
        let message = tx.to_canonical_message();
        let signature: Signature = self.signing_key.sign(message.as_bytes());
        Ok(signature.to_bytes().to_vec())
    }
}