use crate::models::*;
use crate::db::Database;
use anyhow::Result;
use tracing::{info, warn};
use rust_decimal::prelude::ToPrimitive; 

pub struct SecurityGateway {
    db: Database,
}

impl SecurityGateway {
    pub async fn new() -> Result<Self> {
        let db = Database::connect().await?;
        Ok(Self { db })
    }
    
    pub async fn verify(&self, ctx: &SecurityContext) -> Result<VerificationResult> {
        info!("=== Security Gateway Verification ===");
        info!("Agent: {}", ctx.agent_id);
        info!("Protocol: {}", ctx.protocol);
        info!("Amount: {:?} {}", ctx.amount, ctx.currency);
        info!("Merchant: {}", ctx.merchant_id);
        
        let mut checks = SecurityChecks::all_failed();
        
        // 1. Check if agent exists
        let agent = match self.db.get_agent(&ctx.agent_id).await {
            Ok(agent) => {
                checks.agent_exists = true;
                agent
            }
            Err(e) => {
                warn!("Agent not found: {}", e);
                return Ok(VerificationResult::declined(format!("Agent not found: {}", ctx.agent_id)));
            }
        };
        
        // 2. Check agent status
        checks.agent_active = agent.status == "active";
        if !checks.agent_active {
            return Ok(VerificationResult::declined(format!("Agent is {}", agent.status)));
        }
        
        // 3. Check nonce (replay attack prevention)
        checks.nonce_fresh = self.db.check_and_store_nonce(&ctx.agent_id, &ctx.nonce).await?;
        if !checks.nonce_fresh {
            return Ok(VerificationResult::declined("Nonce already used - replay attack detected".to_string()));
        }
        
        // 4. Check spending limits
        if let Some(amount) = ctx.amount {
            // Per-transaction limit
            let per_tx_limit = agent.spending_limit_per_tx.to_f64().unwrap_or(0.0);
            checks.within_per_tx_limit = amount <= per_tx_limit;
            if !checks.within_per_tx_limit {
                return Ok(VerificationResult::declined(
                    format!("Amount ${:.2} exceeds per-transaction limit ${:.2}", amount, per_tx_limit)
                ));
            }
            
            // Daily limit
            let daily_spent = self.db.get_daily_spending(&ctx.agent_id).await?;
            let daily_limit = agent.spending_limit_daily.to_f64().unwrap_or(0.0);
            checks.within_daily_limit = (daily_spent + amount) <= daily_limit;
            if !checks.within_daily_limit {
                return Ok(VerificationResult::declined(
                    format!("Would exceed daily limit ${:.2} (spent: ${:.2})", daily_limit, daily_spent)
                ));
            }
            
            // Monthly limit (placeholder)
            checks.within_monthly_limit = true;
        } else {
            // If amount not known yet (e.g., ACP create-checkout), skip limit checks
            checks.within_per_tx_limit = true;
            checks.within_daily_limit = true;
            checks.within_monthly_limit = true;
        }
        
        // 5. Check merchant (placeholder - no blacklist yet)
        checks.merchant_allowed = true;
        
        // 6. Velocity check
        let recent_tx_count = self.db.count_recent_transactions(&ctx.agent_id, 60).await?;
        checks.velocity_check_passed = recent_tx_count < 10; // Max 10 tx per minute
        if !checks.velocity_check_passed {
            return Ok(VerificationResult::declined(
                format!("Too many transactions: {} in last minute", recent_tx_count)
            ));
        }
        
        // 7. Pattern check (placeholder)
        checks.pattern_normal = true;
        
        // 8. Calculate risk score
        let risk_score = RiskScorer::calculate_risk_score(ctx);
        
        // All checks passed
        info!("✓ All security checks passed");
        info!("Risk score: {:.1}/100", risk_score);
        
        Ok(VerificationResult {
            approved: true,
            reason: None,
            checks,
            risk_score,
        })
    }
    
    pub async fn log_transaction(&self, ctx: &SecurityContext, verification: &VerificationResult) -> Result<()> {
        self.db.log_transaction(ctx, verification).await?;
        Ok(())
    }
}