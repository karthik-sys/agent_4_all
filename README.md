# Multi-Vendor Agentic Finance Security Platform

A universal security and authorization gateway for AI agent commerce.

## Architecture

- **security-gateway/** - Core security library (protocol-agnostic verification)
- **protocol-adapters/** - Interceptors for MCP, ACP, and custom protocols  
- **auth-service/** - Legacy authentication service

## Quick Start
```bash
# Set up database
docker run -d \
  --name agentpay_postgres \
  -e POSTGRES_USER=agentpay_user \
  -e POSTGRES_PASSWORD=agentpay_dev_password \
  -e POSTGRES_DB=agentpay \
  -p 5432:5432 \
  postgres:16-alpine

# Run migrations (see docs/schema.sql)

# Start protocol adapters
cd backend/protocol-adapters
cargo run
```

## Documentation

See `/docs` folder for:
- Architecture overview
- API documentation
- Database schema
- Testing guide

## Status

✅ MCP Interceptor - Working
✅ ACP Interceptor - Working  
✅ Security Gateway - Working
✅ Multi-protocol support - Working
