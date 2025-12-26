-- Default admin user for development
-- Email: admin2@agentguard.com
-- Password: admin123
INSERT INTO users (id, email, password_hash, full_name, created_at)
VALUES (
    gen_random_uuid(),
    'admin2@agentguard.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIBYb1O3G2',
    'Admin User',
    NOW()
) ON CONFLICT (email) DO NOTHING;
