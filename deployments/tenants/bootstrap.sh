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
SAAS_CONTROL_PLANE_API_URL="${SAAS_CONTROL_PLANE_API_URL:-https://api.saas.internal}"
SAAS_BOOTSTRAP_URL="${SAAS_BASE_URL}/bootstrap"
USAGE_HELP="Usage:

Using curl:
-----------
curl -fsSL ${SAAS_BOOTSTRAP_URL} | bash -s -- --workspaceId=<id> --bootstrapToken=<token>

Using direct execution:
-----------------------
./bootstrap.sh --workspaceId=<id> --bootstrapToken=<token>
"

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
CONSUL_VERSION=1.9.3
EXTERNAL_DNS_VERSION=1.20.0
EXTERNAL_SECRET_VERSION=v1.3.2
INGRESS_NGINX_VERSION=4.14.2
VAULT_VERSION=0.32.0

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

ensure_helm() {
    log_empty
    log_info "Adding Helm repositories..."
    helm repo add hashicorp https://helm.releases.hashicorp.com
    helm repo add infisical-helm-charts 'https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts/'
    helm repo add jetstack https://charts.jetstack.io
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo add argo https://argoproj.github.io/argo-helm
    helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
}

ensure_vela() {
    if command -v vela >/dev/null 2>&1; then
    log_info "✓ vela available"
    else
    log_info "vela not installed. Installing..."
    curl -fsSl https://kubevela.io/script/install.sh | bash
    fi
}


# -----------------------------------------------------------------------------
# Base Kubernetes services
# -----------------------------------------------------------------------------

ensure_cert_manager() {
    log_empty
    log_info "Installing cert-manager ${CERT_MANAGER_VERSION}"
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version ${CERT_MANAGER_VERSION} \
        --set installCRDs=true \
        --wait
}

ensure_cluster_issuer() {
    log_empty
    log_info "Creating step-ca ClusterIssuer"

    # Encode root CA certificate
    ROOT_CA_BASE64=$(cat "$ROOT_CA_PATH" | base64 -w 0)

    # Create the ClusterIssuer YAML with substitutions
    cat > /tmp/step-ca-clusterissuer.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: step-ca-root-cert-secret
  namespace: cert-manager
type: Opaque
data:
  ca.crt: ${ROOT_CA_BASE64}
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: step-ca-acme
spec:
  acme:
    server: ${STEPCA_BASE_URL}/acme/acme/directory
    email: ${EMAIL}
    privateKeySecretRef:
      name: step-ca-acme-account-key
    skipTLSVerify: false
    caBundle: ${ROOT_CA_BASE64}
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

    kubectl apply -f /tmp/step-ca-clusterissuer.yaml
    rm /tmp/step-ca-clusterissuer.yaml
}

ensure_external_secret() {
    log_empty
    log_info "Installing external secret operator ${EXTERNAL_SECRET_VERSION}"
    helm upgrade --install external-secrets \
    external-secrets/external-secrets \
        --namespace external-secrets \
        --create-namespace \
        --version ${EXTERNAL_SECRET_VERSION} \
        --wait \
        # --set global.repository=zot.saas.internal/external-secrets/external-secrets \
        # --set installCRDs=false
}

ensure_external_dns() {
    log_empty
    log_info "Installing external-dns ${EXTERNAL_DNS_VERSION}"
    # registry.k8s.io -> trouble with KIND
    # Create external-dns values with substitutions
    # A more complete example with comments can be found in
    # deployments/saas/bootstrap/external-dns/external-dns-coredns-values.yaml
    # Reference: https://kubernetes-sigs.github.io/external-dns/v0.20.0/docs/tutorials/coredns-etcd/#3-configure-externaldns
    cat > /tmp/external-dns-values.yaml <<EOF
provider:
  name: coredns
env:
  - name: ETCD_URLS
    value: "http://${DOCKER_HOST_IP}:2379"
txtOwnerId: ${CLUSTER_NAME}
txtPrefix: external-dns-
# annotationFilter: cluster-name=${CLUSTER_NAME}
# domainFilters:
#   - saas.internal
sources:
  - service
  - ingress
policy: sync
logLevel: info
interval: 1m
rbac:
  create: true
resources:
  requests:
    cpu: 100m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi
EOF
    
    helm upgrade --install external-dns external-dns/external-dns \
    --namespace external-dns \
    --create-namespace \
    --version ${EXTERNAL_DNS_VERSION} \
    -f /tmp/external-dns-values.yaml \
    --wait

    rm -f /tmp/external-dns-values.yaml
}

