# Install Local Kubernetes Clusters (Kind)

## Install kind

```bash
go install sigs.k8s.io/kind@v0.31.0
```
## Creating kind Cluster

Since we're about to replicate as much as we can with production grade clusters, we will
use the YAML config file so we can configure more.

```bash
cd examples/kind/

# Creating SaaS cluster
kind create cluster --config=kind-saas-cluster.yaml

# Creating Tenant cluster
kind create cluster --config=kind-tenant-cluster.yaml
```

When you list your kind clusters, you will see something like the following:
```bash
kind get clusters
saas-cluster
tenant-cluster
```

In order to interact with a specific cluster, you only need to specify the cluster name as a context in kubectl:
```bash
kubectl cluster-info --context kind-tenant-cluster
```

After that you can start interact using `kubectl` or `k9s`.

To show current cluster + context that you're CLI working on:
```bash
kubectl config current-context
```

## Adding labels and taints

Adding labels:
```bash
kubectl label node saas-tenant-test-worker node-role.kubernetes.io/default=
kubectl label node saas-tenant-test-worker2 node-role.kubernetes.io/database=
```

```bash
# All database workload must use "saas-tenant-test-worker2"
kubectl taint nodes saas-tenant-test-worker2 workload=database:NoSchedule
```

## Adding Load Balancer (MetalLB)
Kind does not come with Load Balancer out of the box. In order to have the same capability with cloud providers,
we will use [MetalLB](https://metallb.io/).

Run following command to install MetalLB after your Kind cluster up and running.
```bash
# see what changes would be made, returns nonzero returncode if different
kubectl get configmap kube-proxy -n kube-system -o yaml | \
sed -e "s/strictARP: false/strictARP: true/" | \
kubectl diff -f - -n kube-system

# actually apply the changes, returns nonzero returncode on errors only
kubectl get configmap kube-proxy -n kube-system -o yaml | \
sed -e "s/strictARP: false/strictARP: true/" | \
kubectl apply -f - -n kube-system

# To install MetalLB, apply the manifest:
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.15.3/config/manifests/metallb-native.yaml
```

Now we need to configure MetalLB. First, define the IP address to be assigned to the LB.
Since we're using Kind, we need to use `docker inspect to know the IPs.

```bash
docker inspect kind | jq .[].IPAM.Config
[
  {
    "Subnet": "fc00:f853:ccd:e793::/64"
  },
  {
    "Subnet": "172.18.0.0/16",
    "Gateway": "172.18.0.1"
  }
]
```

Based on above example output, suggested IP Pool for MetalLB (Upper Range)
```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
  - 172.18.255.200-172.18.255.254
```

This gives you 55 IPs for services (.200 → .254)

Far away from the gateway (172.18.0.1) and lower ranges.

Next, we need to announce the service IP address using L2 Advertisement.
So the final YAML become.

```yaml
---
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: kind-pool
  namespace: metallb-system
spec:
  addresses:
  - 172.18.255.200-172.18.255.254
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: kind-advertisement
  namespace: metallb-system
```

Save the file as `metallb.yaml` and apply it.

```bash
kubectl apply -f metallb.yaml
```

## Deleting a Kind Cluster
If you created a cluster with kind create cluster then deleting is equally simple:
```bash
kind delete cluster

# with specific name
kind delete cluster --name saas-tenant-test
```
If the flag `--name` is not specified, kind will use the default cluster context name kind and delete that cluster.

Note: By design, requesting to delete a cluster that does not exist will not return an error. This is intentional and is a means to have an idempotent way of cleaning up resources.

## Loading an Image Into Kind Cluster
You can load one or more images into your kind cluster:
```bash
kind load docker-image my-app:latest
kind load docker-image my-app:latest my-db:latest my-cache:latest
```

Note: If using a named cluster you will need to specify the name of the cluster:
```bash
kind load docker-image my-app:latest --name test-cluster
```

## Create Namespaces
```bash
kubectl apply 
```

## Installing Metric Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Patch 
```bash
kubectl patch -n kube-system deployment metrics-server --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

