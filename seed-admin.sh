#!/bin/bash
echo "🔧 Creating default admin account..."
sleep 2

# Correct URL: /auth/register (not /api/v1/auth/register)
curl -X POST http://localhost:8081/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin2@agentguard.com",
    "password": "admin123",
    "full_name": "Admin User"
  }' 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Admin account created successfully!"
    echo "📧 Email: admin2@agentguard.com"
    echo "🔑 Password: admin123"
else
    echo ""
    echo "⚠️  Failed to create admin account. You can register manually at:"
    echo "   http://localhost:3000/auth/register"
fi
