#!/bin/bash
set -e

DEST_REGISTRY="zot.saas.internal"

# Image list
IMAGES=(
  docker.io/keycloak/keycloak:26.5.2
  docker.io/postgres:18.0
  docker.io/temporalio/admin-tools:1.29.1-tctl-1.18.4-cli-1.5.0
  ghcr.io/external-secrets/external-secrets:v1.3.2
  ghcr.io/cloudnative-pg/postgresql:18.1-system-trixie
  quay.io/jupyterhub/k8s-singleuser-sample:4.3.2
  quay.io/jupyterhub/k8s-hub:4.3.2
  docker.io/hashicorp/vault:1.21.2
  registry.k8s.io/ingress-nginx/controller:v1.14.2
  registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.6.6
)

echo "Loading container images into zot..."
for src in "${IMAGES[@]}"; do
  # Strip the registry host (first segment) to get the image path
  path="${src#*/}"
  dst="${DEST_REGISTRY}/${path}"
  echo "Copying $src -> $dst"
  crane --insecure copy "$src" "$dst"
done
