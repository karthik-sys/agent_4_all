use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::info;
use tracing_subscriber;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;

mod crypto;
mod db;
mod models;
mod api;
mod server;

use crate::crypto::{keypair::KeyPairGenerator, signing::TransactionSigner, verification::TransactionVerifier};
use crate::db::postgres::Database;
use crate::models::{agent::AgentTier, transaction::TransactionRequest};

#[derive(Parser)]
#[command(name = "auth-service")]
#[command(about = "AgentPay Zero Trust Authentication Service", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start HTTP server
    Serve,
    
    /// Register a new agent
    RegisterAgent {
        #[arg(long)]
        provider: String,
        #[arg(long)]
        model: String,
        #[arg(long)]
        tier: String,
        #[arg(long)]
        daily_limit: f64,
        #[arg(long)]
        tx_limit: f64,
    },
    
    /// List all agents
    ListAgents,
    
    /// Sign a transaction (simulate agent behavior)
    SignTransaction {
        #[arg(long)]
        agent_id: String,
        #[arg(long)]
        merchant: String,
        #[arg(long)]
        amount: f64,
        #[arg(long, default_value = "USD")]
        currency: String,
    },
    
    /// Verify a transaction signature
    VerifyTransaction {
        #[arg(long)]
        transaction_file: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Load environment variables
    dotenv::dotenv().ok();

    let cli = Cli::parse();

    match cli.command {
        Commands::Serve => {
            crate::server::run_server().await?;
        }
        
        Commands::RegisterAgent {
            provider,
            model,
            tier,
            daily_limit,
            tx_limit,
        } => {
            // Connect to database
            let db = Database::connect().await?;
            info!("Connected to database");
            register_agent(&db, &provider, &model, &tier, daily_limit, tx_limit).await?;
        }
        
        Commands::ListAgents => {
            let db = Database::connect().await?;
            info!("Connected to database");
            list_agents(&db).await?;
        }
        
        Commands::SignTransaction {
            agent_id,
            merchant,
            amount,
            currency,
        } => {
            let db = Database::connect().await?;
            info!("Connected to database");
            sign_transaction(&db, &agent_id, &merchant, amount, &currency).await?;
        }
        
        Commands::VerifyTransaction { transaction_file } => {
            let db = Database::connect().await?;
            info!("Connected to database");
            verify_transaction(&db, &transaction_file).await?;
        }
    }

    Ok(())
}

async fn register_agent(
    db: &Database,
    provider_name: &str,
    model_version: &str,
    tier_str: &str,
    daily_limit: f64,
    tx_limit: f64,
) -> Result<()> {
    info!("Registering new agent...");
    
    // Parse tier
    let tier: AgentTier = tier_str.parse()?;
    
    // Generate keypair
    let keypair_gen = KeyPairGenerator::new();
    let (private_key, public_key) = keypair_gen.generate();
    
    // Create agent ID
    let agent_id = format!("agent_{}_{}", provider_name, hex::encode(&rand::random::<[u8; 8]>()));
    
    // Generate a simple certificate (in production, use proper X.509)
    let certificate = format!(
        "-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----",
        base64::encode(public_key.as_bytes())
    );
    
    // Get provider ID
    let provider_id = db.get_provider_id_by_name(provider_name).await?;
    
    // Store in database
    db.create_agent(
        &agent_id,
        &provider_id,
        model_version,
        &base64::encode(public_key.as_bytes()),
        &certificate,
        tier.clone(),
        Decimal::from_f64_retain(daily_limit).unwrap(),
        Decimal::from_f64_retain(tx_limit).unwrap(),
    ).await?;
    
    // Save private key to file (in production, this would be stored securely)
    let private_key_file = format!("{}.private.key", agent_id);
    std::fs::write(&private_key_file, base64::encode(private_key.as_bytes()))?;
    
    println!("\n✅ Agent registered successfully!");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Agent ID:       {}", agent_id);
    println!("Provider:       {}", provider_name);
    println!("Model:          {}", model_version);
    println!("Tier:           {:?}", tier);
    println!("Daily Limit:    ${:.2}", daily_limit);
    println!("TX Limit:       ${:.2}", tx_limit);
    println!("Private Key:    {} (KEEP SECRET!)", private_key_file);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    Ok(())
}

async fn list_agents(db: &Database) -> Result<()> {
    info!("Fetching all agents...");
    
    let agents = db.list_agents().await?;
    
    println!("\n📋 Registered Agents");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if agents.is_empty() {
        println!("No agents registered yet.");
    } else {
        for agent in agents {
            println!("Agent ID:       {}", agent.id);
            println!("Provider:       {}", agent.provider_id);
            println!("Model:          {}", agent.model_version);
            println!("Tier:           {:?}", agent.tier);
            println!("Status:         {}", agent.status);
            println!("Daily Limit:    ${:.2}", agent.spending_limit_daily.to_f64().unwrap_or(0.0));
            println!("TX Limit:       ${:.2}", agent.spending_limit_per_tx.to_f64().unwrap_or(0.0));
            println!("Expires:        {}", agent.expires_at);
            println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        }
    }
    
    Ok(())
}

