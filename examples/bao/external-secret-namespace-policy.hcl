# Full access to all secrets in this namespace
path "secret/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# KV v2: metadata (REQUIRED for PushSecret)
path "secret/metadata/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Required by External Secrets Operator
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Optional: allow reading mounts
path "sys/mounts" {
  capabilities = ["read"]
}
