## TODO

- ghcr.io/cloudnative-pg/postgresql:18.1-system-trixie
- ghcr.io/external-secrets/external-secrets:v1.3.1


```bash
crane --insecure copy ghcr.io/external-secrets/external-secrets:v1.3.1 zot.saas.internal/external-secrets/external-secrets:v1.3.1
crane --insecure copy ghcr.io/cloudnative-pg/postgresql:18.1-system-trixie zot.saas.internal/cloudnative-pg/postgresql:18.1-system-trixie
```
