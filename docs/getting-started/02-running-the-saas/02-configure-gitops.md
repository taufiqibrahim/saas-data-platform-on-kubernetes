# Configure GitOps

## Prerequisites


## Deploy ArgoCD
Create ArgoCD namespace
```bash
kubectl apply -f deployments/saas/bootstrap/argocd/namespace.yaml
```

Deploy ArgoCD using Helm
```bash
# Add repository
helm repo add argo https://argoproj.github.io/argo-helm

# Install chart
helm upgrade --install argocd argo/argo-cd \
  --version 9.3.7 \
  --namespace argocd \
  -f deployments/saas/bootstrap/argocd/values.yaml
```

### Access ArgoCD UI

Get the initial admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```
