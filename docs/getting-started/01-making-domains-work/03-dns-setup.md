# Local DNS

This guide describes how this repository implement the Local DNS part.

## Goals
We will have (but not limited to):

- `saas.local`
- `ca.saas.local`
- `docs.saas.local`
- and we can add more...

Those domains can be resolved locally from host machine and containers.

## The Components

To achieve above goals, we have a combination of **CoreDNS** and **etcd**.

### CoreDNS

**[CoreDNS](https://coredns.io/)** is a [DNS](https://en.wikipedia.org/wiki/Domain_Name_System) server written in [Go](https://go.dev/). It can be used in a multitude of environments because of its flexibility.
CoreDNS is mainly used on Kubernetes environment, act as the default DNS service, providing service discovery and name resolution.

For our stack, it's performing as local DNS service so we don't have to manually edit the infamous `/etc/hosts` file. And the other thing is we will use [ExternalDNS](https://kubernetes-sigs.github.io/external-dns/latest/) to automatically control DNS records via Kubernetes resources. ExternalDNS itself supports many DNS providers as we can see on their [Supported Providers](https://kubernetes-sigs.github.io/external-dns/latest/docs/providers/).

Since this stack goal is to enable full-production-like SaaS deployment 100% local, then the options are reduced to some open source local DNS such as [BIND](https://www.isc.org/bind/), [Knot](https://www.knot-dns.cz/), or the [PowerDNS](https://www.powerdns.com/). The decision of using CoreDNS simply because it's lightweight and easy to provision.

This stack runs CoreDNS as external service to the the Kubernetes clusters, as Docker service as can be checked on the `docker-compose.yaml` file. Meaning it is easily to be reconfigured using other DNS providers supported by ExternalDNS.

CoreDNS allows static mapping via Corefile (available on `docker/coredns/Corefile`) to define some initial static domain such as `docs.saas.local`. Since we need something dynamic, that's why we need the accompanying service: **etcd**.

### etcd
**[etcd](https://etcd.io/)** is a distributed, reliable key-value store for the most critical data of a distributed system. It is a core component of Kubernetes, serving as the primary database that stores the entire cluster state, configuration, and metadata—essentially the control plane's source of truth.

In CoreDNS, etcd acts [as a plugin](https://coredns.io/plugins/etcd/) that enables reading zone data from an etcd instance. This allows DNS records to be stored in etcd and served dynamically by CoreDNS. The plugin reads from etcd v3, where data is stored hierarchically under a specified path. CoreDNS queries etcd in real-time, enabling DNS updates without server restarts—ideal for dynamic environments like Kubernetes where services frequently change. It supports various record types (A, AAAA, CNAME, TXT, SRV) stored as JSON, and facilitates DNS-based service discovery by mapping DNS names to etcd keys.

## Usage with ExternalDNS
ExternalDNS provide the tutorial usage on [https://kubernetes-sigs.github.io/external-dns/latest/docs/tutorials/coredns-etcd/](https://kubernetes-sigs.github.io/external-dns/latest/docs/tutorials/coredns-etcd/).

Example usage with ArgoCD ingress. It is used in later the SaaS cluster.
```yaml

```

## Important Notes
TODO