ensure_cloudnative_pg() {
    log_info "Installing addon CloudNativePG operator ${CLOUDNATIVEPG_VERSION}..."
    curl -sSfL \
      https://raw.githubusercontent.com/cloudnative-pg/artifacts/release-${CLOUDNATIVEPG_VERSION}/manifests/operator-manifest.yaml | \
      kubectl apply --server-side -f -
}

ensure_kubevela() {
    # Allow user to answer n, but continue
    log_info "Installing KubeVela control plane..."
    rm -rf /tmp/kubevela/
    helm pull $DEFAULT_KUBEVELA_HELM_URI -d /tmp/kubevela --untar
    if ! vela install -f /tmp/kubevela/vela-core -n $KUBEVELA_SYSTEM_NAMESPACE; then
        log_info "KubeVela installation skipped (existing installation preserved). Continuing bootstrap..."
    fi
    rm -rf /tmp/kubevela/

    # VelaUX
    log_info "Installing addon velaux..."
    vela addon enable velaux

    # FluxCD
    log_info "Installing addon fluxcd..."
    vela addon enable fluxcd namespace=$SYSTEM_NAMESPACE

    # Terraform Controller
    log_info "Installing addon terraform..."
    vela addon enable terraform

}

ensure_kubevela_addon_registry() {
    log_info "Adding addon registry"
    vela addon registry add ${KUBEVELA_SAAS_ADDON_NAME} \
        --type ${KUBEVELA_SAAS_ADDON_TYPE} \
        --endpoint=${KUBEVELA_SAAS_ADDON_ENDPOINT} \
        --path=${KUBEVELA_SAAS_ADDON_PATH}

    vela addon registry add ${KUBEVELA_STATIC_ADDON_NAME} \
        --type=${KUBEVELA_STATIC_ADDON_TYPE} \
        --endpoint=${KUBEVELA_STATIC_ADDON_ENDPOINT}

    log_empty
    log_info "Listing current addon registry:"
    vela addon registry list
}

ensure_password_generator() {
    log_info "Creating ClusterGenerator db-password-generator..."
    cat <<EOF | kubectl apply -n ${WORKLOAD_NAMESPACE} -f -
apiVersion: generators.external-secrets.io/v1alpha1
kind: Password
metadata:
  name: db-password-generator
spec:
  length: 16
  digits: 5
  symbols: 3
  symbolCharacters: "-_$@"
  noUpper: false
  allowRepeat: true
EOF
}

# -----------------------------------------------------------------------------
# Register agent with control plane API
# -----------------------------------------------------------------------------
register_agent() {
    log_info "Registering agent with control plane ${SAAS_CONTROL_PLANE_API_URL}..."

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

    local secret_name="agent-mtls-secret"

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

    # Also write to temporary files for development
    log_info "Writing certificates to temporary files for development..."

    local cert_dir="/tmp/tenant-agent/certs"
    mkdir -p "${cert_dir}"

    # Write certificate files
    echo "${ca_cert}" > "${cert_dir}/ca.crt"
    echo "${client_cert}" > "${cert_dir}/client.crt"
    echo "${client_key}" > "${cert_dir}/client.key"

    log_info "Certificates written to ${cert_dir}/"
}

