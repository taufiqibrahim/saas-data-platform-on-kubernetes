# Configure Secrets

In section [Setting Up SaaS Cluster](./01-saas-cluster.md), we already set up a namespaced Secret Provider which is OpenBao.
In this section we will populate the secrets.

## Login to OpenBao Namespace
As the SaaS admin, you can login to OpenBao `saas` namespace.

- Go to [https://bao.saas.internal](https://bao.saas.internal)
- Namespace: `saas`
- Method: Token
- Token: the token created on [Setting Up SaaS Cluster](./01-saas-cluster.md)

## Populating Secrets

TODO

Temporary list:
```bash
dockerio-secret
headlamp-oidc-credentials
keycloak-credentials
keycloak-db-credentials
rustfs-credentials
step-ca-root-cert
temporal-db-credentials
```