async fn sign_transaction(
    _db: &Database,
    agent_id: &str,
    merchant_id: &str,
    amount: f64,
    currency: &str,
) -> Result<()> {
    info!("Signing transaction for agent: {}", agent_id);
    
    // Load agent's private key
    let private_key_file = format!("{}.private.key", agent_id);
    let private_key_b64 = std::fs::read_to_string(&private_key_file)?;
    let private_key_bytes = base64::decode(private_key_b64.trim())?;
    
    // Create transaction request
    let nonce = hex::encode(&rand::random::<[u8; 16]>());
    let timestamp = chrono::Utc::now();
    
    let tx_request = TransactionRequest {
        agent_id: agent_id.to_string(),
        merchant_id: merchant_id.to_string(),
        amount,
        currency: currency.to_string(),
        nonce: nonce.clone(),
        timestamp,
    };
    
    // Sign the transaction
    let signer = TransactionSigner::from_bytes(&private_key_bytes)?;
    let signature = signer.sign_transaction(&tx_request)?;
    
    // Create JSON output
    let output = serde_json::json!({
        "agent_id": agent_id,
        "merchant_id": merchant_id,
        "amount": amount,
        "currency": currency,
        "nonce": nonce,
        "timestamp": timestamp.to_rfc3339(),
        "signature": base64::encode(&signature),
    });
    
    // Save to file
    let filename = format!("transaction_{}.json", nonce);
    std::fs::write(&filename, serde_json::to_string_pretty(&output)?)?;
    
    println!("\n✅ Transaction signed successfully!");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Agent:          {}", agent_id);
    println!("Merchant:       {}", merchant_id);
    println!("Amount:         {} {}", amount, currency);
    println!("Nonce:          {}", nonce);
    println!("File:           {}", filename);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    Ok(())
}

async fn verify_transaction(
    db: &Database,
    transaction_file: &str,
) -> Result<()> {
    info!("Verifying transaction from: {}", transaction_file);
    
    // Load transaction
    let tx_json = std::fs::read_to_string(transaction_file)?;
    let tx_data: serde_json::Value = serde_json::from_str(&tx_json)?;
    
    let agent_id = tx_data["agent_id"].as_str().unwrap();
    let merchant_id = tx_data["merchant_id"].as_str().unwrap();
    let amount = tx_data["amount"].as_f64().unwrap();
    let currency = tx_data["currency"].as_str().unwrap();
    let nonce = tx_data["nonce"].as_str().unwrap();
    let timestamp_str = tx_data["timestamp"].as_str().unwrap();
    let signature_b64 = tx_data["signature"].as_str().unwrap();
    
    let timestamp = chrono::DateTime::parse_from_rfc3339(timestamp_str)?
        .with_timezone(&chrono::Utc);
    
    let signature = base64::decode(signature_b64)?;
    
    // Get agent from database
    let agent = db.get_agent(agent_id).await?;
    
    // Check nonce (prevents replay attacks)
    let nonce_is_fresh = db.check_and_store_nonce(agent_id, nonce).await?;
    
    if !nonce_is_fresh {
        println!("\n🔐 Transaction Verification");
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("Agent:          {}", agent_id);
        println!("Merchant:       {}", merchant_id);
        println!("Amount:         {} {}", amount, currency);
        println!("Nonce:          {}", nonce);
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("❌ NONCE ALREADY USED - REPLAY ATTACK DETECTED");
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        return Ok(());
    }
    
    // Create transaction request
    let tx_request = TransactionRequest {
        agent_id: agent_id.to_string(),
        merchant_id: merchant_id.to_string(),
        amount,
        currency: currency.to_string(),
        nonce: nonce.to_string(),
        timestamp,
    };
    
    // Verify signature
    let public_key_bytes = base64::decode(&agent.public_key)?;
    let verifier = TransactionVerifier::from_bytes(&public_key_bytes)?;
    let is_valid = verifier.verify_transaction(&tx_request, &signature)?;
    
    println!("\n🔐 Transaction Verification");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Agent:          {}", agent_id);
    println!("Merchant:       {}", merchant_id);
    println!("Amount:         {} {}", amount, currency);
    println!("Nonce:          {}", nonce);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if is_valid {
        println!("✅ SIGNATURE VALID");
        println!("✅ Agent authenticated");
        
        // Additional checks
        println!("\n📋 Authorization Checks:");
        
        let mut all_checks_passed = true;
        
        // Check spending limit
        let agent_limit = agent.spending_limit_per_tx.to_f64().unwrap_or(0.0);
        if amount <= agent_limit {
            println!("✅ Amount within transaction limit (${:.2})", agent_limit);
        } else {
            println!("❌ Amount exceeds transaction limit (${:.2})", agent_limit);
            all_checks_passed = false;
        }
        
        // Check agent status
        if agent.status == "active" {
            println!("✅ Agent status is active");
        } else {
            println!("❌ Agent status is: {}", agent.status);
            all_checks_passed = false;
        }
        
        // Check expiration
        if chrono::Utc::now() < agent.expires_at {
            println!("✅ Certificate not expired (expires: {})", agent.expires_at);
        } else {
            println!("❌ Certificate expired on {}", agent.expires_at);
            all_checks_passed = false;
        }
        
        // Final decision
        if all_checks_passed {
            println!("\n✅ TRANSACTION AUTHORIZED");
        } else {
            println!("\n❌ TRANSACTION REJECTED - Authorization checks failed");
        }
    } else {
        println!("❌ SIGNATURE INVALID - TRANSACTION REJECTED");
    }
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    Ok(())
}