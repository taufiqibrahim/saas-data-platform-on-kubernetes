#!/bin/bash
# Example
# ROOT_CA_PATH=./docker/step-ca/certs/root_ca.crt ./deployments/tenants/deploy-tenant-cluster.sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

log_section "**** Tenant cluster create script ****"
log_empty

if [[ -z "$ROOT_CA_PATH" ]]; then
    log_error "Error: Please set the environment variable ROOT_CA_PATH"
    exit 1
fi
log_info "✓ ROOT_CA_PATH is set to: $ROOT_CA_PATH"

if [[ ! -f "$ROOT_CA_PATH" ]]; then
    log_error "Error: Root CA file not found at $ROOT_CA_PATH"
    exit 1
fi

# Create a cluster with the local registry enabled in containerd
REG_HOST='zot.saas.internal'
CLUSTER_NAME='tenant-0-cluster'

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

# # Connect the registry to the cluster network if not already connected
# # This allows kind to bootstrap the network but ensures they're on the same network
# echo "$(docker inspect -f='{{json .NetworkSettings.Networks.kind}}' "${reg_name}")"
# if [ "$(docker inspect -f='{{json .NetworkSettings.Networks.kind}}' "${reg_name}")" = 'null' ]; then
#   docker network connect "kind" "${reg_name}"
# fi

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
    docker exec -it $node update-ca-certificates

    # Restart node containerd
    docker exec -it $node systemctl restart containerd
done

log_empty
log_info "Tenant cluster creation finished"