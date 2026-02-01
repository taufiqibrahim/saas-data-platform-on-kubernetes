# Architecture

## Overview

This project deploys a **SaaS data platform entirely on local Kubernetes**, mimicking real production systems. This page describes the high-level architecture and core components so you understand how the pieces fit together before diving into setup.

## Core Components

| Component | Role |
| --- | --- |
| **CoreDNS + etcd** | Local authoritative DNS for the `saas.internal` zone |
| **Step CA** | Private Certificate Authority — creates and manages the root certificate |
| **cert-manager** | Issues and renews TLS certificates from Step CA |
| **external-dns** | Watches Kubernetes resources and auto-creates DNS records in CoreDNS |
| **cloud-provider-kind** | Simulates a cloud load balancer for `kind` clusters |
| **Ingress Controller** | Terminates HTTPS and routes traffic to services |

## How They Fit Together

```
Browser
  ↓
DNS Query (api.saas.internal)
  ↓
CoreDNS (authoritative, backed by etcd)
  ↓
cloud-provider-kind (LoadBalancer IP)
  ↓
Ingress Controller (TLS termination)
  ↓
Service → Pod
```

Control-plane automations:

- `external-dns` → CoreDNS/etcd (creates A / TXT records from Ingress objects)
- `cert-manager` → Step CA (issues certs, stores as Kubernetes Secrets)

## Design Goals

- Production-like DNS and TLS flow
- No `/etc/hosts` hacks
- No self-signed certificate warnings
- Wildcard domains for SaaS + per-tenant isolation
- Clean separation of concerns (DNS, TLS, Ingress)

## Next Steps

- [Local DNS and TLS Concepts](./02-local-dns-and-tls.md)
