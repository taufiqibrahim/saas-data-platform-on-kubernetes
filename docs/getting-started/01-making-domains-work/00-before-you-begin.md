# Before You Begin

## DNS Resolver

This project uses a local CoreDNS server for the `saas.internal` zone. To make your machine resolve those domains, you'll need to point your system DNS to `127.0.0.1`. This page helps you **back up your current config** and **set a known-good baseline** before making that switch.

> **Why this matters:** Changing your DNS resolver affects *all* name resolution on your machine. Having a documented baseline makes it easy to revert.

### Ubuntu / systemd-resolved

Most Ubuntu desktops use `systemd-resolved`. The config lives at `/etc/systemd/resolved.conf`.

#### 1. Back up current config

```bash
sudo cp /etc/systemd/resolved.conf /etc/systemd/resolved.conf.bak
```

#### 2. Set baseline

Edit `/etc/systemd/resolved.conf`:

```ini
[Resolve]
DNS=8.8.8.8
FallbackDNS=9.9.9.9 1.1.1.1 8.8.8.8 127.0.0.1
DNSStubListener=yes
```

Then restart:

```bash
sudo systemctl restart systemd-resolved
```

#### 3. Switch to local DNS (done later in [DNS Setup](./03-dns-setup.md))

```ini
[Resolve]
DNS=127.0.0.1
FallbackDNS=9.9.9.9 1.1.1.1 8.8.8.8
DNSStubListener=yes
```

#### 4. Revert

```bash
sudo cp /etc/systemd/resolved.conf.bak /etc/systemd/resolved.conf
sudo systemctl restart systemd-resolved
```

See also: [Restoring systemd-resolved defaults](../../troubleshootings/restoring-systemd-resolved-default.md)

### macOS

macOS uses `scutil` and per-domain resolver files.

#### 1. Record current DNS

```bash
scutil --dns | head -30
```

Save the output somewhere safe.

#### 2. Switch to local DNS (done later in [DNS Setup](./03-dns-setup.md))

Create a resolver file for the `saas.internal` domain only — this leaves all other DNS resolution untouched:

```bash
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/saas.internal
```

#### 3. Revert

```bash
sudo rm /etc/resolver/saas.internal
```

### Other Linux (no systemd-resolved)

If your distro uses plain `/etc/resolv.conf`:

```bash
# Back up
sudo cp /etc/resolv.conf /etc/resolv.conf.bak

# Switch to local DNS (done later)
sudo sh -c 'echo "nameserver 127.0.0.1" > /etc/resolv.conf'

# Revert
sudo cp /etc/resolv.conf.bak /etc/resolv.conf
```

> **Tip:** Some distros (Fedora, Arch) may use `NetworkManager` to manage `/etc/resolv.conf`. Check `ls -l /etc/resolv.conf` — if it's a symlink, edit via `nmcli` instead.

### Next Steps

- [Environment Preparation](./01-env-preparation.md)
