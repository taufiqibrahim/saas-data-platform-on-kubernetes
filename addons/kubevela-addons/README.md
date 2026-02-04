# KubeVela Addon Development Workflow

## Creating New Addon
```bash
# vela addon init your-addon-name
vela addon init jupyterhub
```

## Update Addon
TODO

## Testing Addon
TODO

## Publishing Addon
TODO

## Addon Registry
### Using Git Repo as Registry Catalog

```bash
vela addon registry add gitrepo --type git --endpoint=https://github.com/taufiqibrahim/saas-data-platform-on-kubernetes --path=addons/kubevela-addons
```