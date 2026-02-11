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
```yaml
dockerio-secret:
  password:
  username:

headlamp-oidc-credentials:
  clientID: ***********
  clientSecret: ***********
  issuerURL: ***********
  scopes: ***********

keycloak-credentials:
  admin-password:

keycloak-db-credentials:
  password:
  username:

rustfs-credentials:
  ACCESS_KEY_ID: ***********
  ACCESS_SECRET_KEY: ***********

step-ca-root-cert:
  ca.crt: ***********

temporal-db-credentials:
  password:
  username:
```
