# Troubleshooting Guide for ArgoCD Ingress Setup

## Quick Diagnosis Commands

```bash
# Check all components status
kubectl get pods -n cert-manager
kubectl get pods -n external-dns
kubectl get pods -n ingress-nginx
kubectl get pods -n argocd

# Check ingress and certificate
kubectl get ingress -n argocd
kubectl get certificate -n argocd
kubectl get clusterissuer step-ca-acme
```

## Common Issues and Solutions

### 1. Certificate Failed To Be Issued

**Symptoms:**
- Certificate stuck in "Pending" state
- No certificate secret created

**Diagnosis:**
```bash
# Check certificates
kubectl get certificate -A
NAMESPACE   NAME                READY   SECRET              AGE
argocd      argocd-server-tls   False   argocd-server-tls   7m53

# Check certificate status
kubectl describe certificate argocd-server-tls -n argocd

# Check certificate request
kubectl get certificaterequest -n argocd
kubectl describe certificaterequest -n argocd <name>

# Check ACME challenge
kubectl get challenges -n argocd
kubectl describe challenge -n argocd <name>

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager --tail=100
```

**Common Causes:**

#### A. step-ca cannot reach the cluster for HTTP-01 challenge
```bash
# Test if step-ca can access the challenge endpoint
# The challenge will be at: http://argocd.saas.local/.well-known/acme-challenge/<token>

# Check if ingress is accessible from step-ca host
curl -v http://<LOADBALANCER_IP>/.well-known/acme-challenge/test
```

**Solution:** Ensure step-ca can reach your Kubernetes LoadBalancer IP. You may need to:
- Update firewall rules
- Configure DNS properly
- Ensure network connectivity between step-ca and K8s cluster

#### B. Incorrect caBundle or skipTLSVerify settings
```bash
# Verify the root CA certificate is correct
kubectl get secret step-ca-root-cert-secret -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d

# Compare with your actual root_ca.crt
diff <(kubectl get secret step-ca-root-cert-secret -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d) <(cat /path/to/root_ca.crt)
```

**Solution:** If the certificate doesn't match, recreate the secret:
```bash
kubectl delete secret step-ca-root-cert-secret -n cert-manager
kubectl create secret generic step-ca-root-cert-secret \
  --from-file=ca.crt=/path/to/root_ca.crt \
  -n cert-manager
kubectl delete clusterissuer step-ca-acme
kubectl apply -f step-ca-clusterissuer.yaml
```

#### C. ACME account registration failed
```bash
# Check ClusterIssuer events
kubectl describe clusterissuer step-ca-acme

# Look for errors like "failed to verify ACME account"
```

**Solution:** Delete the ACME account key and let cert-manager recreate it:
```bash
kubectl delete secret step-ca-acme-account-key -n cert-manager
kubectl delete certificaterequest -n argocd --all
kubectl delete order -n argocd --all
kubectl delete challenge -n argocd --all
kubectl delete certificate argocd-server-tls -n argocd
kubectl apply -f argocd-ingress.yaml
```

### 2. DNS Records Not Created in etcd

**Symptoms:**
- No DNS records appearing in etcd
- Domain doesn't resolve

**Diagnosis:**
```bash
# Check external-dns logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=100 -f

# Check etcd for records
docker exec etcd etcdctl get --prefix /skydns

# Check specific record
docker exec etcd etcdctl get /skydns/local/saas/argocd
```

**Common Causes:**

#### A. Cannot connect to etcd
```bash
# Find the external-dns pod
ubectl -n external-dns get pod
NAME                           READY   STATUS    RESTARTS   AGE
external-dns-78c77bcd8-zvfdr   1/1     Running   0          4h14m

# Get the log
kubectl -n external-dns logs external-dns-78c77bcd8-zvfdr

{"level":"warn","ts":"2026-01-29T16:37:00.022004Z","logger":"etcd-client","caller":"v3@v3.6.6/retry_interceptor.go:65","msg":"retrying of unary invoker failed","target":"etcd-endpoints://0xc00049b4a0/192.168.1.4:2379","method":"/etcdserverpb.KV/Range","attempt":0,"error":"rpc error: code = Unavailable desc = error reading from server: read tcp 10.244.1.34:39346->192.168.1.4:2379: read: connection reset by peer"}
```

That means 

**Solution:** 
- Verify DOCKER_HOST_IP is correct in external-dns-values.yaml
- Ensure etcd is accessible from the Kubernetes cluster
- Check firewall rules allowing port 2379

#### B. Ingress not being picked up
```bash
# Check if external-dns sees the ingress
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns | grep argocd
```

**Solution:** Verify external-dns annotations on the ingress:
```bash
kubectl get ingress argocd-server-ingress -n argocd -o yaml | grep external-dns
```

Should see:
```yaml
external-dns.alpha.kubernetes.io/hostname: argocd.saas.local
external-dns.alpha.kubernetes.io/ttl: "300"
```

#### C. Domain filter mismatch
**Solution:** Ensure the domain in your ingress matches the domainFilters in external-dns-values.yaml:
```yaml
domainFilters:
  - saas.local
```

### 3. 502 Bad Gateway

**Symptoms:**
- Can access the domain but get 502 error
- Certificate is valid

