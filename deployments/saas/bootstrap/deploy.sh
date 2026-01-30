#!/bin/bash
# Example
# DOCKER_HOST_IP=192.168.1.4 ROOT_CA_PATH=./docker/step-ca/certs/root_ca.crt ./deployments/saas/bootstrap/argocd/deploy.sh
set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ArgoCD Ingress Setup Script ==="
echo ""

# Variables - EDIT THESE
# DOCKER_HOST_IP="REPLACE_WITH_YOUR_DOCKER_HOST_IP"
# ROOT_CA_PATH="REPLACE_WITH_PATH_TO_ROOT_CA_CRT"
EMAIL="admin@saas.local"

STEPCA_BASE_URL=https://ca.saas.local:9000

# Chart versions
ARGOCD_VERSION=9.3.7
CERT_MANAGER_VERSION=v1.14.0
EXTERNAL_DNS_VERSION=1.20.0
INGRESS_NGINX_VERSION=4.14.2
METALLB_VERSION=v0.15.3

# Check if variables are set
if [[ -z "$DOCKER_HOST_IP" ]]; then
    echo -e "${RED}Error: Please edit the script and set DOCKER_HOST_IP${NC}"
    exit 1
fi

echo -e "${GREEN}✓ DOCKER_HOST_IP is set to: $DOCKER_HOST_IP${NC}"

# Check if METALLB_IP_POOL is set and not empty
if [[ -z "$METALLB_IP_POOL" ]]; then
    echo -e "${RED}Error: METALLB_IP_POOL environment variable is not set${NC}"
    echo ""
    echo "To configure MetalLB IP pool, follow these steps:"
    echo ""
    echo "1. Run this command to inspect your Docker network:"
    echo -e "   ${GREEN}docker inspect kind | jq '.[].IPAM.Config'${NC}"
    echo ""
    echo "2. Look for the IPv4 subnet in the output (e.g., 172.18.0.0/16)"
    echo ""
    echo "3. Choose an IP range from the upper part of that subnet."
    echo "   Example: If subnet is 172.18.0.0/16, you can use:"
    echo -e "   ${GREEN}172.18.255.200-172.18.255.254${NC}"
    echo ""
    echo "4. Set the environment variable:"
    echo -e "   ${GREEN}export METALLB_IP_POOL='172.18.255.200-172.18.255.254'${NC}"
    echo ""
    echo "Note: Choose IPs far from the gateway (usually .0.1) to avoid conflicts"
    exit 1
fi

