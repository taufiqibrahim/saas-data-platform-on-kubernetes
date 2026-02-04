# KubeVela Addon Development

## Example: Jupyterhub Addon
Example use case creating `jupyterhub` addon.

### Scaffold The Code

```bash
# vela addon init your-addon-name
vela addon init jupyterhub
```

### Test The Local Addons
```bash
# Dry run
vela addon enable ./jupyterhub --dry-run

# Enable
vela addon enable ./jupyterhub

# Disable/uninstall
vela addon enable jupyterhub
```

### Host the Addon Using Local NGINX

In this repository we have a NGINX service running on https://saas.internal.
We can use that to host the HTTPS based Helm repository.

Package the addon into `static/kubevela-addons`.
```bash
$ helm package addons/kubevela-addons/jupyterhub/ -d static/kubevela-addons/
Successfully packaged chart and saved it to: static/kubevela-addons/jupyterhub-0.0.1.tgz
```

Update the index
```bash
helm repo index static/kubevela-addons/ --url https://saas.internal/kubevela-addons/
```

On that, you can check the `index.yaml` should be served on https://saas.internal/kubevela-addons/index.yaml.

Now we can access the registry by adding like this:
```bash
vela addon registry add static --type helm --endpoint=https://saas.internal/kubevela-addons
```

List the registry to verify:
```bash
vela addon registry list
```

And check the addon list
```bash
vela addon list --registry=static
NAME            REGISTRY        DESCRIPTION                             AVAILABLE-VERSIONS      STATUS
jupyterhub      static          SaaS Jupyterhub workspace app addon.    [0.0.1]
```

### Host the Addon Using github.io

This requires you to have one github.io page. Let's assume you have this https://youruser.github.io

Package the addon.
```bash
helm package addons/kubevela-addons/jupyterhub/ -d ~/your-local/cloned/repo/youruser.github.io/kubevela/addons/
```

Update inndex
```bash
helm repo index ~/your-local/cloned/repo/youruser.github.io/kubevela/addons/ --url https://youruser.github.io/kubevela/addons/
```

Commit and push your repo.

On that, you can check the `index.yaml` should be served on https://youruser.github.io/kubevela/addons/index.yaml.