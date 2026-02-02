#!/bin/bash
# Example
# DOCKER_HOST_IP=192.168.1.4 ROOT_CA_PATH=./docker/step-ca/certs/root_ca.crt ./deployments/saas/bootstrap/argocd/deploy.sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_section() {
    echo -e "${GREEN}[INFO] $1${NC}"
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

log_section "=== Tenant Cluster Setup Script ==="
log_empty

# Variables - EDIT THESE
DOCKER_HOST_IP="REPLACE_WITH_YOUR_DOCKER_HOST_IP"
ROOT_CA_PATH="REPLACE_WITH_PATH_TO_ROOT_CA_CRT"
EMAIL="admin@saas.internal"

# Configuration
STEPCA_BASE_URL=https://ca.saas.internal:9000
ZOT_REGISTRY="zot.saas.internal"
ZOT_URL="https://${ZOT_REGISTRY}"
SECRET_NAME="zot-registry-creds"

# # Chart versions
# ARGOCD_VERSION=9.3.7
# CERT_MANAGER_VERSION=v1.14.0
# EXTERNAL_DNS_VERSION=1.20.0
# INGRESS_NGINX_VERSION=4.14.2

# Check if variables are set
# if [[ -z "$DOCKER_HOST_IP" ]]; then
#     echo -e "${RED}Error: Please set the environment variable DOCKER_HOST_IP${NC}"
#     exit 1
# fi

# echo -e "${GREEN}✓ DOCKER_HOST_IP is set to: $DOCKER_HOST_IP${NC}"

# if [[ -z "$ROOT_CA_PATH" ]]; then
#     echo -e "${RED}Error: Please set the environment variable ROOT_CA_PATH${NC}"
#     exit 1
# fi
# echo -e "${GREEN}✓ ROOT_CA_PATH is set to: $ROOT_CA_PATH${NC}"

# if [[ ! -f "$ROOT_CA_PATH" ]]; then
#     echo -e "${RED}Error: Root CA file not found at $ROOT_CA_PATH${NC}"
#     exit 1
# fi

# -----------------------------------------------------------------------------
log_empty
log_section "Checking Kubernetes connectivity..."
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || true)
if [[ -z "$CURRENT_CONTEXT" ]]; then
    log_error "Error: No Kubernetes context is set"
    log_empty
    log_info "Available contexts:"
    kubectl config get-contexts -o name 2>/dev/null || echo "  (none found)"
    log_empty
    log_warn "Set a context with: kubectl config use-context <context-name>"
    exit 1
fi
log_info "✓ Current Kubernetes context: ${CURRENT_CONTEXT}"
log_warn "  To change context: kubectl config use-context <context-name>"

if ! kubectl cluster-info &>/dev/null; then
    log_error "Error: Cannot connect to Kubernetes cluster in context '${CURRENT_CONTEXT}'"
    exit 1
fi
log_info "✓ Successfully connected to Kubernetes cluster"

# -----------------------------------------------------------------------------
log_empty
log_section "[Development] labeling nodes..."
kubectl label node tenant-0-cluster-worker node-role.kubernetes.io/default=
kubectl label node tenant-0-cluster-worker2 node-role.kubernetes.io/database=
kubectl taint nodes tenant-0-cluster-worker2 workload=database:NoSchedule --overwrite

# # Add registry to containerd config in Kind nodes
# log_info "[Development] Configuring containerd on Kind nodes..."

# for node in $(kubectl get nodes -o name | cut -d'/' -f2); do
#     log_empty
#     log_info "Configuring node: $node"

#     # Create containerd registry config
#     docker exec "$node" sh -c "cat > /etc/containerd/certs.d/${ZOT_REGISTRY}/hosts.toml <<EOF
# server = \"${ZOT_URL}\"

# [host.\"${ZOT_URL}\"]
#   capabilities = [\"pull\", \"resolve\"]
#   skip_verify = true
# EOF"

#     # Restart containerd
#     docker exec "$node" systemctl restart containerd

#     log_info "Node $node configured successfully"
# done

# echo ""
# echo -e "${GREEN}Adding netnicolaka/netshoot for network debugging...${NC}"
# kubectl apply -f deployments/saas/bootstrap/netshoot.yaml

# # -----------------------------------------------------------------------------
# echo ""
# echo -e "${GREEN}Adding Helm repositories...${NC}"
# helm repo add jetstack https://charts.jetstack.io
# helm repo add external-secrets https://charts.external-secrets.io
# helm repo add argo https://argoproj.github.io/argo-helm
# helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
# helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# # helm repo update

