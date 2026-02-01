# Concept

## 1. Overview
This document describes the **conceptual architecture** for running **local DNS and HTTPS** in a **100% local Kubernetes environment** that closely **mimics real production systems**.

The goal is not step-by-step setup, but to explain **how the pieces fit together** and **why each component exists**, so the same mental model can later be applied to real cloud environments.

## 2. Target Domain Model

The system is designed to support a SaaS-style hostname structure such as:

| Domain | Usage |
| --- | --- |
| [https://saas.internal](https://saas.internal) | Static content using NGINX for demonstration purpose |
| [https://docs.saas.internal](https://docs.saas.internal) | This documentation runs locally |
| [https://api.saas.internal](https://api.saas.internal) | - |
| [https://ui.saas.internal](https://ui.saas.internal) | - |
| [https://tenant1.saas.internal](https://tenant1.saas.internal) | - |
| [https://app1.tenant1.saas.internal](https://app1.tenant1.saas.internal) | - |

All domains are resolved via local authoritative DNS and served over HTTPS using certificates trusted by the developer’s OS and browser.

## 3. Core Components

The architecture is built from the following roles:

- **CoreDNS**  
  Owns the local `saas.internal` DNS zone and serves authoritative DNS records.

- **etcd**  
  Store the DNS records to be served by CoreDNS.

- **Step CA**  
  Perform certificate management and root certificate creation.

- **cloud-provider-kind**  
  Simulates the behavior of a cloud provider by provisioning load balancer when a LoadBalancer service is requested.

- **external-dns**  
  Observes Kubernetes resources and automatically creates DNS records in [CoreDNS with etcd backend](https://kubernetes-sigs.github.io/external-dns/v0.20.0/docs/tutorials/coredns-etcd/).

- **cert-manager**  
  Issues and renews TLS certificates from a private Certificate Authority (CA).

- **Ingress Controller (nginx or caddy)**  
  Terminates HTTPS and routes traffic to services inside the cluster.

## 4. Goals

* Production-like DNS & TLS flow
* No `/etc/hosts`
* No self-signed warnings
* Wildcard domains for SaaS + tenants
* Clean separation of concerns (DNS, TLS, Ingress)

## 5. Architecture Overview

```
Browser
  ↓
DNS Query (api.saas.internal)
  ↓
CoreDNS (Authoritative)
  ↓
cloud-provider-kind (LoadBalancer)
  ↓
Ingress Controller
  ↓
Service
  ↓
Pod
```

Control plane:

* `external-dns` → CoreDNS + etcd (creates A / TXT records)
* `cert-manager` → Private CA using Step CA (issues certs)

## 6. DNS Design

### Zone

```
saas.internal
```

Managed **only** by CoreDNS (authoritative).

### Records

* Created automatically by `external-dns`
* Based on `Service` / `Ingress` objects

## 7. TLS / Certificate Design

### One CA per environment

* **Exactly ONE private CA** for local dev
* Represents trust for the whole environment
* Installed into:

  * OS trust store
  * Browser
  * Kubernetes (cert-manager)

> The CA is created **once**, reused everywhere.

## 8. Certificate Strategy (Prod-like)

**ONE CA**, but **multiple certificates**.

### SaaS-level wildcard

```
*.saas.internal
```

Covers:

* `api.saas.internal`
* `ui.saas.internal`
* `tenant1.saas.internal`

### Tenant-level wildcard (per tenant)

```
*.tenant1.saas.internal
*.tenant2.saas.internal
```

Covers:

* `app1.tenant1.saas.internal`
* `app2.tenant1.saas.internal`

### Why Two Wildcards?

TLS wildcards only match **one DNS label**.

| Certificate           | Valid                    | Invalid                  |
| --------------------- | ------------------------ | ------------------------ |
| `*.saas.internal`         | `api.saas.internal`          | `app1.tenant1.saas.internal` |
| `*.tenant1.saas.internal` | `app1.tenant1.saas.internal` | `x.y.tenant1.saas.internal`  |

This mirrors real SaaS production setups.

## 9. Kubernetes Components

### Required

* **MetalLB** – provides external IPs
* **Ingress Controller** – nginx or caddy
* **external-dns** – RFC2136 → PowerDNS
* **cert-manager** – issues TLS certs

### external-dns responsibilities

* Watches Services / Ingresses
* Creates DNS records in CoreDNS with etcd backend
* No DNS resolution involved

### cert-manager responsibilities

* Issues certs from the private CA (Step CA)
* Stores certs as Kubernetes Secrets
* Renews automatically

## 10. Workflow Summary

1. Private CA is created (once)
2. CA is trusted by OS & browser
3. CA is imported into **cert-manager** using **Cluster Issuer**
4. **cloud-provider-kind** assigns IP to Ingress Service
5. **external-dns** creates DNS records
6. **cert-manager** issues certs
7. Ingress serves HTTPS traffic


## 11. Result

You will have:

* Production-like DNS
* Production-like TLS
* Automated certs & records
* Clean tenant isolation
* Zero browser warnings

## Next Steps
- [Bootstraping CA](./02-ca-bootstraping.md)
