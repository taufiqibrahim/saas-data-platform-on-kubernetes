#!/bin/bash
# Example
# DOCKER_HOST_IP=192.168.1.4 ROOT_CA_PATH=./docker/step-ca/certs/root_ca.crt ./deployments/saas/bootstrap/argocd/deploy.sh
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
USAGE_HELP="Usage: TODO"

# -----------------------------------------------------------------------------
# Constants - Infrastructure
# -----------------------------------------------------------------------------
ROOT_CA_PATH=${ROOT_CA_PATH-"./docker/step-ca/certs/root_ca.crt"}
LOCAL_REGISTRY_HOST=${LOCAL_REGISTRY_HOST-'zot.saas.internal'}
OPENBAO_HOST=https://bao.saas.internal
STEPCA_BASE_URL=https://ca.saas.internal:9000

# -----------------------------------------------------------------------------
# Constants - Versions
# -----------------------------------------------------------------------------
ARGOCD_VERSION=9.3.7
CLOUDNATIVEPG_VERSION=1.28
CERT_MANAGER_VERSION=v1.14.0
CONSUL_VERSION=1.9.3
EXTERNAL_DNS_VERSION=1.20.0
EXTERNAL_SECRET_VERSION=v1.3.2
INGRESS_NGINX_VERSION=4.14.2
VAULT_VERSION=0.32.0

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

create_cluster() {
# Check if cluster already exists
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    log_info "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
else
  # Check if cluster already exists
  log_info "Creating cluster '${CLUSTER_NAME}'..."

  cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: false
  ipFamily: ipv4
name: ${CLUSTER_NAME}
nodes:
  - role: control-plane
  - role: worker
    labels:
      NodeGroupType: default
  - role: worker
    labels:
      NodeGroupType: default
#   - role: worker
#     labels:
#       NodeGroupType: default
#   - role: worker
#     labels:
#       NodeGroupType: database
EOF

  # Adding Zot as trusted registry
  REGISTRY_DIR="/etc/containerd/certs.d/${LOCAL_REGISTRY_HOST}"
  for node in $(kind get nodes --name=${CLUSTER_NAME}); do
      log_info "${node}"
      docker exec "${node}" mkdir -p "${REGISTRY_DIR}"
      cat <<EOF | docker exec -i "${node}" cp /dev/stdin "${REGISTRY_DIR}/hosts.toml"
[host."${LOCAL_REGISTRY_HOST}"]
EOF

      # Copy our root CA from StepCA into each kind node
      docker cp $ROOT_CA_PATH $node:/usr/local/share/ca-certificates/zot-ca.crt

      # Update CA trust inside the node
      docker exec $node update-ca-certificates

      # Restart node containerd
      docker exec $node systemctl restart containerd
  done
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

ensure_ingress_nginx() {
  log_empty
  log_info "Installing NGINX Ingress Controller ${INGRESS_NGINX_VERSION}"

  cat > /tmp/ingress-nginx-controller-values.yaml <<EOF
global:
  image:
    # -- Registry host to pull images from.
    registry: ${LOCAL_REGISTRY_HOST}
controller:
  service:
    type: LoadBalancer
EOF
  helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    --version ${INGRESS_NGINX_VERSION} \
    -f /tmp/ingress-nginx-controller-values.yaml \
    --wait
  rm /tmp/ingress-nginx-controller-values.yaml
}

ensure_argocd() {
  log_empty
  log_info "Installing ArgoCD ${ARGOCD_VERSION}"

  kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

  helm upgrade --install argocd argo/argo-cd \
    --version ${ARGOCD_VERSION} \
    --namespace argocd \
    -f deployments/saas/bootstrap/argocd/argocd-values.yaml \
    --set global.image.repository=${LOCAL_REGISTRY_HOST}/argoproj/argocd \
    --wait

  log_empty
  log_info "Creating ArgoCD Ingress..."
  kubectl apply -f deployments/saas/bootstrap/argocd/argocd-ingress-nginx.yaml

  log_empty
  log_info "Waiting for certificate to be issued..."
  log_info "This may take a few minutes..."
  kubectl wait --for=condition=ready certificate/argocd-server-tls -n argocd --timeout=300s || true

  log_info "Getting LoadBalancer IP..."
  LB_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
  log_info "LoadBalancer IP: ${LB_IP}"

  log_info "Getting ArgoCD admin password..."
  ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
  log_info "ArgoCD Admin Password: ${ARGOCD_PASSWORD}"
}

# -----------------------------------------------------------------------------
# Main execution
# -----------------------------------------------------------------------------
log_section "SaaS Cluster Bootstrap"

# Variables
CLUSTER_NAME=$1

preflight_checks
create_cluster
# ensure_helm

log_section "Kubernetes Setup"
kubectl create namespace saas --dry-run=client -o yaml | kubectl apply -f -

# ensure_cert_manager
# ensure_cluster_issuer
# ensure_external_secret
# ensure_external_dns
# ensure_ingress_nginx
ensure_argocd
# ensure_password_generator

# bootstrap_external_secret_store

log_section "SaaS Cluster Bootstrap Complete"
echo "To connect to cluster:
Set kubectl context to "kind-saas"
You can now use your cluster with:

kubectl cluster-info --context kind-saas
"
log_empty

echo ""
echo -e "${GREEN}Troubleshooting Commands:${NC}"
echo "Check certificate: kubectl get certificate -n argocd"
echo "Check ingress: kubectl get ingress -n argocd"
echo "Check external-dns logs: kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns"
echo "Check cert-manager logs: kubectl logs -n cert-manager deployment/cert-manager"
