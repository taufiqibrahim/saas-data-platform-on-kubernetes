# Configure Secrets

In section [Secret Provider](../01-making-domains-work//04-secret-provider.md) we already set up a Secret Provider which is OpenBao with multitenancy.

Now we need to use it to also host the SaaS secrets on it own namespace `saas`.

## Creating SaaS OpenBao Namespace

To automate the process, we already prepared a script `scripts/generate-namespaced-keyvault.sh`.

```bash
export OPENBAO_ROOT_TOKEN=root-token
export TENANT_ID=saas

./scripts/generate-namespaced-keyvault.sh
```
