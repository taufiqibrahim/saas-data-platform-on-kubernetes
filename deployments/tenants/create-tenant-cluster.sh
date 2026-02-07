#!/bin/bash

set -e

# -----------------------------------------------------------------------------
# Usage:
# ./deployments/tenants/create-tenant-cluster.sh <CLUSTER_NAME>
# 
# Example:
# ./deployments/tenants/create-tenant-cluster.sh tenant-0
# -----------------------------------------------------------------------------

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Constants
ROOT_CA_PATH=${ROOT_CA_PATH-"./docker/step-ca/certs/root_ca.crt"}
REGISTRY_HOST=${REGISTRY_HOST-'zot.saas.internal'}

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

# --------------------------------------------------------------------------------------

# Variables
CLUSTER_NAME=$1

log_section "**** Tenant cluster create script ****"
log_empty

check_root_ca

# Check if cluster already exists
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    log_info "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
    exit 1
fi

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
REGISTRY_DIR="/etc/containerd/certs.d/${REGISTRY_HOST}"
for node in $(kind get nodes --name=${CLUSTER_NAME}); do
    log_info "${node}"
    docker exec "${node}" mkdir -p "${REGISTRY_DIR}"
    cat <<EOF | docker exec -i "${node}" cp /dev/stdin "${REGISTRY_DIR}/hosts.toml"
[host."${REGISTRY_HOST}"]
EOF

    # Copy our root CA from StepCA into each kind node
    docker cp $ROOT_CA_PATH $node:/usr/local/share/ca-certificates/zot-ca.crt

    # Update CA trust inside the node
    docker exec $node update-ca-certificates

    # Restart node containerd
    docker exec $node systemctl restart containerd
done

log_empty
log_info "Tenant cluster creation finished"
