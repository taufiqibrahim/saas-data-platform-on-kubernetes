# mTLS Design: Agent Authentication

## Problem

Tenant cluster agents need to authenticate to the control plane API. Traditional API keys are static secrets that can leak and are hard to rotate. mTLS (mutual TLS) provides cryptographic identity — the agent proves who it is by presenting a certificate signed by a trusted CA, and the server proves it's real by presenting its own certificate back.

## PKI Structure

All certificates are issued by [Step CA](https://smallstep.com/docs/step-ca/), which provides a 3-tier PKI:

```
Root CA (trust anchor, self-signed)
  └── Intermediate CA (signs leaf certs, signed by root)
        ├── Server cert    (proves server identity to clients)
        └── Agent certs    (proves agent identity to server)
```

Why 3 tiers instead of 2? The root CA private key stays offline/protected. The intermediate CA does the day-to-day signing. If the intermediate is compromised, revoke it and issue a new one without replacing the root on every client.

## Certificate Lifecycle

### 1. Agent Registration (no mTLS yet)

The agent starts with a **bootstrap token** — a one-time credential created in the UI when a workspace cluster agent is provisioned.

```
Tenant Cluster                          Control Plane API
     │                                        │
     │  POST /agent/register                  │
     │  { extWorkspaceId, token }             │
     │ ──────────────────────────────────────▶ │
     │                                        │  Validate token
     │                                        │  Generate CSR (CN=agent-{uid}, OU={workspaceUid})
     │                                        │  Sign CSR via Step CA
     │                                        │  Store cert metadata (serial, fingerprint, expiry)
     │  { caCert, clientCert, clientKey }     │
     │ ◀────────────────────────────────────── │
     │                                        │
     │  Store certs in K8s Secret             │
     └────────────────────────────────────────┘
```

The control plane issues the certificate via `CertService`, which calls Step CA's `/1.0/sign` HTTP API using a JWK provisioner token. The agent receives:

- `clientCert`: leaf cert + intermediate cert (full chain)
- `clientKey`: private key
- `caCert`: root CA cert (for verifying the server)

### 2. Ongoing Sync (with mTLS)

Every 30 seconds, the agent calls `/agent/sync` presenting its client certificate:

```
Agent                    Reverse Proxy              Express API
  │                      (Caddy / nginx)                │
  │ ──TLS handshake──▶  │                              │
  │   client cert        │  Verify client cert          │
  │   + intermediate     │  against CA bundle           │
  │                      │  (root + intermediate)       │
  │                      │                              │
  │                      │ ──HTTP──▶                    │
  │                      │  ssl-client-verify: SUCCESS  │
  │                      │  ssl-client-subject-dn: ...  │
  │                      │                              │
  │                      │              Parse CN → agentId
  │                      │              Parse OU → workspaceId
  │                      │              Lookup agent, check status
  │  ◀──── workspace config ───────────────────────────│
  └────────────────────────────────────────────────────┘
```

## Design Decision: Proxy-Terminated mTLS

### Considered Alternatives

| Approach | How it works | Pros | Cons |
|----------|-------------|------|------|
| **Express direct HTTPS** | `https.createServer` with `requestCert: true` | Simple, no extra components | Manual cert bundle management, error-prone chain handling, doesn't match production topology |
| **Proxy-terminated mTLS** | Caddy/nginx handles TLS + client cert verification, Express reads headers | Matches production, no TLS code in app, cert management handled by infrastructure | Extra hop, need to trust proxy headers |
| **Service mesh (Istio)** | Sidecar proxy handles all mTLS transparently | Zero app changes, auto-rotation | Heavy, overkill for agent→API pattern |

### Decision

**Proxy-terminated mTLS.** Express serves plain HTTP. The reverse proxy terminates TLS, verifies client certificates, and passes the verified identity to Express via HTTP headers.

### Rationale

1. **Same topology everywhere**: Local dev (Caddy) and production (nginx ingress) work the same way. The app code is identical in both environments.

2. **No TLS complexity in application code**: No more `serverCertPath`, `serverKeyPath`, `serverCACertPath`, cert bundles, fullchains. The proxy handles all of it.

3. **Infrastructure handles cert lifecycle**: In Kubernetes, cert-manager auto-provisions and rotates server TLS certs via Step CA ACME. The app doesn't touch any certificate files.

4. **Standard pattern**: This is how mTLS works in most production Kubernetes deployments. nginx ingress mTLS annotations are well-documented and widely used.

### Trade-off: Header Trust

The app trusts `ssl-client-verify` and `ssl-client-subject-dn` headers from the proxy. If Express were exposed directly, an attacker could spoof these headers. Mitigations:

- **Local dev**: Caddy is the only entry point; Express listens on `localhost`
- **Kubernetes**: Express pod is only reachable via the ingress; no NodePort/LoadBalancer
- **Express**: `app.set('trust proxy', true)` is configured

## Implementation Details

### Certificate Identity Encoding

Agent identity is embedded in the X.509 certificate subject:

| Field | Value | Purpose |
|-------|-------|---------|
| CN (Common Name) | `agent-{agentUid}` | Uniquely identifies the agent |
| OU (Organizational Unit) | `{workspaceUid}` | Links agent to its workspace |
| O (Organization) | `SaaS Data Platform` | Platform identifier |

The middleware parses these from the `ssl-client-subject-dn` header (DN format: `CN=agent-xxx,OU=workspace-yyy,O=SaaS Data Platform`).

### CA Provider Architecture

Certificate issuance supports multiple backends via the provider pattern:

```
CertService
  ├── SelfSignedProvider   — per-workspace CA, no external deps (dev/testing)
  ├── StepCaProvider       — shared CA via Step CA HTTP API (current)
  └── AwsPcaProvider       — AWS Private CA (future, production)
```

All providers return the same `AgentMTLSCredentials` interface. The proxy doesn't care which provider issued the cert — it only needs the CA bundle to verify.

### Chain Completeness

A common mTLS failure mode is incomplete certificate chains. Both directions must be complete:

**Server → Client** (server presenting itself):
```
Server cert + Intermediate cert = fullchain
Client trusts: Root CA
Verification: client cert ← intermediate ← root ✓
```

**Client → Server** (agent presenting itself):
```
Agent cert + Intermediate cert = full client chain
Server trusts: Root CA + Intermediate CA (CA bundle)
Verification: agent cert ← intermediate ← root ✓
```

The `StepCaProvider.signCsr()` method includes the intermediate cert from Step CA's response (`parsed.crt + parsed.ca`) so agents always present a complete chain.

### Proxy Configuration

**Caddy (local dev)** — `docker/caddy/Caddyfile`:
- `client_auth { mode request }` — optional client cert (not all routes need mTLS)
- `trust_pool file` — root + intermediate CA for chain verification
- `header_up ssl-client-verify` / `ssl-client-subject-dn` — forward identity

**nginx ingress (Kubernetes)** — `deployments/saas/bootstrap/control-plane-api/ingress.yaml`:
- `auth-tls-verify-client: "optional"` — same as Caddy's `mode request`
- `auth-tls-secret` — K8s Secret with root + intermediate CA bundle
- `auth-tls-verify-depth: "2"` — root → intermediate → agent = depth 2
- `auth-tls-pass-certificate-to-upstream: "true"` — forward identity headers

### Header Convention

The middleware accepts both nginx and Caddy header formats:

| Header | nginx value | Caddy value |
|--------|------------|-------------|
| `ssl-client-verify` | `SUCCESS` / `FAILED` / `NONE` | `true` / `false` |
| `ssl-client-subject-dn` | `CN=agent-xxx,OU=yyy` | `CN=agent-xxx,OU=yyy` |

## File Reference

| File | Role |
|------|------|
| `control-plane-api/src/middlewares/mtls.middleware.ts` | Reads identity from proxy headers |
| `control-plane-api/src/domains/certificate/cert.service.ts` | Issues agent certs via CA provider |
| `control-plane-api/src/domains/agent/agent.controller.ts` | `/agent/register` (no mTLS) and `/agent/sync` (mTLS) |
| `docker/caddy/Caddyfile` | Local dev proxy with mTLS termination |
| `deployments/saas/bootstrap/control-plane-api/ingress.yaml` | K8s ingress with mTLS annotations |
| `tenant-agent-controller/src/agent_client.py` | Agent-side mTLS client (presents cert to proxy) |

## Future Considerations

- **cert-manager for agent certs**: Replace `CertService` with cert-manager `Certificate` resources in tenant clusters using a `StepClusterIssuer`. Removes cert issuance code from the API entirely.
- **Certificate rotation**: Agents currently get a cert once during registration. Add a renewal flow before expiry.
- **Certificate revocation**: Store serial numbers in DB for revocation checks. Currently tracked (`certSerialNumber`) but not enforced.
