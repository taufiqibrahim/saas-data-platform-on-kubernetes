# Decisions

## Kubevela Addon Hosting
### Considerations
- KubeVela Addon can be hosted on Git repository or HTTPS based Helm registry.
- OCI is not supported.
- Github hosting can easily reach rate limit.

### Decision
Host locally using NGINX static content.

### Links
- [host-the-addon-using-local-nginx](./kubevela-addon.md#host-the-addon-using-local-nginx)
