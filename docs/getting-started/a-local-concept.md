# Concept

## 1. Overview
This document describes the **conceptual architecture** for running **local DNS and HTTPS** in a **100% local Kubernetes environment** that closely **mimics real production systems**.

The goal is not step-by-step setup, but to explain **how the pieces fit together** and **why each component exists**, so the same mental model can later be applied to real cloud environments.

## 2. Target Domain Model

The system is designed to support a SaaS-style hostname structure such as:

| Domain | Usage |
| --- | --- |
| [https://docs.saas.local](https://docs.saas.local) | This documentation runs locally |
| [https://api.saas.local](https://api.saas.local) | - |
| [https://ui.saas.local](https://ui.saas.local) | - |
| [https://tenant1.saas.local](https://tenant1.saas.local) | - |
| [https://app1.tenant1.saas.local](https://app1.tenant1.saas.local) | - |

All domains are resolved via local authoritative DNS and served over HTTPS using certificates trusted by the developer’s OS and browser.

## 3. Core Components

The architecture is built from the following roles:

- **CoreDNS**  
  Owns the local `saas.local` DNS zone and serves authoritative DNS records.

- **Step CA**  
  Perform certificate management and root certificate creation.

- **external-dns (RFC2136)**  
  Observes Kubernetes resources and automatically creates DNS records in PowerDNS.

- **cert-manager**  
  Issues and renews TLS certificates from a private Certificate Authority (CA).

- **MetalLB**  
  Provides stable, externally reachable IPs for Kubernetes `LoadBalancer` services in local environments.

- **Ingress Controller (nginx or caddy)**  
  Terminates HTTPS and routes traffic to services inside the cluster.

This stack works consistently across **Windows, macOS, and Linux**, and with **kind, k3s, or k3d**.

## 4. HTTPS Guarantee

The architecture ensures:

- TLS is handled **inside Kubernetes**
- Certificates are **automatically issued and renewed**
- A **single private CA** is trusted everywhere
- No browser security warnings
- No `/etc/hosts` hacks


## 5. Goals

* Production-like DNS & TLS flow
* No `/etc/hosts`
* No self-signed warnings
* Wildcard domains for SaaS + tenants
* Clean separation of concerns (DNS, TLS, Ingress)

---

## 6. Architecture Overview

```
Browser
  ↓
DNS Query (api.saas.local)
  ↓
PowerDNS (Authoritative)
  ↓
MetalLB IP (LoadBalancer)
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

## 7. DNS Design

### Zone

```
saas.local
```

Managed **only** by PowerDNS (authoritative).

### Records

* Created automatically by `external-dns`
* Based on `Service` / `Ingress` objects
* No manual `pdnsutil` once automated

## 8. TLS / Certificate Design

### One CA per environment

* **Exactly ONE private CA** for local dev
* Represents trust for the whole environment
* Installed into:

  * OS trust store
  * Browser
  * Kubernetes (cert-manager)

> The CA is created **once**, reused everywhere.

## 9. Certificate Strategy (Prod-like)

**ONE CA**, but **multiple certificates**.

### SaaS-level wildcard

```
*.saas.local
```

Covers:

* `api.saas.local`
* `ui.saas.local`
* `tenant1.saas.local`

### Tenant-level wildcard (per tenant)

```
*.tenant1.saas.local
*.tenant2.saas.local
```

Covers:

* `app1.tenant1.saas.local`
* `app2.tenant1.saas.local`

### Why Two Wildcards?

TLS wildcards only match **one DNS label**.

| Certificate           | Valid                    | Invalid                  |
| --------------------- | ------------------------ | ------------------------ |
| `*.saas.local`         | `api.saas.local`          | `app1.tenant1.saas.local` |
| `*.tenant1.saas.local` | `app1.tenant1.saas.local` | `x.y.tenant1.saas.local`  |

This mirrors real SaaS production setups.

## 11. Kubernetes Components

### Required

* **MetalLB** – provides external IPs
* **Ingress Controller** – nginx or caddy
* **external-dns** – RFC2136 → PowerDNS
* **cert-manager** – issues TLS certs

### external-dns responsibilities

* Watches Services / Ingresses
* Creates DNS records in PowerDNS
* No DNS resolution involved

### cert-manager responsibilities

* Issues certs from the private CA
* Stores certs as Kubernetes Secrets
* Renews automatically

## 12. Workflow Summary

1. Private CA is created (once)
2. CA is trusted by OS & browser
3. CA is imported into cert-manager
4. MetalLB assigns IP to Ingress Service
5. external-dns creates DNS records
6. cert-manager issues wildcard certs
7. Ingress serves HTTPS traffic

## 13. Mental Model

```
ONE environment
→ ONE CA (trust root)
→ MANY certificates
→ MANY tenants
→ MANY apps
```

## 14. Result

You now have:

* Production-like DNS
* Production-like TLS
* Automated certs & records
* Clean tenant isolation
* Zero browser warnings

## Next Steps
- [Bootstraping CA](./b-bootstraping-ca.md)
