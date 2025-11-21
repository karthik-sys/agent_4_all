-- Agent Block Requests table (for merchant requests that need admin approval)
CREATE TABLE IF NOT EXISTS agent_block_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    agent_id VARCHAR(255) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id), -- merchant user who requested
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied
    refund_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    admin_notes TEXT
);

-- Agent Blacklist table (permanent bans approved by admin)
CREATE TABLE IF NOT EXISTS agent_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    banned_by UUID NOT NULL REFERENCES users(id), -- admin who approved
    merchant_id UUID REFERENCES merchants(id), -- merchant who requested
    transaction_id UUID REFERENCES transactions(id), -- related transaction
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add refund tracking to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_block_requests_status ON agent_block_requests(status);
CREATE INDEX IF NOT EXISTS idx_block_requests_merchant ON agent_block_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_agent ON agent_blacklist(agent_id);
