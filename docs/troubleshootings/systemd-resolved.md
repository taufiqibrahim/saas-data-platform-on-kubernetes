# Troubleshooting systemd-resolved


## Check the critical symlink: /etc/resolv.conf
This is the most common problem.

### What it SHOULD be
```bash
/etc/resolv.conf -> /run/systemd/resolve/stub-resolv.conf
```

### Check current state
```bash
ls -l /etc/resolv.conf
```

Possible bad states

* Points to /run/systemd/resolve/resolv.conf ❌
* Regular file (not a symlink) ❌
* Managed by NetworkManager or Docker ❌

### Fix /etc/resolv.conf (safe method)

Step 1: Remove the existing file
```bash
sudo rm -f /etc/resolv.conf
```

Step 2: Create the correct symlink
```bash
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
```

Step 3: Restart services
```bash
sudo systemctl restart systemd-resolved
```

Verify:
```bash
nslookup google.com
dig google.com
```

## Check /etc/systemd/resolved.conf

Step 1: Check
```bash
sudo cat /etc/systemd/resolved.conf
```

Step 2: Edit and fix

There will be lots of commented text. Make sure something like this at the end.
```bash
sudo nano /etc/systemd/resolved.conf

...
DNS=8.8.8.8
FallbackDNS=1.1.1.1 8.8.4.4
DNSStubListener=yes
```
Save it.

Step 3: Restart services
```bash
sudo systemctl restart systemd-resolved
```

Verify:
```bash
nslookup google.com
dig google.com
```
