# Prerequisites

Before starting, prepare your local environment with the required configuration and container images.

## 1. Docker `.env` File

Create a `.env` file in the project root using `.env.example` as a template:

```bash
cp .env.example .env
```

Then fill in the values:

```ini
GOMAXPROCS=8
DOCKER_HOST_IP=<your-local-ip>
STEPCA_PASSWORD=<your-stepca-password>
```

| Variable | Description |
| --- | --- |
| `GOMAXPROCS` | Number of OS threads for Go-based services |
| `DOCKER_HOST_IP` | Your machine's LAN IP (e.g. `192.168.1.4`). Used by etcd to advertise to CoreDNS and Kubernetes. Find it with `hostname -I \| awk '{print $1}'` |
| `STEPCA_PASSWORD` | Password for the Step CA provisioner |

## 2. Pull Container Images

We pull images **before** switching DNS to CoreDNS, so Docker can still resolve public registries normally.

```bash
docker pull smallstep/step-cli:0.23.0
docker pull smallstep/step-ca:0.29.0
docker pull quay.io/coreos/etcd:v3.5.0
docker pull coredns/coredns
docker pull squidfunk/mkdocs-material:latest
docker pull nginx:alpine
docker pull caddy:2.10.2
```

## 3. Build `cloud-provider-kind`

This image is not yet published to a registry (at the time of writing) — it must be built locally:

```bash
git clone https://github.com/kubernetes-sigs/cloud-provider-kind
cd cloud-provider-kind
docker build . -t cloud-provider-kind
cd ..
```

### Openbao (optional)

```bash
mkdir -p docker/openbao/data
sudo chown -R 100:1000 docker/openbao/data
```

> `docker/openbao/data` is git-ignored.

### RustFS (optional)

```bash
mkdir -p docker/rustfs/data
sudo chown -R 10001:10001 docker/rustfs/data
```

> `docker/openbao/data` is git-ignored.

## Next Steps

- [Architecture](./01-architecture.md)
