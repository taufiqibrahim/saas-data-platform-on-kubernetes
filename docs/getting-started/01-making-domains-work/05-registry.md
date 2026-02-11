# Registry

## Zot

### Authentication

Zot authentication is controlled through configuration file as located at `docker/zot/zot-config.json`.

#### Use htpasswd
To simplify we can use simple htpasswd for our stack.
```bash
htpasswd -bBn <username> <password> >> ./docker/zot/htpasswd
```
Later this htpasswd file will be mounted to container `/etc/zot/htpasswd` via [docker-compose.yaml](https://github.com/taufiqibrahim/saas-data-platform-on-kubernetes/blob/main/docker-compose.yaml)

To enable `htpasswd` authentication and configure the path to the htpasswd authentication in the zot configuration file.
```json
"http": {
...
  "auth": {
      "htpasswd": {
        "path": "/etc/zot/htpasswd"
      },
```

### Populate Zot Registry
We have prepared an example script to populate the local registry on `scripts/prepare-local-registry.sh`.
Feel free to modify and add more images as you need.

```bash
./scripts/prepare-local-registry.sh
```

It will take a while to load depends on the number of images and the size.
