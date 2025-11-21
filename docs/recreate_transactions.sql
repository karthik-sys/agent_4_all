-- Backup any important data first, then drop and recreate
DROP TABLE IF EXISTS transactions CASCADE;

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id),
    merchant_id UUID NOT NULL,
    protocol VARCHAR(50),
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
    refunded_at TIMESTAMPTZ,
    refund_reason TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_agent ON transactions(agent_id);
CREATE INDEX idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX idx_tx_status ON transactions(status);
CREATE INDEX idx_tx_created ON transactions(created_at DESC);
