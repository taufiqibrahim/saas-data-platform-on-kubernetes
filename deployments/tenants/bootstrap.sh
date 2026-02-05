#!/bin/bash
# Bootstrap script for SaaS tenant agent registration
# Example:
#   ./bootstrap.sh --workspaceId=w-123456 --bootstrapToken=abc123xyz
#   curl -fsSL https://saas.internal/bootstrap | bash -s -- --workspaceId=<id> --bootstrapToken=<token>

set -e

# -----------------------------------------------------------------------------
# Colors for output
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Constants - SaaS URLs
# -----------------------------------------------------------------------------
SAAS_BASE_URL="${SAAS_BASE_URL:-https://saas.internal}"
SAAS_CONTROL_PLANE_API_URL="${SAAS_CONTROL_PLANE_API_URL:-http://localhost:5002}"
SAAS_BOOTSTRAP_URL="${SAAS_BASE_URL}/bootstrap"
USAGE_HELP="Usage: curl -fsSL ${SAAS_BOOTSTRAP_URL} | bash -s -- --workspaceId=<id> --bootstrapToken=<token>"

# -----------------------------------------------------------------------------
# Constants - Infrastructure
# -----------------------------------------------------------------------------
ROOT_CA_PATH=${ROOT_CA_PATH-"./docker/step-ca/certs/root_ca.crt"}
REGISTRY_HOST=${REGISTRY_HOST-'zot.saas.internal'}
OPENBAO_HOST=https://bao.saas.internal
STEPCA_BASE_URL=https://ca.saas.internal:9000

# -----------------------------------------------------------------------------
# Constants - Versions
# -----------------------------------------------------------------------------
CLOUDNATIVEPG_VERSION=1.28
CERT_MANAGER_VERSION=v1.14.0
EXTERNAL_DNS_VERSION=1.20.0
EXTERNAL_SECRET_VERSION=v1.3.2
INGRESS_NGINX_VERSION=4.14.2

# -----------------------------------------------------------------------------
# Constants - Namespaces & Branding
# -----------------------------------------------------------------------------
CLUSTER_NAME=$1
DEFAULT_BRANDING=saas
BRANDING=${BRANDING-$DEFAULT_BRANDING}
SYSTEM_NAMESPACE="${BRANDING}-system"
WORKLOAD_NAMESPACE="${BRANDING}-workload"

# -----------------------------------------------------------------------------
# Constants - KubeVela
# -----------------------------------------------------------------------------
DEFAULT_KUBEVELA_HELM_URI=oci://zot.saas.internal/charts/vela-core:1.10.6-saas.1
KUBEVELA_SYSTEM_NAMESPACE=vela-system
KUBEBUILDER_LOGGER_OPTS='{"development":false}'

KUBEVELA_STATIC_ADDON_NAME="static"
KUBEVELA_STATIC_ADDON_TYPE="helm"
KUBEVELA_STATIC_ADDON_ENDPOINT="https://saas.internal/kubevela-addons/"

KUBEVELA_SAAS_ADDON_NAME="saas"
KUBEVELA_SAAS_ADDON_TYPE="git"
KUBEVELA_SAAS_ADDON_ENDPOINT="https://github.com/taufiqibrahim/saas-data-platform-on-kubernetes"
KUBEVELA_SAAS_ADDON_PATH="addons/kubevela-addons"

# -----------------------------------------------------------------------------
# Variables (set by parse_arguments)
# -----------------------------------------------------------------------------
EXT_WORKSPACE_ID=""
BOOTSTRAP_TOKEN=""

# -----------------------------------------------------------------------------
# Logging functions
# -----------------------------------------------------------------------------
log_section() {
    echo ""
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}-----------------------------------------------${NC}"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_empty() {
    echo ""
}

# -----------------------------------------------------------------------------
# Parse command line arguments
# -----------------------------------------------------------------------------
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --workspaceId=*) EXT_WORKSPACE_ID="${1#*=}"; shift ;;
            --bootstrapToken=*) BOOTSTRAP_TOKEN="${1#*=}"; shift ;;
            --help|-h) echo "${USAGE_HELP}"; exit 0 ;;
            *) log_error "Unknown option: $1"; echo "${USAGE_HELP}"; exit 1 ;;
        esac
    done
}

# -----------------------------------------------------------------------------
# Validate required inputs
# -----------------------------------------------------------------------------
validate_inputs() {
    log_info "Validating inputs..."

    if [[ -z "$EXT_WORKSPACE_ID" ]]; then
        log_error "workspaceId is required."
        echo "${USAGE_HELP}"
        exit 1
    fi
    log_info "✓ Workspace ID: ${EXT_WORKSPACE_ID}"

    if [[ -z "$BOOTSTRAP_TOKEN" ]]; then
        log_error "bootstrapToken is required."
        echo "${USAGE_HELP}"
        exit 1
    fi
    log_info "✓ Bootstrap token provided"
}

