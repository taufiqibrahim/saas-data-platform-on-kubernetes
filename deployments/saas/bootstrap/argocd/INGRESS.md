# ArgoCD Ingress Setup with step-ca and external-dns

Complete setup for exposing ArgoCD using Ingress with step-ca certificates and automated DNS via external-dns with etcd backend.

## Prerequisites

- Kubernetes cluster with MetalLB configured
- Helm 3.x installed
- step-ca running at `ca.saas.local:9000`
- etcd running on Docker host listening on port 2379
- `root_ca.crt` from your step-ca instance

## Architecture Overview

```
Internet/Network
    ↓
MetalLB (LoadBalancer)
    ↓
Ingress Controller (nginx)
    ↓
ArgoCD Service
    ↓
Certificate: cert-manager → step-ca ACME
    ↓
DNS: external-dns → etcd → CoreDNS
```

## Step 1: Install cert-manager

```bash
# Add cert-manager Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager with CRDs
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.0 \
  --set installCRDs=true
```

Wait for cert-manager to be ready:
```bash
kubectl wait --for=condition=available --timeout=300s \
  deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s \
  deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s \
  deployment/cert-manager-cainjector -n cert-manager
```

## Step 2: Configure step-ca Root Certificate

Create a ConfigMap with your step-ca root certificate:

```bash
# Create namespace for ArgoCD if it doesn't exist
kubectl create namespace argocd

# Create ConfigMap with root CA certificate
kubectl create configmap step-ca-root-cert \
  --from-file=root_ca.crt=/path/to/your/root_ca.crt \
  -n cert-manager
```

## Step 3: Create ClusterIssuer for step-ca

Create `step-ca-clusterissuer.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: step-ca-root-cert-secret
  namespace: cert-manager
type: Opaque
data:
  # Base64 encode your root_ca.crt content
  # cat root_ca.crt | base64 -w 0
  ca.crt: <BASE64_ENCODED_ROOT_CA_CRT>
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: step-ca-acme
spec:
  acme:
    # The step-ca ACME directory URL
    server: https://ca.saas.local:9000/acme/acme/directory
    
    # Email for ACME registration (optional but recommended)
    email: admin@saas.local
    
    # Secret to store the ACME account private key
    privateKeySecretRef:
      name: step-ca-acme-account-key
    
    # Skip TLS verification if using self-signed cert
    # Or configure caBundle to trust step-ca
    skipTLSVerify: false
    
    # Reference to the root CA certificate
    caBundle: <BASE64_ENCODED_ROOT_CA_CRT>
    
    solvers:
    - http01:
        ingress:
          class: nginx
```

Apply the ClusterIssuer:
```bash
# First, encode your root CA certificate
cat /path/to/your/root_ca.crt | base64 -w 0

# Edit the YAML file and replace <BASE64_ENCODED_ROOT_CA_CRT> with the output
kubectl apply -f step-ca-clusterissuer.yaml
```

Verify the ClusterIssuer:
```bash
kubectl get clusterissuer step-ca-acme
kubectl describe clusterissuer step-ca-acme
```

## Step 4: Install external-dns with etcd Backend

Create `external-dns-values.yaml`:

```yaml
# external-dns configuration for etcd backend
provider: coredns

# etcd configuration
extraArgs:
  - --coredns-prefix=/skydns
  
# Environment variables for etcd connection
env:
  - name: ETCD_URLS
    # Point to your Docker host IP where etcd is listening
    value: "http://<DOCKER_HOST_IP>:2379"

# Domain filter - only manage these domains
domainFilters:
  - saas.local

# Source configuration
sources:
  - service
  - ingress

# How external-dns should behave
policy: sync  # or 'upsert-only' for safer approach

# Logging
logLevel: debug
logFormat: text

# Sync interval
interval: 1m

# Registry for tracking ownership
registry: txt
txtOwnerId: k8s-cluster
txtPrefix: external-dns-
```

Install external-dns:
```bash
# Add external-dns Helm repository
helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
helm repo update

# Install external-dns
helm install external-dns external-dns/external-dns \
  --namespace external-dns \
  --create-namespace \
  -f external-dns-values.yaml
```

Verify external-dns:
```bash
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns -f
```

## Step 5: Install NGINX Ingress Controller

```bash
# Add ingress-nginx Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install nginx ingress controller with MetalLB
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

Wait for LoadBalancer IP:
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller -w
```

## Step 6: Install ArgoCD

```bash
# Add ArgoCD Helm repository
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Install ArgoCD
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --set server.service.type=ClusterIP
```