**Diagnosis:**
```bash
# Check ArgoCD pods
kubectl get pods -n argocd

# Check ArgoCD server logs
kubectl logs -n argocd deployment/argocd-server

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller | grep argocd
```

**Common Causes:**

#### A. ArgoCD server not ready
```bash
# Check if ArgoCD server is running and healthy
kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server
```

**Solution:** Wait for ArgoCD to be ready or check pod logs for issues.

#### B. Backend protocol mismatch
If you're getting SSL errors, you might need to change the backend protocol.

**Solution 1:** Use HTTP backend with insecure ArgoCD:
```yaml
# In argocd-ingress.yaml, change:
nginx.ingress.kubernetes.io/backend-protocol: "HTTP"

# And update the service port:
backend:
  service:
    name: argocd-server
    port:
      number: 80
```

Then configure ArgoCD to run insecure:
```bash
helm upgrade argocd argo/argo-cd \
  --namespace argocd \
  --reuse-values \
  --set server.extraArgs[0]="--insecure"
```

**Solution 2:** Fix the HTTPS backend configuration:
```bash
# Check if ArgoCD server has a valid self-signed certificate
kubectl get secret argocd-server-tls -n argocd
```

### 4. SSL/TLS Certificate Errors in Browser

**Symptoms:**
- Browser shows certificate error
- Certificate not trusted

**Diagnosis:**
```bash
# Check certificate details
kubectl get secret argocd-server-tls -n argocd -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -text -noout

# Verify issuer and subject
kubectl get secret argocd-server-tls -n argocd -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -issuer -subject
```

**Solution:** 
1. Install your step-ca root certificate in your browser/system trust store
2. Verify the certificate was issued by step-ca:
```bash
# The issuer should be your step-ca CA
kubectl get secret argocd-server-tls -n argocd -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -issuer
```

### 5. LoadBalancer IP Not Assigned

**Symptoms:**
- Ingress controller service shows `<pending>` for EXTERNAL-IP

**Diagnosis:**
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

**Solution:**
Ensure MetalLB is properly configured:
```bash
# Check MetalLB pods
kubectl get pods -n metallb-system

# Check MetalLB configuration
kubectl get ipaddresspool -n metallb-system
kubectl get l2advertisement -n metallb-system
```

If MetalLB is not installed, install it:
```bash
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.0/config/manifests/metallb-native.yaml

# Create IP address pool (adjust IP range as needed)
cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.240-192.168.1.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
spec:
  ipAddressPools:
  - default-pool
EOF
```

## Verification Checklist

Use this checklist to verify everything is working:

- [ ] cert-manager pods are running
- [ ] external-dns pod is running
- [ ] ingress-nginx pods are running
- [ ] ArgoCD pods are running
- [ ] ClusterIssuer shows "Ready"
- [ ] Certificate shows "Ready"
- [ ] DNS record exists in etcd
- [ ] Ingress has an IP address
- [ ] Domain resolves to LoadBalancer IP
- [ ] HTTPS connection works
- [ ] Certificate is trusted (after installing root CA)
- [ ] ArgoCD UI loads successfully

```bash
# Quick verification script
echo "=== Component Status ==="
kubectl get pods -n cert-manager | grep -E "NAME|Running"
kubectl get pods -n external-dns | grep -E "NAME|Running"
kubectl get pods -n ingress-nginx | grep -E "NAME|Running"
kubectl get pods -n argocd | grep -E "NAME|Running"

echo -e "\n=== Certificate Status ==="
kubectl get clusterissuer step-ca-acme
kubectl get certificate -n argocd

echo -e "\n=== Ingress Status ==="
kubectl get ingress -n argocd

echo -e "\n=== DNS Records in etcd ==="
docker exec etcd etcdctl get --prefix /skydns/local/saas

echo -e "\n=== LoadBalancer IP ==="
kubectl get svc -n ingress-nginx ingress-nginx-controller | grep LoadBalancer

echo -e "\n=== DNS Resolution ==="
nslookup argocd.saas.local

echo -e "\n=== HTTPS Test ==="
curl -v https://argocd.saas.local 2>&1 | grep -E "subject:|issuer:|SSL"
```

## Getting Help

If you're still stuck after trying these solutions:

1. Collect logs:
```bash
# Create a logs directory
mkdir -p argocd-logs

# Collect all relevant logs
kubectl logs -n cert-manager deployment/cert-manager > argocd-logs/cert-manager.log
kubectl logs -n external-dns deployment/external-dns > argocd-logs/external-dns.log
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller > argocd-logs/ingress-controller.log
kubectl logs -n argocd deployment/argocd-server > argocd-logs/argocd-server.log

# Get resource descriptions
kubectl describe certificate argocd-server-tls -n argocd > argocd-logs/certificate.txt
kubectl describe ingress argocd-server-ingress -n argocd > argocd-logs/ingress.txt
kubectl describe clusterissuer step-ca-acme > argocd-logs/clusterissuer.txt
```

2. Check these resources:
- cert-manager documentation: https://cert-manager.io/docs/
- external-dns documentation: https://kubernetes-sigs.github.io/external-dns/
- ArgoCD documentation: https://argo-cd.readthedocs.io/
- step-ca documentation: https://smallstep.com/docs/step-ca/