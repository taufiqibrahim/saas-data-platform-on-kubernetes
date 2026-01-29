# ArgoCD Bootstrap

This directory contains the initial setup files for ArgoCD. These files are applied **once manually** to bootstrap the GitOps workflow.

## Prerequisites

- Kubernetes cluster running
- `kubectl` configured and connected to your cluster
- Cluster admin permissions

## Installation Steps

### 1. Install ArgoCD
```bash
# Create argocd namespace and install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f bootstrap/argocd/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

### 2. Access ArgoCD UI (Optional)
```bash
# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo

# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access at: https://localhost:8080
# Username: admin
# Password: (from command above)
```

### 3. Deploy Root Application (App of Apps)
```bash
# This tells ArgoCD to watch the gitops/ directory and manage all apps
kubectl apply -f bootstrap/argocd/root-app.yaml
```

### 4. Verify
```bash
# Check ArgoCD is syncing apps
kubectl get applications -n argocd

# Watch the sync status
kubectl get applications -n argocd -w
```

## What Happens Next?

After applying `root-app.yaml`:
1. ArgoCD starts watching the `gitops/` directory in your repository
2. It automatically deploys all applications defined in `gitops/argocd-apps/`
3. Any changes you commit to `gitops/` will be automatically synced
4. ArgoCD manages itself (self-management) through the gitops workflow

## Post-Installation

### Change Admin Password
```bash
# Login with CLI
argocd login localhost:8080

# Change password
argocd account update-password
```

### Configure Git Repository (if private)
```bash
# Add your Git repository credentials
argocd repo add https://github.com/your-org/your-repo \
  --username your-username \
  --password your-token
```

## Troubleshooting

### ArgoCD pods not starting
```bash
kubectl get pods -n argocd
kubectl logs -n argocd deployment/argocd-server
```

### Root app not syncing
```bash
kubectl get application root -n argocd -o yaml
kubectl describe application root -n argocd
```

### Force sync an application
```bash
argocd app sync root
# or via kubectl
kubectl patch application root -n argocd --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
```

## Clean Up (if needed)
```bash
# Delete root app (this will delete all managed apps)
kubectl delete -f bootstrap/argocd/root-app.yaml

# Delete ArgoCD
kubectl delete -n argocd -f bootstrap/argocd/install.yaml
kubectl delete namespace argocd
```

## Notes

- Bootstrap files should only be applied once
- After bootstrap, manage everything through GitOps (gitops/ directory)
- Keep bootstrap/ in git for documentation, but don't modify install.yaml frequently
- Update ArgoCD version by changing the version in install.yaml and re-applying