# Validate the format (basic check)
if [[ ! "$METALLB_IP_POOL" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+-[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: METALLB_IP_POOL format appears invalid${NC}"
    echo "Expected format: 172.18.255.200-172.18.255.254"
    echo "Current value: $METALLB_IP_POOL"
    exit 1
fi

echo -e "${GREEN}✓ METALLB_IP_POOL is set to: $METALLB_IP_POOL${NC}"

if [[ -z "$ROOT_CA_PATH" ]]; then
    echo -e "${RED}Error: Please edit the script and set ROOT_CA_PATH${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ROOT_CA_PATH is set to: $ROOT_CA_PATH${NC}"

if [[ ! -f "$ROOT_CA_PATH" ]]; then
    echo -e "${RED}Error: Root CA file not found at $ROOT_CA_PATH${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Checking Kubernetes connectivity...${NC}"
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || true)
if [[ -z "$CURRENT_CONTEXT" ]]; then
    echo -e "${RED}Error: No Kubernetes context is set${NC}"
    echo ""
    echo "Available contexts:"
    kubectl config get-contexts -o name 2>/dev/null || echo "  (none found)"
    echo ""
    echo -e "${YELLOW}Set a context with: kubectl config use-context <context-name>${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Current Kubernetes context: ${CURRENT_CONTEXT}${NC}"
echo -e "${YELLOW}  To change context: kubectl config use-context <context-name>${NC}"

if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster in context '${CURRENT_CONTEXT}'${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Successfully connected to Kubernetes cluster${NC}"

echo ""
echo -e "${GREEN}Adding netnicolaka/netshoot for network debugging...${NC}"
kubectl apply -f deployments/saas/bootstrap/netshoot.yaml

# echo ""
# echo -e "${GREEN}Adding Helm repositories...${NC}"
# helm repo add jetstack https://charts.jetstack.io
# helm repo add argo https://argoproj.github.io/argo-helm
# helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
# helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# # helm repo update

# echo ""
# echo -e "${GREEN}Step 1: Installing cert-manager${NC}"
# helm upgrade --install cert-manager jetstack/cert-manager \
#   --namespace cert-manager \
#   --create-namespace \
#   --version ${CERT_MANAGER_VERSION} \
#   --set installCRDs=true \
#   --wait

# # echo ""
# # echo -e "${GREEN}Step 2: Creating step-ca ClusterIssuer${NC}"
# # # Encode root CA certificate
# # ROOT_CA_BASE64=$(cat "$ROOT_CA_PATH" | base64 -w 0)

# # # Create the ClusterIssuer YAML with substitutions
# # cat > /tmp/step-ca-clusterissuer.yaml <<EOF
# # apiVersion: v1
# # kind: Secret
# # metadata:
# #   name: step-ca-root-cert-secret
# #   namespace: cert-manager
# # type: Opaque
# # data:
# #   ca.crt: ${ROOT_CA_BASE64}
# # ---
# # apiVersion: cert-manager.io/v1
# # kind: ClusterIssuer
# # metadata:
# #   name: step-ca-acme
# # spec:
# #   acme:
# #     server: ${STEPCA_BASE_URL}/acme/acme/directory
# #     email: ${EMAIL}
# #     privateKeySecretRef:
# #       name: step-ca-acme-account-key
# #     skipTLSVerify: false
# #     caBundle: ${ROOT_CA_BASE64}
# #     solvers:
# #     - http01:
# #         ingress:
# #           class: nginx
# # EOF

# # kubectl apply -f /tmp/step-ca-clusterissuer.yaml
# # rm /tmp/step-ca-clusterissuer.yaml

# # echo ""
# # echo -e "${GREEN}Step 3: Installing external-dns${NC}"
# # # Create external-dns values with substitutions
# # # A more complete example with comments can be found in
# # # deployments/saas/bootstrap/external-dns/external-dns-coredns-values.yaml
# # # Reference: https://kubernetes-sigs.github.io/external-dns/v0.20.0/docs/tutorials/coredns-etcd/#3-configure-externaldns
# # cat > /tmp/external-dns-values.yaml <<EOF
# # provider:
# #   name: coredns
# # env:
# #   - name: ETCD_URLS
# #     value: "http://${DOCKER_HOST_IP}:2379"
# # txtOwnerId: saas-cluster
# # txtPrefix: external-dns-
# # annotationFilter: cluster-name=saas-cluster
# # domainFilters:
# #   - saas.local
# # sources:
# #   - service
# #   - ingress
# # policy: sync
# # logLevel: info
# # interval: 1m
# # rbac:
# #   create: true
# # resources:
# #   requests:
# #     cpu: 100m
# #     memory: 64Mi
# #   limits:
# #     cpu: 200m
# #     memory: 128Mi
# # EOF
 
# # helm upgrade --install external-dns external-dns/external-dns \
# #   --namespace external-dns \
# #   --create-namespace \
# #   --version ${EXTERNAL_DNS_VERSION} \
# #   -f /tmp/external-dns-values.yaml \
# #   --wait

# # echo ""
# # echo -e "${GREEN}Step 4: Installing Metal LB${NC}"

# # echo "Disabling strictARP..."
# # kubectl get configmap kube-proxy -n kube-system -o yaml | \
# #   sed -e "s/strictARP: false/strictARP: true/" | \
# #   kubectl apply -f - -n kube-system

# # # To install MetalLB, apply the manifest:
# # kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/${METALLB_VERSION}/config/manifests/metallb-native.yaml

# # # MetalLB takes ownership of one of the IP addresses in the pool and updates
# # # the *loadBalancer* IP field of the `ingress-nginx` Service accordingly.
# # cat > /tmp/metallb.yaml <<EOF
# # ---
# # apiVersion: metallb.io/v1beta1
# # kind: IPAddressPool
# # metadata:
# #   name: kind-pool
# #   namespace: metallb-system
# # spec:
# #   addresses:
# #   - ${METALLB_IP_POOL}
# # ---
# # apiVersion: metallb.io/v1beta1
# # kind: L2Advertisement
# # metadata:
# #   name: kind-advertisement
# #   namespace: metallb-system
# # EOF

# # # Apply metallb configuration
# # kubectl apply -f /tmp/metallb.yaml

# # echo ""
# # echo -e "${GREEN}Step 5: Installing NGINX Ingress Controller${NC}"
# # helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
# #   --namespace ingress-nginx \
# #   --create-namespace \
# #   --set controller.service.type=LoadBalancer \
# #   --version ${INGRESS_NGINX_VERSION} \
# #   --wait

# # echo ""
# # echo -e "${GREEN}Step 6: Installing ArgoCD${NC}"
# # kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# # helm upgrade --install argocd argo/argo-cd \
# #   --version ${ARGOCD_VERSION} \
# #   --namespace argocd \
# #   -f deployments/saas/bootstrap/argocd/argocd-values.yaml

# # echo ""
# # echo -e "${GREEN}Step 7: Creating ArgoCD Ingress${NC}"
# # kubectl apply -f deployments/saas/bootstrap/argocd/argocd-ingress-nginx.yaml

# # # echo ""
# # # echo -e "${GREEN}Step 9: Waiting for certificate to be issued${NC}"
# # # echo "This may take a few minutes..."
# # # kubectl wait --for=condition=ready certificate/argocd-server-tls -n argocd --timeout=300s || true

# # # echo ""
# # # echo -e "${GREEN}=== Installation Complete ===${NC}"
# # # echo ""
# # # echo "Getting LoadBalancer IP..."
# # # LB_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
# # # echo -e "${YELLOW}LoadBalancer IP: ${LB_IP}${NC}"

# # # echo ""
# # # echo "Getting ArgoCD admin password..."
# # # ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
# # # echo -e "${YELLOW}ArgoCD Admin Password: ${ARGOCD_PASSWORD}${NC}"

# # # echo ""
# # # echo -e "${GREEN}Next Steps:${NC}"
# # # echo "1. Ensure your DNS points argocd.saas.local to ${LB_IP}"
# # # echo "2. Check DNS record in etcd:"
# # # echo "   docker exec etcd etcdctl get /skydns/local/saas/argocd"
# # # echo "3. Access ArgoCD at: https://argocd.saas.local"
# # # echo "   Username: admin"
# # # echo "   Password: ${ARGOCD_PASSWORD}"
# # # echo ""
# # # echo -e "${GREEN}Troubleshooting Commands:${NC}"
# # # echo "Check certificate: kubectl get certificate -n argocd"
# # # echo "Check ingress: kubectl get ingress -n argocd"
# # # echo "Check external-dns logs: kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns"
# # # echo "Check cert-manager logs: kubectl logs -n cert-manager deployment/cert-manager"
