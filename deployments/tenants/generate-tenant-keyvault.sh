#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_empty() {
    echo ""
}

# Configuration
OPENBAO_ADDR="${OPENBAO_ADDR:-https://bao.saas.internal}"
OPENBAO_TOKEN="${OPENBAO_TOKEN}" # Root or admin token
TENANT_ID="${TENANT_ID}"

if [ -z "$TENANT_ID" ]; then
    log_warn "Usage: $0 <tenant-id>"
    log_warn "Example: $0 tenant0"
    exit 1
fi

if [ -z "$OPENBAO_TOKEN" ]; then
    log_error "OPENBAO_TOKEN environment variable must be set"
    exit 1
fi

log_info "🔧 Provisioning OpenBao resources for tenant: $TENANT_ID"

# 1. Create namespace for tenant
log_info "📁 Creating OpenBao namespace: $TENANT_ID"
curl -X POST \
    -H "X-Vault-Token: $OPENBAO_TOKEN" \
    -H "Content-Type: application/json" \
    "$OPENBAO_ADDR/v1/sys/namespaces/$TENANT_ID"

# 2. Create policy for full access to tenant namespace
log_info "📋 Creating OpenBao policy for $TENANT_ID"
cat > /tmp/${TENANT_ID}-policy.hcl <<EOF
# KV v2: secret values
path "secrets/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# KV v2: metadata (REQUIRED for PushSecret)
path "secrets/metadata/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Required by External Secrets Operator
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Optional: allow reading mounts
path "sys/mounts" {
  capabilities = ["read"]
}
EOF

# Upload policy to the tenant namespace
POLICY_CONTENT=$(cat /tmp/${TENANT_ID}-policy.hcl)

curl -X PUT \
    -H "X-Vault-Token: $OPENBAO_TOKEN" \
    -H "X-Vault-Namespace: $TENANT_ID" \
    -H "Content-Type: application/json" \
    "$OPENBAO_ADDR/v1/sys/policies/acl/${TENANT_ID}-full-access" \
    -d @- <<EOF
{
  "policy": $(jq -Rs '.' /tmp/${TENANT_ID}-policy.hcl)
}
EOF

# 3. Create token for tenant with the policy
log_info "🔑 Creating OpenBao token for $TENANT_ID"
TENANT_TOKEN=$(curl -X POST \
    -H "X-Vault-Token: $OPENBAO_TOKEN" \
    -H "X-Vault-Namespace: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d @- \
    "$OPENBAO_ADDR/v1/auth/token/create" <<EOF | jq -r '.auth.client_token'
{
  "policies": ["${TENANT_ID}-full-access"],
  "ttl": "0",
  "renewable": true,
  "display_name": "${TENANT_ID}-external-secrets",
  "no_parent": true
}
EOF
)

# 4. Enable KV v2 secrets engine in the namespace (if not already enabled)
log_info "🗄️  Ensuring OpenBao KV v2 secret engine is enabled"
curl -X POST \
    -H "X-Vault-Token: $OPENBAO_TOKEN" \
    -H "X-Vault-Namespace: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d '{"type": "kv-v2", "description": "KV v2 secrets for '${TENANT_ID}'"}' \
    "$OPENBAO_ADDR/v1/sys/mounts/secrets" 2>/dev/null || echo "Secret engine already exists"

# Clean up
rm -f /tmp/${TENANT_ID}-policy.hcl

echo ""
echo "✅ Tenant provisioning complete!"
echo ""
echo "=========================================="
echo "Tenant ID: $TENANT_ID"
echo "Namespace: $TENANT_ID"
echo "Token: $TENANT_TOKEN"
echo "=========================================="
echo ""
echo "⚠️  Save this token securely! It will be needed for the bootstrap script."
echo ""

# # Optional: Save to file
# echo "$TENANT_TOKEN" > ${TENANT_ID}-token.txt
# echo "Token saved to: ${TENANT_ID}-token.txt"