# Registry

## Zot

### Authentication
#### Use htpasswd
To simplify we can use simple htpasswd for our stack.
```bash
htpasswd -bBn <username> <password> >> ./docker/zot/htpasswd
```

### Populate Zot Registry

```bash
crane --insecure copy ghcr.io/external-secrets/external-secrets:v1.3.2 zot.saas.internal/external-secrets/external-secrets:v1.3.2
crane --insecure copy ghcr.io/cloudnative-pg/postgresql:18.1-system-trixie zot.saas.internal/cloudnative-pg/postgresql:18.1-system-trixie
crane --insecure copy quay.io/jupyterhub/k8s-singleuser-sample:4.3.2 zot.saas.internal/jupyterhub/k8s-singleuser-sample:4.3.2
crane --insecure copy quay.io/jupyterhub/k8s-hub:4.3.2 zot.saas.internal/jupyterhub/k8s-hub:4.3.2
crane --insecure copy docker.io/hashicorp/vault:1.21.2 zot.saas.internal/hashicorp/vault:1.21.2
```
