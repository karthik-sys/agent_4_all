use ed25519_dalek::{SigningKey, VerifyingKey};

pub struct KeyPairGenerator;

impl KeyPairGenerator {
    pub fn new() -> Self {
        Self
    }
    
    pub fn generate(&self) -> (SigningKey, VerifyingKey) {
        // Generate random 32 bytes for the secret key
        let secret_bytes: [u8; 32] = rand::random();
        let signing_key = SigningKey::from_bytes(&secret_bytes);
        let verifying_key = signing_key.verifying_key();
        (signing_key, verifying_key)
    }
}