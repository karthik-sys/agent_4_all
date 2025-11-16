-- Database Schema for Agent Payment Platform

CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(255) PRIMARY KEY,
    owner_company VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    foundational_model VARCHAR(100),
    public_key TEXT,
    spending_limit_per_tx DECIMAL(15,2) DEFAULT 1000.00,
    spending_limit_daily DECIMAL(15,2) DEFAULT 10000.00,
    spending_limit_monthly DECIMAL(15,2) DEFAULT 100000.00,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    last_transaction_at TIMESTAMP,
    total_volume DECIMAL(15,2) DEFAULT 0.00,
    transaction_count INTEGER DEFAULT 0
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_owner ON agents(owner_email);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id),
    merchant_id VARCHAR(255) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    nonce VARCHAR(255) UNIQUE,
    risk_score INTEGER,
    raw_request JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tx_agent ON transactions(agent_id);
CREATE INDEX idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX idx_tx_status ON transactions(status);
CREATE INDEX idx_tx_created ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS nonces (
    agent_id VARCHAR(255) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (agent_id, nonce)
);

CREATE INDEX idx_nonces_used_at ON nonces(used_at);
