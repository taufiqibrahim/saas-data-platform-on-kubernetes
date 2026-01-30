# Secret Provider

## OpenBao Local (Prod-Like) Setup — Single Operator

### Goal

Run OpenBao locally in a way that:

* Matches production behavior
* Uses real TLS + PKI
* Avoids dev shortcuts
* Is operable by **one person**

### Architecture (local)

```
Browser / CLI
     │
 HTTPS (Step CA)
     │
   Caddy
     │
   OpenBao
(file / raft storage)
```

### 1. Prerequisites

* Docker + Docker Compose
* Step CA running locally
* Step root CA trusted on your machine
* DNS entry:

  ```
  127.0.0.1 bao.saas.local
  ```

### 2. OpenBao configuration

#### Key choices

* ❌ No `-dev` mode
* ✅ Persistent storage
* ✅ Manual unseal
* ✅ TLS terminated at Caddy

#### Storage

```hcl
storage "file" {
  path = "/bao/data"
}
```

### 3. Initialization (one time)

#### Initialization parameters

```
Key shares:     5
Key threshold:  3
```

Why:

* Matches production norms
* Allows loss tolerance
* Enforces deliberate recovery

### 4. Immediate post-init steps (DO NOT SKIP)

1. **Unseal OpenBao** using any 3 keys
2. Login with root token
3. Create admin policy
4. Create admin token
5. Revoke or lock away root token

Root token should **never** be used daily.

### 5. TLS model

* Step CA is **single root of trust**
* Caddy issues HTTPS cert for `bao.saas.local`
* OpenBao trusts Step CA for:

  * Client cert auth
  * Future mTLS workloads

### 6. Authentication strategy (dev → prod parity)

| Auth method        | Purpose               |
| ------------------ | --------------------- |
| Token              | Bootstrap only        |
| Cert               | Automation / services |
| OIDC (later)       | Humans                |
| Kubernetes (later) | Workloads             |

### 7. What belongs in OpenBao (even for local dev)

Store **only things that benefit from**:

* Central rotation
* Access control
* Auditing

#### Good candidates

* API keys (Stripe, GitHub, OpenAI)
* DB credentials
* OAuth client secrets
* Internal service credentials
* Signing keys
* Webhook secrets

#### Do NOT store

* Build artifacts
* Source code
* Large blobs
* User data

### 8. Backup strategy (single person)

You must back up **two things only**:

1. OpenBao storage volume
2. Unseal key shares

If both are lost → **data is unrecoverable**.

### 9. Restart procedure (know this by heart)

```text
Start containers
→ OpenBao sealed
→ Enter 3 unseal keys
→ System operational
```

If this feels painful — that’s intentional.

### 10. When to change things

| Change      | Trigger            |
| ----------- | ------------------ |
| Auto-unseal | Multiple operators |
| Raft        | HA or prod         |
| OIDC        | Team access        |
| KMS         | Cloud              |

# Personal Ops Notes (what YOU should write down)

Keep this in **local encrypted notes** (not in git).

### A. OpenBao recovery info

* Where unseal keys are stored
* Which 3 of 5 you normally use
* Storage backend (`file`, path)
* How to start & unseal

### B. Trust & PKI

* Step CA root fingerprint
* ACME endpoint URL
* Which services trust Step CA
* Cert lifetimes

### C. Auth & access

* Admin policy name
* Admin token creation command
* Where admin token is stored
* Token TTL expectations

### D. Secrets inventory (VERY useful)

For each secret:

```
Path:
Owner:
Rotation method:
Rotation frequency:
Downstream impact:
```

This becomes gold in real prod.

### E. Disaster drills (yes, even solo)

Write answers to:

* If OpenBao dies, what breaks first?
* If token leaks, what do I rotate?
* If Step CA dies, what still works?

### Mental model (important)

Think of this setup as:

> “A **real production vault**, running on a **tiny, trusted island**.”

You are practicing **operating discipline**, not just running software.

### TL;DR

* Use **5 / 3**
* Avoid dev mode
* TLS everywhere
* Root token only once
* Write down recovery steps
* Treat local like prod, but **lighter**
