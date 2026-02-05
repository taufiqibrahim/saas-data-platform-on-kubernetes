#!/bin/bash
# Example
# curl -fsSL https://saas.internal/bootstrap | bash
# DOCKER_HOST_IP=192.168.1.4 ./deployments/tenants/deploy-tenant-cluster.sh

set -e

# Constants
SAAS_BASE_URL=https://saas.internal
SAAS_BOOTSTRAP_URL="${SAAS_BASE_URL}/bootstrap"
USAGE_HELP="Usage: curl -fsSL ${SAAS_BOOTSTRAP_URL} | bash -s -- --workspaceId=<id> --bootstrapToken=<bootstrapToken>"

echo "Bootstrapping SaaS tenant…"

# Parse arguments
TENANT_ID=""
TENANT_TOKEN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --workspaceId=*) TENANT_ID="${1#*=}"; shift ;;
    --bootstrapToken=*) TENANT_TOKEN="${1#*=}"; shift ;;
    *) echo "Unknown option: $1"; echo ${USAGE_HELP}; exit 1 ;;
  esac
done

# Validate
if [ -z "$TENANT_ID" ]; then
  echo "workspaceId is required."
  echo ${USAGE_HELP}
  exit 1
fi

if [ -z "$TENANT_TOKEN" ]; then
  echo "bootstrapToken is required."
  echo ${USAGE_HELP}
  exit 1
fi

if [[ -z "$DOCKER_HOST_IP" ]]; then
  # Try multiple methods
  DOCKER_HOST_IP=$(ip route get 1 | awk '{print $7; exit}') || \
  DOCKER_HOST_IP=$(hostname -I | awk '{print $1}') || \
  DOCKER_HOST_IP="host.docker.internal"  # Fallback for Docker Desktop
fi

export DOCKER_HOST_IP

# Pre-flight checks
command -v kubectl >/dev/null 2>&1 || {
  echo "Error: kubectl not found. Please install kubectl first."
  exit 1
}

kubectl cluster-info >/dev/null 2>&1 || {
  echo "Error: Cannot connect to Kubernetes cluster."
  exit 1
}

echo "🚀 Installing tenant agent for: $TENANT_ID"

# real logic here
echo "Authenticating..."
