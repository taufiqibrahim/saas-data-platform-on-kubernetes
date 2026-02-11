# Configure GitOps

On the [previous section](./01-saas-cluster.md), we already have ArgoCD running on the SaaS cluster.
Now, in this section we will show how we configure the Gitops.

The SaaS cluster is using this path as GitOps source path: `deployments/saas/gitops`.


## Register Registry Credentials to ArgoCD

### Helm

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: dockerhub-helm-oci
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  name: dockerhub-helm-oci
  type: helm
  url: registry-1.docker.io
  username: <your-dockerhub-username>
  password: <your-dockerhub-token>
  enableOCI: "true"
EOF
```



### Container Images
```bash
# Docker Hub
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<username> \
  --docker-password=<token> \
  -n <your-app-namespace>

# GHCR.io
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  -n <your-app-namespace>
```

### Deploy ArgoCD App of Apps Manifest

```bash
kubectl apply -f deployments/saas/bootstrap/argocd/argocd-apps-root.yaml
```
