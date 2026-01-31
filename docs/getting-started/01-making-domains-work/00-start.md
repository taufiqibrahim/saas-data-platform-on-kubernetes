# Run The Services

## Run The Services

## Preparing Docker .env
Create new `.env` file in the root directory of this project by using `.env.example` as template.
Following is the example:
```
GOMAXPROCS=8
DOCKER_HOST_IP=192.168.1.4
STEPCA_PASSWORD=supersecret
```

## Preparing Container Images
We need to pull several images because we will switch from the default machine DNS to CoreDNS.
```bash
docker pull smallstep/step-cli:0.23.0
docker pull smallstep/step-ca:0.29.0
docker pull quay.io/coreos/etcd:v3.5.0
docker pull coredns/coredns
docker pull squidfunk/mkdocs-material:latest
docker pull nginx:alpine
docker pull caddy:2.10.2
docker pull quay.io/openbao/openbao:latest
docker pull ghcr.io/project-zot/zot:v2.1.14
```

Build `cloud-provider-kind` image:
```bash
git clone https://github.com/kubernetes-sigs/cloud-provider-kind
cd cloud-provider-kind
docker build . -t cloud-provider-kind
```

## Preparing Required Directories

### Step CA
```bash
# Create directory structure with correct permissions
# ! docker/step-ca directory is ignored by .gitignore
mkdir -p docker/step-ca/secrets docker/step-ca/certs && sudo chown -R 1000:1000 docker/step-ca
```

### Openbao
```bash
# Create directory structure with correct permissions
# ! docker/openbao/data directory is ignored by .gitignore
mkdir -p docker/openbao/data && sudo chown -R 100:1000 docker/openbao/data
```