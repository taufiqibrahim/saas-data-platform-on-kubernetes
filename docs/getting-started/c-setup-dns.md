# Setting Up Local DNS

This guide describes how to implement the Local DNS part.

At the end of this section we will have (but not limited to):
- saas.local
- app.saas.local
- api.saas.local
- harbor.saas.local

Can be resolved locally from host machine and containers.

## Run The Services

Start the services using `docker compose up`.
```bash
docker compose up -d
```

The running services are:

### CoreDNS
- Runing on `network_mode: host` on host's port 53.
- Depends on `etcd` service which is defined on the same `docker-compose.yml`
- Using Corefile which is mounted from `docker/coredns/Corefile`

### Step CA
- Runing on `network_mode: host` on host's port 9000.
- Accessible on https://localhost:9000 and https://ca.saas.local:9000


## Note on WSL

Need to disable generateHosts and generateResolvConf
```bash
# /etc/wsl.conf
[network]
generateHosts=false
generateResolvConf=false
```

Need to update `.wslconfig`.
```bash
# .wslconfig
# Settings apply across all Linux distros running on WSL 2
[wsl2]
# Limits VM memory to use no more than X GB, this can be set as whole numbers using GB or MB
memory=18GB
# Turn on default connection to bind WSL 2 localhost to Windows localhost. Setting is ignored when networkingMode=mirrored
localhostforwarding=true
# Available values are: none, nat, bridged (deprecated), mirrored, and virtioproxy.
networkingMode=mirrored
# Changes how DNS requests are proxied from WSL to Windows
dnsTunneling=false

[experimental]
# Available values are: disabled, gradual, and dropCache. If the value is disabled, WSL automatic memory reclamation will be disabled. If the value is gradual, cached memory will be reclaimed slowly and automatically. If the value is dropCache or an unknown value, cached memory will be reclaimed immediately.
autoMemoryReclaim=gradual
# Only applicable when wsl2.networkingMode is set to mirrored. Specifies which ports Linux applications can bind to, even if that port is used in Windows. This enables applications to listen on a port for traffic purely within Linux, so those applications are not blocked even when that port is used for other purposes on Windows. For example, WSL will allow binding to port 53 in Linux for Docker Desktop, as it is listening only to requests from within the Linux container. Should be formatted in a comma separated list, e.g: 3000,9000,9090
ignoredPorts=53
# Only applicable when wsl2.networkingMode is set to mirrored. When set to true, will allow the Container to connect to the Host, or the Host to connect to the Container, by an IP address that's assigned to the Host. The 127.0.0.1 loopback address can always be used,this option allows for all additionally assigned local IP addresses to be used as well. Only IPv4 addresses assigned to the host are supported.
hostAddressLoopback=true
```

Restart the WSL using PowerShell as administrator:
```ps
wsl --shutdown
wsl
```
