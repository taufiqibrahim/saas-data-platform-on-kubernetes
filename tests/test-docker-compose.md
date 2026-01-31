## Clean Up
```bash
sudo rm -rf docker/step-ca
sudo rm -rf docker/openbao/data
docker image rm smallstep/step-cli:0.23.0
docker image rm smallstep/step-ca:0.29.0
docker image rm quay.io/coreos/etcd:v3.5.0
docker image rm coredns/coredns
docker image rm squidfunk/mkdocs-material:latest
docker image rm nginx:alpine
docker image rm caddy:2.10.2
docker image rm quay.io/openbao/openbao:latest
docker image rm ghcr.io/project-zot/zot:v2.1.14
```
