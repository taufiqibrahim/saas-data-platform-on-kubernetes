#!/bin/bash
# Example
# DOCKER_HOST_IP=192.168.1.4 ./deployments/tenants/deploy-tenant-cluster.sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Constants
ROOT_CA_PATH=${ROOT_CA_PATH-"./docker/step-ca/certs/root_ca.crt"}
REGISTRY_HOST=${REGISTRY_HOST-'zot.saas.internal'}
OPENBAO_HOST=https://bao.saas.internal
STEPCA_BASE_URL=https://ca.saas.internal:9000
DEFAULT_BRANDING=saas
DEFAULT_KUBEVELA_HELM_URI=oci://zot.saas.internal/charts/vela-core:1.10.6-saas.1

# -----------------------------------------------------------------------------
# Variables
CLOUDNATIVEPG_VERSION=1.28
CERT_MANAGER_VERSION=v1.14.0
EXTERNAL_DNS_VERSION=1.20.0
INGRESS_NGINX_VERSION=4.14.2

CLUSTER_NAME=$1

BRANDING=${BRANDING-$DEFAULT_BRANDING}
SYSTEM_NAMESPACE="${BRANDING}-system"
WORKLOAD_NAMESPACE="${BRANDING}-workload"
KUBEVELA_SYSTEM_NAMESPACE=vela-system
KUBEBUILDER_LOGGER_OPTS='{"development":false}'

# -----------------------------------------------------------------------------

log_section() {
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}----------------------------------------------- ${NC}"
}

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

check_root_ca() {
    if [[ -z "$ROOT_CA_PATH" ]]; then
        log_error "Error: Please set the environment variable ROOT_CA_PATH"
        exit 1
    fi
    log_info "✓ ROOT_CA_PATH is set to: $ROOT_CA_PATH"

    if [[ ! -f "$ROOT_CA_PATH" ]]; then
        log_error "Error: Root CA file not found at $ROOT_CA_PATH"
        exit 1
    fi
}

ensure_kubectl() {
    if command -v kubectl >/dev/null 2>&1; then
    log_info "✓ kubectl available"
    else
    log_info "kubectl not installed. Installing..."
    fi
}

ensure_vela() {
    if command -v vela >/dev/null 2>&1; then
    log_info "✓ vela available"
    else
    log_info "vela not installed. Installing..."
    curl -fsSl https://kubevela.io/script/install.sh | bash
    fi
}

ensure_helm() {
    log_empty
    log_info "Adding Helm repositories..."
    helm repo add jetstack https://charts.jetstack.io
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo add argo https://argoproj.github.io/argo-helm
    helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
}

ensure_cert_manager() {
    log_empty
    log_info "Installing cert-manager"
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
    log_info "Installing external secret operator"
    helm upgrade --install external-secrets \
    external-secrets/external-secrets \
        --namespace external-secrets \
        --create-namespace \
        --wait \
        --set global.repository=zot.saas.internal/external-secrets/external-secrets \
        # --set installCRDs=false
}

ensure_external_dns() {
    log_empty
    log_info "Installing external-dns"
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
    log_info "Installing addon CloudNativePG operator..."
    curl -sSfL \
      https://raw.githubusercontent.com/cloudnative-pg/artifacts/release-${CLOUDNATIVEPG_VERSION}/manifests/operator-manifest.yaml | \
      kubectl apply --server-side -f -
}

ensure_kubevela() {
    # Allow user to answer n, but continue
    log_info "Installing KubeVela control plane..."
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
}

bootstrap_external_secret_store() {
    # Configuration
    TENANT_ID="${1}"
    TENANT_KEYVAULT_TOKEN="${2}"
    OPENBAO_CA_CERT="${ROOT_CA_PATH}"
    OPENBAO_HOST="${OPENBAO_HOST:-https://openbao.example.com}"
    TENANT_KEYVAULT_NAMESPACE="${1:-default}"

    # Encode root CA certificate
    ROOT_CA_BASE64=$(cat "$ROOT_CA_PATH" | base64 -w 0)

    if [ -z "$TENANT_ID" ]; then
        log_error "Error: Please set the environment variable TENANT_ID"
        exit 1
    fi

    if [ -z "$TENANT_KEYVAULT_TOKEN" ]; then
        log_error "Error: Please set the environment variable TENANT_KEYVAULT_TOKEN"
        exit 1
    fi

    log_info "Bootstrapping External Secrets for tenant: $TENANT_ID"

    # Create Kubernetes secret containing the OpenBao token
    log_info "Creating Kubernetes secret with OpenBao token"
    kubectl create secret generic openbao-token \
        --from-literal=token="$TENANT_KEYVAULT_TOKEN" \
        --namespace=$WORKLOAD_NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    # 3. Create SecretStore resource
    log_info "Creating SecretStore resource"
    cat <<EOF | kubectl apply -f -
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: openbao
  namespace: ${WORKLOAD_NAMESPACE}
spec:
  provider:
    vault:
      server: "${OPENBAO_HOST}"
      path: "secret"
      version: "v2"
      namespace: "${TENANT_ID}"
      caBundle: "${ROOT_CA_BASE64}"
      auth:
        tokenSecretRef:
          name: "openbao-token"
          key: "token"
    #   tls:
    #     certSecretRef:
    #       namespace: ...
    #       name: "my-cert-secret"
    #       key: "tls.crt"
    #     keySecretRef:
    #       namespace: ...
    #       name: "my-cert-secret"
    #       key: "tls.key"
EOF

    # 4. Verify the SecretStore
    log_info "Verifying SecretStore status..."
    kubectl get secretstore openbao -n ${WORKLOAD_NAMESPACE}
    kubectl wait --for=condition=ready secretstore/openbao -n ${WORKLOAD_NAMESPACE} --timeout=300s || true

    log_info "Tenant ID: $TENANT_ID"
    log_info "Namespace: $NAMESPACE"
    log_info "SecretStore: openbao-${TENANT_ID}"

}


# --------------------------------------------------------------------------------------
log_section "**** Tenant cluster bootstrap script ****"
log_empty

check_root_ca
ensure_kubectl
# ensure_helm

# kubectl create namespace ${SYSTEM_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
# kubectl create namespace ${WORKLOAD_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# ensure_cert_manager
# ensure_cluster_issuer
# ensure_external_secret
# ensure_external_dns

bootstrap_external_secret_store $TENANT_ID $TENANT_KEYVAULT_TOKEN

# ensure_cloudnative_pg
# ensure_vela
# ensure_kubevela

log_empty
log_info "Tenant cluster bootstrap finished"