Wait for ArgoCD to be ready:
```bash
kubectl wait --for=condition=available --timeout=300s \
  deployment/argocd-server -n argocd
```

Get initial admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

## Step 7: Create ArgoCD Ingress with Certificate

Create `argocd-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    # Ingress class
    kubernetes.io/ingress.class: nginx
    
    # cert-manager annotation to request certificate
    cert-manager.io/cluster-issuer: step-ca-acme
    
    # NGINX specific annotations for ArgoCD
    nginx.ingress.kubernetes.io/ssl-passthrough: "false"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    
    # external-dns annotation for DNS registration
    external-dns.alpha.kubernetes.io/hostname: argocd.saas.local
    external-dns.alpha.kubernetes.io/ttl: "300"
spec:
  tls:
  - hosts:
    - argocd.saas.local
    secretName: argocd-server-tls
  rules:
  - host: argocd.saas.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
```

Apply the Ingress:
```bash
kubectl apply -f argocd-ingress.yaml
```

## Step 8: Verify the Setup

### Check Certificate

```bash
# Check certificate request
kubectl get certificaterequest -n argocd

# Check certificate
kubectl get certificate -n argocd
kubectl describe certificate argocd-server-tls -n argocd

# Check the actual secret
kubectl get secret argocd-server-tls -n argocd
```

### Check DNS Registration

```bash
# Check external-dns logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=50

# Check etcd for DNS records (from Docker host)
docker exec etcd etcdctl get --prefix /skydns
```

### Check Ingress

```bash
# Get ingress details
kubectl get ingress -n argocd
kubectl describe ingress argocd-server-ingress -n argocd

# Get ingress controller IP
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

### Test Access

```bash
# Test DNS resolution (should resolve to LoadBalancer IP)
nslookup argocd.saas.local

# Test HTTPS access
curl -v https://argocd.saas.local

# Or access via browser
# https://argocd.saas.local
```

## Troubleshooting

### Certificate Issues

1. **Certificate not issuing:**
```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check certificate events
kubectl describe certificate argocd-server-tls -n argocd

# Check certificate request
kubectl describe certificaterequest -n argocd
```

2. **ACME challenge failing:**
```bash
# Check if http01 challenge is accessible
kubectl get challenges -n argocd
kubectl describe challenge -n argocd <challenge-name>

# Ensure step-ca can reach your cluster for ACME validation
```

3. **Trust issues with step-ca:**
```bash
# Verify the root CA is correctly configured
kubectl get secret step-ca-root-cert-secret -n cert-manager -o yaml

# Test connection to step-ca
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -v --cacert /dev/null -k https://ca.saas.local:9000/health
```

### DNS Issues

1. **External-dns not creating records:**
```bash
# Check external-dns logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns -f

# Verify etcd connectivity
kubectl exec -n external-dns deployment/external-dns -- \
  wget -O- http://<DOCKER_HOST_IP>:2379/version
```

2. **Records not in etcd:**
```bash
# List all keys in etcd
docker exec etcd etcdctl get --prefix /skydns --keys-only

# Check specific record
docker exec etcd etcdctl get /skydns/local/saas/argocd
```

### Ingress Issues

1. **502 Bad Gateway:**
```bash
# Check ArgoCD server is running
kubectl get pods -n argocd

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

2. **SSL/TLS issues:**
```bash
# Check certificate in secret
kubectl get secret argocd-server-tls -n argocd -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -text -noout
```

## Alternative: Using Ingress Annotations for Direct TLS

If you want to handle TLS at the ingress level without HTTPS backend:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: step-ca-acme
    # Use HTTP backend instead
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    external-dns.alpha.kubernetes.io/hostname: argocd.saas.local
spec:
  tls:
  - hosts:
    - argocd.saas.local
    secretName: argocd-server-tls
  rules:
  - host: argocd.saas.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 80  # Use HTTP port
```

Then configure ArgoCD to run with `--insecure` flag:

```bash
helm upgrade argocd argo/argo-cd \
  --namespace argocd \
  --reuse-values \
  --set server.extraArgs[0]="--insecure"
```

## Summary

This setup provides:
- ✅ Automated certificate management via cert-manager with step-ca
- ✅ Automated DNS records via external-dns with etcd backend
- ✅ LoadBalancer IP via MetalLB
- ✅ Secure HTTPS access to ArgoCD via NGINX Ingress
- ✅ Full integration with your existing step-ca and etcd infrastructure

Your ArgoCD instance should now be accessible at `https://argocd.saas.local` with a valid certificate from your step-ca instance!
