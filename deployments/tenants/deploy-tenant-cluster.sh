#!/bin/bash
# Example
# DOCKER_HOST_IP=192.168.1.4 ROOT_CA_PATH=./docker/step-ca/certs/root_ca.crt ./deployments/tenants/deploy-tenant-cluster.sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Variables
CLOUDNATIVEPG_VERSION=1.28
CERT_MANAGER_VERSION=v1.14.0
EXTERNAL_DNS_VERSION=1.20.0
INGRESS_NGINX_VERSION=4.14.2

CLUSTER_NAME=$1
DEFAULT_BRANDING=saas
DEFAULT_KUBEVELA_HELM_URI=oci://zot.saas.internal/charts/vela-core:1.10.6-saas.1

BRANDING=$DEFAULT_BRANDING
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

create_cluster() {
    # Create a cluster with the local registry enabled in containerd
    CLUSTER_NAME=$1
    REG_HOST='zot.saas.internal'

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
  # - role: worker
  #   labels:
  #     NodeGroupType: database
EOF

    REGISTRY_DIR="/etc/containerd/certs.d/${REG_HOST}"
    for node in $(kind get nodes --name=${CLUSTER_NAME}); do
        log_info "${node}"
        docker exec "${node}" mkdir -p "${REGISTRY_DIR}"
        cat <<EOF | docker exec -i "${node}" cp /dev/stdin "${REGISTRY_DIR}/hosts.toml"
[host."${REG_HOST}"]
EOF

        # Copy our root CA from StepCA into each kind node
        docker cp $ROOT_CA_PATH $node:/usr/local/share/ca-certificates/zot-ca.crt

        # Update CA trust inside the node
        docker exec $node update-ca-certificates

        # Restart node containerd
        docker exec $node systemctl restart containerd
    done
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
        -n external-secrets \
        --create-namespace \
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
txtOwnerId: saas-cluster
txtPrefix: external-dns-
# annotationFilter: cluster-name=saas-cluster
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


# --------------------------------------------------------------------------------------
log_section "**** Tenant cluster create script ****"
log_empty

check_root_ca
ensure_kubectl
ensure_helm

# Check if cluster already exists
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    log_info "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
else
    create_cluster $CLUSTER_NAME
fi

kubectl create namespace ${SYSTEM_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ${WORKLOAD_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

ensure_cert_manager
ensure_cluster_issuer
ensure_external_secret
ensure_external_dns

ensure_cloudnative_pg

ensure_vela
ensure_kubevela

log_empty
log_info "Tenant cluster creation finished"
