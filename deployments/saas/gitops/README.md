# GitOps Local Development

## Prerequisites

- KinD cluster running with ArgoCD deployed (see `../bootstrap/`)
- `argocd`, `helm`, `kubectl` CLI tools installed

## Development Workflow

### Phase 1: Experiment (no commits needed)

Render and apply directly to validate changes fast:

```bash
# Render templates to check for errors
helm template deployments/saas/gitops/argocd-apps/

# Apply a specific app's values directly
helm template <app-name> <chart-repo>/<chart> \
  -f deployments/saas/gitops/deployments/<layer>/<app>/values-internal.yaml \
  | kubectl apply -f -

# Or use argocd local sync
argocd app sync <app-name> --local deployments/saas/gitops/deployments/<layer>/<app>/
```

### Phase 2: Validate (feature branch)

Test the full GitOps flow end-to-end on your branch:

```bash
# Point ArgoCD at your feature branch
argocd app set apps-root --revision <your-branch>

# Commit, push, and let ArgoCD sync
git add -A && git commit -m "gitops: <change description>"
git push origin <your-branch>

# Monitor sync
argocd app get <app-name>
argocd app diff <app-name>
```

### Phase 3: Ship (merge to main)

1. Open a PR from your feature branch to `main`
2. Review the gitops diff
3. Merge
4. Reset ArgoCD target revision if overridden:

```bash
argocd app set apps-root --revision main
```

ArgoCD auto-syncs from `main`.

## Sync Wave Reference

| Wave | Layer | Examples |
|------|-------|---------|
| -10 | Secrets | external-secrets |
| 1 | Infrastructure | databases |
| 5 | Core services | keycloak, temporal, headlamp |

New apps should be assigned a wave based on their dependencies.

## Debugging

```bash
# Check all app statuses
kubectl get applications -n argocd

# Check external secrets sync
kubectl get externalsecrets -A

# Preview what ArgoCD would change
argocd app diff <app-name>
```