# # -----------------------------------------------------------------------------
# echo ""
# echo -e "${GREEN}Step 1: Installing external secret operator${NC}"
# helm upgrade --install external-secrets \
#    external-secrets/external-secrets \
#     -n external-secrets \
#     --create-namespace \
#     # --set installCRDs=false

# # -----------------------------------------------------------------------------
# # echo ""
# echo -e "${GREEN}Step 1: Installing cert-manager${NC}"
# helm upgrade --install cert-manager jetstack/cert-manager \
#   --namespace cert-manager \
#   --create-namespace \
#   --version ${CERT_MANAGER_VERSION} \
#   --set installCRDs=true \
#   --wait

# # -----------------------------------------------------------------------------
# echo ""
# echo -e "${GREEN}Step 2: Creating step-ca ClusterIssuer${NC}"
# # Encode root CA certificate
# ROOT_CA_BASE64=$(cat "$ROOT_CA_PATH" | base64 -w 0)

# # Create the ClusterIssuer YAML with substitutions
# cat > /tmp/step-ca-clusterissuer.yaml <<EOF
# apiVersion: v1
# kind: Secret
# metadata:
#   name: step-ca-root-cert-secret
#   namespace: cert-manager
# type: Opaque
# data:
#   ca.crt: ${ROOT_CA_BASE64}
# ---
# apiVersion: cert-manager.io/v1
# kind: ClusterIssuer
# metadata:
#   name: step-ca-acme
# spec:
#   acme:
#     server: ${STEPCA_BASE_URL}/acme/acme/directory
#     email: ${EMAIL}
#     privateKeySecretRef:
#       name: step-ca-acme-account-key
#     skipTLSVerify: false
#     caBundle: ${ROOT_CA_BASE64}
#     solvers:
#     - http01:
#         ingress:
#           class: nginx
# EOF

# kubectl apply -f /tmp/step-ca-clusterissuer.yaml
# rm /tmp/step-ca-clusterissuer.yaml

# # -----------------------------------------------------------------------------
# echo ""
# echo -e "${GREEN}Step 3: Installing external-dns${NC}"
# # registry.k8s.io -> trouble with KIND
# # Create external-dns values with substitutions
# # A more complete example with comments can be found in
# # deployments/saas/bootstrap/external-dns/external-dns-coredns-values.yaml
# # Reference: https://kubernetes-sigs.github.io/external-dns/v0.20.0/docs/tutorials/coredns-etcd/#3-configure-externaldns
# cat > /tmp/external-dns-values.yaml <<EOF
# provider:
#   name: coredns
# env:
#   - name: ETCD_URLS
#     value: "http://${DOCKER_HOST_IP}:2379"
# txtOwnerId: saas-cluster
# txtPrefix: external-dns-
# # annotationFilter: cluster-name=saas-cluster
# # domainFilters:
# #   - saas.internal
# sources:
#   - service
#   - ingress
# policy: sync
# logLevel: info
# interval: 1m
# rbac:
#   create: true
# resources:
#   requests:
#     cpu: 100m
#     memory: 64Mi
#   limits:
#     cpu: 200m
#     memory: 128Mi
# EOF
 
# helm upgrade --install external-dns external-dns/external-dns \
#   --namespace external-dns \
#   --create-namespace \
#   --version ${EXTERNAL_DNS_VERSION} \
#   -f /tmp/external-dns-values.yaml \
#   --wait

# # -----------------------------------------------------------------------------
# echo ""
# echo -e "${GREEN}Step 5: Installing NGINX Ingress Controller${NC}"
# cat > /tmp/ingress-nginx-controller-values.yaml <<EOF
# controller:
#   service:
#     type: LoadBalancer
#     # externalIPs:
#     #   - ${DOCKER_HOST_IP}
# EOF
# helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
#   --namespace ingress-nginx \
#   --create-namespace \
#   --version ${INGRESS_NGINX_VERSION} \
#   -f /tmp/ingress-nginx-controller-values.yaml \
#   --wait

# echo ""
# echo -e "${GREEN}=== Installation Complete ===${NC}"
# echo ""
# echo "Getting LoadBalancer IP..."
# LB_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
# echo -e "${YELLOW}LoadBalancer IP: ${LB_IP}${NC}"

# echo ""
# echo -e "${GREEN}Troubleshooting Commands:${NC}"
# echo "Check external-dns logs: kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns"
# echo "Check cert-manager logs: kubectl logs -n cert-manager deployment/cert-manager"

log_empty
log_info "Tenant cluster bootstrap finished"