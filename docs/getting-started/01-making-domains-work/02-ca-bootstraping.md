# Private Certificate

In this section, we’ll set up a **local private Certificate Authority (CA)** using [Step CA](https://smallstep.com/docs/step-ca/) and establish trust on your host machine.

Step CA is a private CA for automated management of **X.509 TLS certificates** and SSH keys, perfect for local development.

## What You’ll Achieve

By the end of this section:

- A single **root CA** is created  
- The root CA is trusted by your OS and browser  
- Any certificate issued by Step CA is automatically trusted

## Architecture Overview

```
+-------------+
|   Browser   |
+------+------+
       |
       | trusts
       |
+------v------+
|   Step CA   |  <--- Root CA
+------+------+
       |
       | issues certs
       |
+------v--------+
| Caddy/Ingress |
+---------------+
```

> ⚠️ Important:
> **You only install trust once** (the root CA).
> All future TLS certificates are accepted automatically.

## Prerequisites
- Docker + Docker Compose

## Step 1 — Create Step CA Data Directory and Password

> `docker/step-ca` is git-ignored.

```bash
# Create directory structure with correct permissions
mkdir -p docker/step-ca/secrets docker/step-ca/certs && \
  sudo chown -R 1000:1000 docker/step-ca
```

## Step 2 — Initialize the Certificate Authority
We run Step CA CLI as a **Docker container**, so it is:

* Easy to reset
* Isolated
* Identical across OSes

We will initialize Step CA using Docker container which writes to `docker/step-ca` we created earlier and mount the resulting init configuration on a Docker volume.

Run:
```bash
docker compose run --rm step-ca-init
```

That command above should output something like following example output:
```
...TODO
```

All data generated is stored in `docker/step-ca` directory.
```bash
./docker/step-ca/
├── certs
│   ├── intermediate_ca.crt        # Intermediate certificate
│   └── root_ca.crt                # Root certificate
├── config
│   ├── ca.json                    # Certificate Authority configuration
│   └── defaults.json              # Default configuration
├── db                             # Database folder
├── secrets
│   ├── intermediate_ca_key        # Intermediate private key
│   ├── password                   # Password content
│   └── root_ca_key                # Root private key
└── templates
```

We will install **only the root CA**.

## Step 3 — Install Root CA into OS Trust Store

### Linux (Ubuntu / Debian)

```bash
sudo cp docker/step-ca/certs/root_ca.crt /usr/local/share/ca-certificates/saas-ca.crt
sudo update-ca-certificates --fresh
```

Verify:
```bash
sudo openssl verify /usr/local/share/ca-certificates/saas-ca.crt
# Should output
# /usr/local/share/ca-certificates/saas-ca.crt: OK
```

#### Google Chrome
Special treatment needed on Google Chrome since it uses NSS (Network Security Services) database, not the system store

```bash
# Install certutil if not already installed
sudo apt install libnss3-tools

# Add the certificate to Chrome's NSS database
sudo certutil -d sql:$HOME/.pki/nssdb -D -n "SaaS Local CA"
sudo certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "SaaS Local CA" -i /usr/local/share/ca-certificates/saas-ca.crt

# Verify it was added
certutil -d sql:$HOME/.pki/nssdb -L
```

### macOS
```bash
sudo security add-trusted-cert \
  -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  docker/step-ca/certs/root_ca.crt
```

### Windows
1. Copy `docker/step-ca/certs/root_ca.crt` into Windows folder.
2. Double-click `root_ca.crt`
3. Install Certificate
4. Choose **Local Machine**
5. Place into **Trusted Root Certification Authorities**
6. Finish the wizard

## What We Have Now

At this point:

* ✅ Root CA generated and is trusted system-wide
* ✅ Ready to issue unlimited certificates

## Next
- [DNS Setup](./c-setup-dns.md)
