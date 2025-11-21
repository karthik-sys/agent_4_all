-- First, check current column types
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions';

-- Fix merchant_id to be UUID
ALTER TABLE transactions 
ALTER COLUMN merchant_id TYPE UUID USING merchant_id::UUID;

-- Ensure agent_id is VARCHAR
ALTER TABLE transactions 
ALTER COLUMN agent_id TYPE VARCHAR(255);

-- Add missing columns if they don't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS checkout_url TEXT,
ADD COLUMN IF NOT EXISTS items JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_reason TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Make protocol nullable
ALTER TABLE transactions 
ALTER COLUMN protocol DROP NOT NULL;
