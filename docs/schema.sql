-- Database Schema for Agent Payment Platform

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    agent_name VARCHAR(255),
    owner_company VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    foundational_model VARCHAR(100),
    public_key TEXT,
    spending_limit_per_tx DECIMAL(15,2) DEFAULT 1000.00,
    spending_limit_daily DECIMAL(15,2) DEFAULT 10000.00,
    spending_limit_monthly DECIMAL(15,2) DEFAULT 100000.00,
    tier VARCHAR(50) DEFAULT 'bronze',
    balance DECIMAL(15,2) DEFAULT 0.00,
    remaining_balance DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'active',
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_transaction_at TIMESTAMP,
    total_volume DECIMAL(15,2) DEFAULT 0.00,
    transaction_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_email);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id),
    merchant_id UUID NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    nonce VARCHAR(255) UNIQUE,
    risk_score INTEGER,
    raw_request JSONB,
    checkout_url TEXT,
    items JSONB,
    metadata JSONB,
    refunded BOOLEAN DEFAULT FALSE,
    refunded_at TIMESTAMP,
    refund_reason TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_agent ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS nonces (
    agent_id VARCHAR(255) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (agent_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_nonces_used_at ON nonces(used_at);

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    merchant_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    business_email VARCHAR(255),
    business_address TEXT,
    checkout_url_pattern TEXT,
    api_key TEXT UNIQUE,
    trust_score INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

CREATE TABLE IF NOT EXISTS merchant_agent_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    agent_id VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    blocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(merchant_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_blocks ON merchant_agent_blocks(merchant_id, agent_id);

CREATE TABLE IF NOT EXISTS agent_block_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    agent_id VARCHAR(255) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    refund_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_block_requests_status ON agent_block_requests(status);
CREATE INDEX IF NOT EXISTS idx_block_requests_merchant ON agent_block_requests(merchant_id);

CREATE TABLE IF NOT EXISTS agent_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    banned_by UUID NOT NULL REFERENCES users(id),
    merchant_id UUID REFERENCES merchants(id),
    transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_agent ON agent_blacklist(agent_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    agent_id VARCHAR(255),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Agent Teams for organizing agents
CREATE TABLE IF NOT EXISTS agent_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    team_color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Team memberships
CREATE TABLE IF NOT EXISTS agent_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id, agent_id)
);

-- Agent evaluation results
CREATE TABLE IF NOT EXISTS agent_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_session_id UUID NOT NULL,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    predicted_price DECIMAL(10,2),
    predicted_merchant_id UUID REFERENCES merchants(id),
    predicted_risk_score INT DEFAULT 0,
    was_selected BOOLEAN DEFAULT FALSE,
    evaluation_details JSONB,
    evaluated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_session ON agent_evaluations(evaluation_session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_agent ON agent_evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON agent_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_agent ON agent_team_members(agent_id);
