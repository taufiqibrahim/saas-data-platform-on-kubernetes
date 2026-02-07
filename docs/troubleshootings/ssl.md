# SSL Troubleshootings

## Verify Cert is not expired
```bash
openssl x509 -in <certfile> -noout -dates

# Step CA initial certs
openssl x509 -in docker/step-ca/certs/root_ca.crt -noout -dates
openssl x509 -in docker/step-ca/certs/intermediate_ca.crt -noout -dates

# Control plane certs
openssl x509 -in control-plane-api/certs/server.crt -noout -dates

# Agent certs
openssl x509 -in /tmp/tenant-agent/certs/client.crt -noout -dates
openssl x509 -in /tmp/tenant-agent/certs/ca.crt -noout -dates
```

## Verify Chain
```bash
openssl x509 -in control-plane-api/certs/server.crt -text -noout
```

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



Perfect — now that we have the full stack (Step CA → Express server → Tenant client), we can make a **focused mTLS troubleshooting sequence** covering each component. I’ll include the short instruction for each.

---

## **🔹 TLS/mTLS Troubleshooting Sequence**

For easier let's make the path as variables.

```bash
export ROOT_CA=docker/step-ca/certs/root_ca.crt
export INTERMEDIATE_CA=docker/step-ca/certs/intermediate_ca.crt
export SERVER_CERT=control-plane-api/certs/server.crt
export AGENT_CERT=/tmp/tenant-agent/certs/client.crt
export AGENT_KEY=/tmp/tenant-agent/certs/client.key
export AGENT_CA=/tmp/tenant-agent/certs/ca.crt
```

### **1️⃣ Step CA**

* **Check CA files:**

  * `root_ca.crt` → Root CA
  * `intermediate_ca.crt` → Intermediate CA(s)

* **Verify chain:**

```bash
openssl verify -CAfile $ROOT_CA -untrusted $INTERMEDIATE_CA $SERVER_CERT
```

  * Should return: `server.crt: OK`
* **Check durations:** Make sure certs are not expired.
```bash
# Step CA initial certs
openssl x509 -in $ROOT_CA -noout -dates
openssl x509 -in $INTERMEDIATE_CA -noout -dates

# Control plane certs
openssl x509 -in $SERVER_CERT -noout -dates

# Agent certs
openssl x509 -in $AGENT_CERT -noout -dates
openssl x509 -in $AGENT_CA -noout -dates
```

---

### **2️⃣ Express Server**

* **Cert & Key:** `server.crt` + `server.key`
* **Chain:** Include intermediate CA in `server.crt` if needed.

  * Concatenate if necessary:

    ```bash
    cat server.crt intermediate_ca.crt > server_full.crt
    ```
* **Server Config (Node.js example):**

  ```ts
  const server = https.createServer({
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server_full.crt"),
    ca: fs.readFileSync("root_ca.crt"), // trust for client
    requestCert: true,
    rejectUnauthorized: true
  }, app);
  ```
* **Verify chain:**

```bash
openssl x509 -in $SERVER_CERT -text -noout
```

---

### **3️⃣ Tenant Client**

* **Files:** `client.crt`, `client.key`, `ca.crt` (trust root)
* **Check client cert:**

  ```bash
  openssl x509 -in $AGENT_CERT -text -noout
  ```
* **Check key matches cert:**

  ```bash
  openssl x509 -noout -modulus -in $AGENT_CERT | openssl md5
  openssl rsa -noout -modulus -in $AGENT_KEY | openssl md5
  ```
* **Test connection manually:**

  ```bash
  openssl s_client -connect localhost:5002 \
      -cert $AGENT_CERT -key $AGENT_KEY -CAfile $AGENT_CA
  ```

  * `Verify return code: 0 (ok)` → success.
  * Errors like `unable to get issuer certificate` → chain issue.


### **4️⃣ Common Pitfalls**

| Issue                                          | Likely Cause                   | Fix                                                    |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| `unable to get issuer certificate`             | Missing intermediate CA        | Include `intermediate_ca.crt` in server cert or CAfile |
| `certificate verify failed`                    | Client doesn’t trust server CA | Use proper `ca.crt` on client side                     |
| `self signed certificate in certificate chain` | Server sent wrong chain        | Concatenate intermediate(s) to server cert             |
| `tlsSocket.authorized === false`               | Node rejects client cert       | Make sure server `ca` trusts client root               |

### **5️⃣ Debug Flow**

1. Verify **Step CA** chain (`root + intermediate`)
2. Verify **server cert** against Step CA
3. Verify **client cert** against Step CA
4. Test **mTLS connection** using `openssl s_client`
5. Check **server logs** for `tlsSocket.authorizationError`
