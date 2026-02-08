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

check_response() {
    local http_code="$1"
    local step="$2"
    local response="$3"
    if [ "$http_code" -lt 200 ] || [ "$http_code" -gt 204 ]; then
        log_error "$step failed with HTTP status $http_code"
        log_error "Response: $response"
        exit 1
    fi
}

# Configuration
OPENBAO_ADDR="${OPENBAO_ADDR:-https://bao.saas.internal}"
OPENBAO_ROOT_TOKEN="${OPENBAO_ROOT_TOKEN}" # Root or admin token
TENANT_ID="${TENANT_ID}"

if [ -z "$TENANT_ID" ]; then
    log_warn "Usage: $0 <tenant-id>"
    log_warn "Example: $0 tenant0"
    exit 1
fi

if [ -z "$OPENBAO_ROOT_TOKEN" ]; then
    log_error "OPENBAO_ROOT_TOKEN environment variable must be set"
    exit 1
fi

log_info "🔧 Provisioning OpenBao resources for tenant: $TENANT_ID"

# 1. Create namespace for tenant
log_info "📁 Creating OpenBao namespace: $TENANT_ID"
RESPONSE=$(curl -s -w '\n%{http_code}' \
    -X POST \
    -H "X-Vault-Token: $OPENBAO_ROOT_TOKEN" \
    -H "Content-Type: application/json" \
    "$OPENBAO_ADDR/v1/sys/namespaces/$TENANT_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')
check_response "$HTTP_CODE" "Create namespace" "$RESPONSE_BODY"

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

RESPONSE=$(curl -s -w '\n%{http_code}' \
    -X PUT \
    -H "X-Vault-Token: $OPENBAO_ROOT_TOKEN" \
    -H "X-Vault-Namespace: $TENANT_ID" \
    -H "Content-Type: application/json" \
    "$OPENBAO_ADDR/v1/sys/policies/acl/${TENANT_ID}-full-access" \
    -d @- <<EOF
{
  "policy": $(jq -Rs '.' /tmp/${TENANT_ID}-policy.hcl)
}
EOF
)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')
check_response "$HTTP_CODE" "Create policy" "$RESPONSE_BODY"

# 3. Create token for tenant with the policy
log_info "🔑 Creating OpenBao token for $TENANT_ID"
RESPONSE=$(curl -s -w '\n%{http_code}' \
    -X POST \
    -H "X-Vault-Token: $OPENBAO_ROOT_TOKEN" \
    -H "X-Vault-Namespace: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d @- \
    "$OPENBAO_ADDR/v1/auth/token/create" <<EOF
{
  "policies": ["${TENANT_ID}-full-access"],
  "ttl": "0",
  "renewable": true,
  "display_name": "${TENANT_ID}-external-secrets",
  "no_parent": true
}
EOF
)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')
check_response "$HTTP_CODE" "Create token" "$RESPONSE_BODY"
TENANT_TOKEN=$(echo "$RESPONSE_BODY" | jq -r '.auth.client_token')

# 4. Enable KV v2 secrets engine in the namespace (if not already enabled)
log_info "🗄️  Ensuring OpenBao KV v2 secret engine is enabled"
RESPONSE=$(curl -s -w '\n%{http_code}' \
    -X POST \
    -H "X-Vault-Token: $OPENBAO_ROOT_TOKEN" \
    -H "X-Vault-Namespace: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d '{"type": "kv-v2", "description": "KV v2 secrets for '${TENANT_ID}'"}' \
    "$OPENBAO_ADDR/v1/sys/mounts/secrets")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

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

# Optional: Save to file
TENANT_TOKEN_DIR=/tmp/openbao-tokens
mkdir -p $TENANT_TOKEN_DIR
echo "$TENANT_TOKEN" > $TENANT_TOKEN_DIR/${TENANT_ID}-token.txt
echo "Token saved to: $TENANT_TOKEN_DIR/${TENANT_ID}-token.txt. DO NOT RUN this on real production!"
