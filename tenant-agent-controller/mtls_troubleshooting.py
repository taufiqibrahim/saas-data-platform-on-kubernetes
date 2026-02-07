import json
import ssl
import socket

HOST = "apidev.saas.internal"
PORT = 443
PATH = "/api/v1/agent/sync"

CAFILE="/tmp/tenant-agent/certs/ca.crt"
CERTFILE="/tmp/tenant-agent/certs/client.crt"
KEYFILE="/tmp/tenant-agent/certs/client.key"

ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=CAFILE)

ctx.load_cert_chain(certfile=CERTFILE, keyfile=KEYFILE)

with socket.create_connection((HOST, PORT)) as sock:
    with ctx.wrap_socket(sock, server_hostname=HOST) as ssock:
        print("TLS established")
        print("Cipher:", ssock.cipher())

payload = json.dumps({
    "status": "ok",
    "agent": "test",
})
request = (
    f"POST {PATH} HTTP/1.1\r\n"
    f"Host: {HOST}\r\n"
    f"Content-Type: application/json\r\n"
    f"Content-Length: {len(payload)}\r\n"
    f"Connection: close\r\n"
    f"\r\n"
    f"{payload}"
)

with socket.create_connection((HOST, PORT)) as sock:
    with ctx.wrap_socket(sock, server_hostname=HOST) as ssock:
        print("TLS established")
        print("Cipher:", ssock.cipher())
        print("Peer:", ssock.getpeercert())

        ssock.sendall(request.encode("utf-8"))

        response = b""
        while True:
            data = ssock.recv(4096)
            if not data:
                break
            response += data

print(response.decode("utf-8"))


import ssl
import httpx

ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=CAFILE)

ctx.load_cert_chain(CERTFILE, KEYFILE)

ctx.verify_mode = ssl.CERT_REQUIRED
ctx.check_hostname = True

transport = httpx.HTTPTransport(verify=ctx)

client = httpx.Client(transport=transport)

resp = client.post(
    f"https://{HOST}/api/v1/agent/sync",
    data={"status": "ok", "agent": "test"},
)

print(resp.status_code, resp.text)
