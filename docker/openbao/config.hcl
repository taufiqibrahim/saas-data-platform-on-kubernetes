ui = true

storage "raft" {
  path = "/mnt/openbao/data"
}

listener "tcp" {
  address         = "0.0.0.0:8200"

  # disable TLS inside OpenBao because Caddy will terminate TLS
  tls_disable     = true
}

api_addr = "https://bao.saas.local"
cluster_addr = "https://openbao:8201"
