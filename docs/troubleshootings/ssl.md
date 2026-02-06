# SSL Troubleshootings

## Tenant Can Not Authenticate to Express Control Plane API

Verify control plane API server cert against root CA
```bash
openssl verify \
  -CAfile docker/step-ca/certs/root_ca.crt \
  -untrusted docker/step-ca/certs/intermediate_ca.crt \
  control-plane-api/certs/server.crt

# Should return
# control-plane-api/certs/server.crt: OK
```

```bash
server.crt
  ↑ signed by
intermediate_ca.crt
  ↑ signed by
root_ca.crt (trust anchor)
```

Verify client (tenant) cert
```bash
openssl verify \
  -CAfile docker/step-ca/certs/root_ca.crt \
  -untrusted docker/step-ca/certs/intermediate_ca.crt \
  /tmp/tenant/certs/client.crt

# Should return
# /tmp/tenant/certs/client.crt: OK
```

Run an OpenSSL TLS server (mTLS)

Start control plane API server:
```bash
cd control-plane-api
pnpm dev:api
```

Run openssl s_client against control plane express server
```bash
openssl s_client \
  -connect localhost:5002 \
  -servername saas.internal \
  -cert /tmp/tenant/certs/client.crt \
  -key /tmp/tenant/certs/client.key \
  -CAfile docker/step-ca/certs/root_ca.crt \
  -showcerts

# Should return
# Verify return code: 0 (ok)

openssl s_client \
  -connect localhost:5002 \
  -servername saas.internal \
  -cert /tmp/tenant/certs/client.crt \
  -key /tmp/tenant/certs/client.key \
  -CAfile /tmp/tenant/certs/ca.crt \
  -showcerts
# Verify return code: 2 (unable to get issuer certificate)
# Meaning the CAfile is invalid. It must be the root CA
```