# -----------------------------------------------------------------------------
# Pre-flight checks for required tools
# -----------------------------------------------------------------------------
preflight_checks() {
    log_info "Running pre-flight checks..."

    # Check kubectl
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl not found. Please install kubectl first."
        exit 1
    fi
    log_info "✓ kubectl available"

    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    log_info "✓ Kubernetes cluster reachable"

    # Check jq
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq not found. Please install jq first."
        exit 1
    fi
    log_info "✓ jq available"

    # Check curl
    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl not found. Please install curl first."
        exit 1
    fi
    log_info "✓ curl available"

    # Detect Docker host IP if not set
    if [[ -z "$DOCKER_HOST_IP" ]]; then
        DOCKER_HOST_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}') || \
        DOCKER_HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
        DOCKER_HOST_IP="host.docker.internal"
        log_info "✓ Docker host IP detected: ${DOCKER_HOST_IP}"
    fi
    export DOCKER_HOST_IP
}

# -----------------------------------------------------------------------------
# Register agent with control plane API
# -----------------------------------------------------------------------------
register_agent() {
    log_info "Registering agent with control plane..."

    local register_url="${SAAS_CONTROL_PLANE_API_URL}/api/v1/agent/register"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${register_url}" \
        -H "Content-Type: application/json" \
        -d "{\"extWorkspaceId\": \"${EXT_WORKSPACE_ID}\", \"token\": \"${BOOTSTRAP_TOKEN}\"}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" != "200" ]]; then
        log_error "Registration failed (HTTP ${HTTP_CODE})"
        echo "$BODY" | jq -r '.message // .' 2>/dev/null || echo "$BODY"
        exit 1
    fi

    log_info "✓ Registration successful"
    log_empty

    # Parse response
    AGENT_UID=$(echo "$BODY" | jq -r '.agentUid')
    WORKSPACE_UID=$(echo "$BODY" | jq -r '.workspaceUid')
    EXT_WORKSPACE_ID_RESP=$(echo "$BODY" | jq -r '.extWorkspaceId')
    MTLS_EXPIRES_AT=$(echo "$BODY" | jq -r '.mtls.expiresAt')

    echo "Agent Details:"
    echo "─────────────────────────────────────"
    echo "  Agent UID:       ${AGENT_UID}"
    echo "  Workspace UID:   ${WORKSPACE_UID}"
    echo "  Workspace ID:    ${EXT_WORKSPACE_ID_RESP}"
    echo "  mTLS Expires:    ${MTLS_EXPIRES_AT}"
    log_empty
}

# -----------------------------------------------------------------------------
# Store mTLS credentials in Kubernetes secret
# -----------------------------------------------------------------------------
store_mtls_secret() {
    log_info "Storing mTLS credentials in Kubernetes secret..."

    # Extract mTLS certificates from response
    local ca_cert=$(echo "$BODY" | jq -r '.mtls.caCert')
    local client_cert=$(echo "$BODY" | jq -r '.mtls.clientCert')
    local client_key=$(echo "$BODY" | jq -r '.mtls.clientKey')

    local secret_name="agent-mtls-${EXT_WORKSPACE_ID}"

    # Create secret
    kubectl create secret generic ${secret_name} \
        --namespace=${SYSTEM_NAMESPACE} \
        --from-literal=ca.crt="${ca_cert}" \
        --from-literal=client.crt="${client_cert}" \
        --from-literal=client.key="${client_key}" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Label the secret for easy identification
    kubectl label secret ${secret_name} \
        --namespace=${SYSTEM_NAMESPACE} \
        --overwrite \
        app.kubernetes.io/managed-by=saas-agent \
        saas.io/workspace-id=${EXT_WORKSPACE_ID} \
        saas.io/agent-uid=${AGENT_UID}

    log_info "✓ mTLS credentials stored"
    log_empty

    echo "Kubernetes Secret:"
    echo "─────────────────────────────────────"
    echo "  Namespace: ${SYSTEM_NAMESPACE}"
    echo "  Secret:    ${secret_name}"
    log_empty
    echo "To view the secret:"
    echo "  kubectl get secret ${secret_name} -n ${SYSTEM_NAMESPACE}"
}

# -----------------------------------------------------------------------------
# Main execution
# -----------------------------------------------------------------------------
log_section "SaaS Tenant Agent Bootstrap"

parse_arguments "$@"
validate_inputs
preflight_checks

log_section "Agent Registration"
register_agent

log_section "Kubernetes Setup"
kubectl create namespace ${SYSTEM_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ${WORKLOAD_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
store_mtls_secret

log_section "Bootstrap Complete"
log_info "Agent is now registered and ready to connect"
log_info "The agent will use mTLS credentials from secret: agent-mtls-${EXT_WORKSPACE_ID}"
log_empty
