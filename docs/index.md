# SaaS Data Platform on Kubernetes

> **Multi-tenant SaaS control plane and data platform that runs on any Kubernetes cluster.**

**Local-first development**: Run a complete, production-like SaaS environment on your local machine 
with real DNS, TLS certificates, and multi-tenant isolation — 
then deploy the same configuration to AWS EKS, GCP GKE, or Azure AKS.

## Why Local-First?

Most SaaS examples either run only in the cloud (expensive, slow) or use oversimplified local setups that don't mirror production.

**This repository builds production patterns locally first:**

- **Real DNS**: Local domain resolution (`.saas.local`)
- **Real TLS**: Certificate authority and leaf certificates
- **Real Multi-tenancy**: Tenant isolation, namespaces, resource quotas
- **Real Control Plane**: Tenant provisioning workflows
- **Real Identity**: Keycloak with OIDC federation
- **Cloud-Ready**: Same manifests work locally and in production

No cloud bills. No waiting for cloud provisioning. Full production experience on your laptop.

## What's Included

**Control Plane**: Tenant lifecycle, multi-tenant isolation, Keycloak OIDC, DNS/TLS management

**Data Stack**: Airflow, Trino, Superset, Spark, DataHub, Hive Metastore

**Platform Tools**: KubeVela, GitOps patterns, observability

## Getting Started

Follow the step-by-step guides in [`docs/`](docs/):

**Local Setup**:
TODO
**Platform Layer**:
TODO

📘 **Full documentation**: [docs/](docs/) (MkDocs)

## Architecture
```
Host Machine (*.saas.local)
│
├─ Docker Containers
│  ├─ DNS Server (local domain resolution)
│  └─ Certificate Authority (TLS cert generation)
│
└─ Local Kubernetes (kind)
   ├─ SaaS Cluster
   │  ├─ Control Plane (API & UI)
   │  ├─ Keycloak (identity/OIDC)
   │  └─ Tenant Provisioner
   │
   └─ Tenant Clusters
      ├─ Tenant A
      └─ Tenant B
```

Infrastructure runs in Docker; SaaS platform runs in Kubernetes.  
Same K8s manifests deploy to EKS/GKE/AKS (DNS/CA become cloud-native services).

Same components deploy to EKS/GKE/AKS with real domains.

## Why This Exists

Reference implementation of production SaaS patterns:
- ✅ True multi-tenancy with isolation
- ✅ Control plane / tenant plane separation
- ✅ Production-grade OIDC identity management
- ✅ Cloud-agnostic (runs anywhere K8s runs)
- ✅ Local dev mirrors production

## Who This Is For

Platform engineers, data engineers, solution architects, and DevOps engineers building or learning multi-tenant SaaS systems.

## Project Status

🚧 **Active Development**
- ✅ Local Kubernetes, CA/TLS, DNS, KubeVela
- 🚧 Multi-tenant control plane, data stack
- 📋 Cloud deployment guides (planned)

---

**Questions?** Open a GitHub issue.  
**Learn more**: Start with [Local-First Concepts](docs/a-local-concept.md).