bootstrap_external_secret_store() {
    # Configuration
    # TENANT_ID="${1}"
    # TENANT_KEYVAULT_TOKEN="${2}"
    # OPENBAO_CA_CERT="${ROOT_CA_PATH}"
    # OPENBAO_HOST="${OPENBAO_HOST:-https://openbao.example.com}"
    # TENANT_KEYVAULT_NAMESPACE="${1:-default}"

    # # Encode root CA certificate
    # ROOT_CA_BASE64=$(cat "$ROOT_CA_PATH" | base64 -w 0)

    # if [ -z "$TENANT_ID" ]; then
    #     log_error "Error: Please set the environment variable TENANT_ID"
    #     exit 1
    # fi

    # if [ -z "$TENANT_KEYVAULT_TOKEN" ]; then
    #     log_error "Error: Please set the environment variable TENANT_KEYVAULT_TOKEN"
    #     exit 1
    # fi

    log_info "Bootstrapping External Secrets for tenant: $TENANT_ID"

    # Create Kubernetes secret containing the OpenBao token
    log_info "Creating Kubernetes secret with OpenBao token"
    # kubectl create secret generic openbao-token \
    #     --from-literal=token="$TENANT_KEYVAULT_TOKEN" \
    #     --namespace=$WORKLOAD_NAMESPACE \
    #     --dry-run=client -o yaml | kubectl apply -f -

    # 3. Create SecretStore resource
    log_info "Creating SecretStore resource"
#     cat <<EOF | kubectl apply -f -
# apiVersion: external-secrets.io/v1
# kind: SecretStore
# metadata:
#   name: openbao
#   namespace: ${WORKLOAD_NAMESPACE}
# spec:
#   provider:
#     vault:
#       server: "${OPENBAO_HOST}"
#       path: "secrets"
#       version: "v2"
#       namespace: "${TENANT_ID}"
#       caBundle: "${ROOT_CA_BASE64}"
#       auth:
#         tokenSecretRef:
#           name: "openbao-token"
#           key: "token"
# EOF

    # 4. Verify the SecretStore
    log_info "Verifying SecretStore status..."
    # kubectl get secretstore bootstrap -n ${WORKLOAD_NAMESPACE}
    # kubectl get secretstore openbao -n ${WORKLOAD_NAMESPACE}
    # kubectl wait --for=condition=ready secretstore/openbao -n ${WORKLOAD_NAMESPACE} --timeout=300s || true

    # log_info "Tenant ID: $TENANT_ID"
    # log_info "Namespace: $NAMESPACE"
    # log_info "SecretStore: openbao-${TENANT_ID}"

}

deploy_tenant_workspace_controller() {
  log_info "Deploying tenant-agent-controller"

  # Create ConfigMap with controller configuration
  log_info "Creating ConfigMap tenant-agent-controller-config..."

  kubectl create configmap tenant-agent-controller-config \
    --namespace=${SYSTEM_NAMESPACE} \
    --from-literal=LOG_LEVEL=info \
    --from-literal=DEV_MODE=false \
    --from-literal=CONTROL_PLANE_BASE_URL=${SAAS_CONTROL_PLANE_API_URL} \
    --from-literal=CONTROLLER_TIMER_INTERVAL=30 \
    --from-literal=PLATFORM_GROUP=platform.saas.internal \
    --from-literal=PLATFORM_VERSION=v1alpha1 \
    --from-literal=VELA_SYSTEM_NAMESPACE=${KUBEVELA_SYSTEM_NAMESPACE} \
    --from-literal=VELA_ADDON_REGISTRY_NAME=${KUBEVELA_STATIC_ADDON_NAME} \
    --from-literal=WORKSPACE_ID=${EXT_WORKSPACE_ID} \
    --from-literal=WORKLOAD_NAMESPACE=${WORKLOAD_NAMESPACE} \
    --dry-run=client -o yaml | kubectl apply -f -

  log_info "✓ ConfigMap created"

  # Apply the controller deployment manifest
  log_info "Applying tenant-agent-controller manifest..."
  curl -fsSL ${SAAS_BASE_URL}/tenants/tenant-agent-controller.yaml \
    | kubectl apply -n ${SYSTEM_NAMESPACE} -f -
  log_info "✓ tenant-agent-controller deployed"
}

# -----------------------------------------------------------------------------
# Main execution
# -----------------------------------------------------------------------------
log_section "SaaS Tenant Agent Bootstrap"

parse_arguments "$@"
# validate_inputs
# preflight_checks
# ensure_helm
# ensure_vela

log_section "Kubernetes Setup"
# kubectl create namespace ${SYSTEM_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
# kubectl create namespace ${WORKLOAD_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# ensure_cert_manager
# ensure_cluster_issuer
# ensure_external_secret
# ensure_external_dns
# ensure_password_generator
# ensure_cloudnative_pg
# ensure_kubevela
# ensure_kubevela_addon_registry

# bootstrap_external_secret_store

log_section "Agent Registration"
register_agent
store_mtls_secret

log_section "Tenant Workspace Controller Setup"
# bootstrap_external_secret_store $TENANT_ID $TENANT_KEYVAULT_TOKEN
deploy_tenant_workspace_controller

log_section "Bootstrap Complete"
log_empty
