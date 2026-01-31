# Restoring systemd-resolved to Default Configuration

This guide will help you understand and restore your DNS setup to the default systemd-resolved configuration. We'll go step-by-step, explaining what each command does and why.

---

## Part 1: Understanding Your Current State

Before making changes, let's understand what you have now.

### Step 1.1: Check systemd-resolved Service Status

```bash
systemctl status systemd-resolved
```

**What to look for:**
- `Active: active (running)` - Service is running ✓
- `Active: inactive (dead)` - Service is stopped ✗
- `Loaded: loaded` - Service file exists ✓
- `enabled` - Will start on boot ✓

**Why this matters:** systemd-resolved must be running for the default DNS setup to work.

---

### Step 1.2: Check What's Listening on Port 53

```bash
sudo lsof -i :53
```

**Expected output (default):**
```
COMMAND    PID             USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
systemd-r  1234 systemd-resolve   14u  IPv4  12345      0t0  UDP 127.0.0.53:domain
systemd-r  1234 systemd-resolve   15u  IPv4  12345      0t0  TCP 127.0.0.53:domain (LISTEN)
```

**What this shows:**
- `127.0.0.53:domain` - systemd-resolved listening on the stub address ✓
- `127.0.0.54:domain` - Secondary listener (you have this, which is unusual but not wrong)
- `127.0.0.1:domain` - If you see this, something else is running on port 53 ✗

**Why this matters:** Only systemd-resolved should be on port 53 in the default setup. Multiple DNS servers competing causes conflicts.

---

### Step 1.3: Check /etc/resolv.conf Type

```bash
ls -la /etc/resolv.conf
```

**Expected output (default):**
```
lrwxrwxrwx 1 root root 39 Jan 15 10:00 /etc/resolv.conf -> ../run/systemd/resolve/stub-resolv.conf
```

**What to look for:**
- First character `l` means it's a symlink (symbolic link) ✓
- Arrow `->` shows what it links to
- Should point to `../run/systemd/resolve/stub-resolv.conf` ✓

**Your case:**
```
-rw-r--r-- 1 root root 128 Jan 31 10:00 /etc/resolv.conf
```
- First character `-` means it's a regular file ✗
- No arrow, no link ✗

**Why this matters:** The symlink ensures /etc/resolv.conf always points to systemd-resolved's configuration. A regular file means something broke this link.

---

### Step 1.4: Check What's IN /etc/resolv.conf

```bash
cat /etc/resolv.conf
```

**Your current content (broken):**
```
nameserver 127.0.0.1
nameserver 8.8.8.8
```

**Expected content (after following symlink):**
```
nameserver 127.0.0.53
options edns0 trust-ad
search .
```

**Why this matters:** `127.0.0.1` points to nothing, `127.0.0.53` points to systemd-resolved.

---

### Step 1.5: Check systemd-resolved Configuration

```bash
cat /etc/systemd/resolved.conf
```

**Default content:**
Most lines are commented out (start with `#`), which means they use defaults:
```ini
[Resolve]
#DNS=
#FallbackDNS=
#Domains=
#DNSSEC=allow-downgrade
#DNSOverTLS=no
#MulticastDNS=yes
#LLMNR=yes
#Cache=yes
#DNSStubListener=yes
#ReadEtcHosts=yes
```

**What to check:**
- Are there any UNcommented lines? (lines without `#`)
- Did you or something else add custom DNS servers?
- Is `DNSStubListener` set to `no`? (This would break the default setup)

**Why this matters:** Custom configurations here override the defaults and might conflict with your setup.

---

### Step 1.6: Check for Override Configuration Files

```bash
ls -la /etc/systemd/resolved.conf.d/
```

**Expected:**
- Directory might not exist, or
- Directory is empty, or
- Contains only distribution-specific files

**What to look for:**
- Any `.conf` files you don't recognize
- Files with custom DNS configurations

**Why this matters:** Files in this directory override settings in `/etc/systemd/resolved.conf`. They might contain conflicting settings.

---

### Step 1.7: Check Current DNS Resolution

```bash
resolvectl status
```

**What this shows:**
```
Global
       Protocols: +LLMNR +mDNS -DNSOverTLS DNSSEC=no/unsupported
resolv.conf mode: stub
Current DNS Server: 192.168.1.1
       DNS Servers: 192.168.1.1 8.8.8.8

Link 2 (eth0)
    Current Scopes: DNS
         Protocols: +DefaultRoute +LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported
Current DNS Server: 192.168.1.1
       DNS Servers: 192.168.1.1
```

**Key fields to note:**
- `resolv.conf mode` - Should say `stub` (uses 127.0.0.53)
- `Current DNS Server` - What systemd-resolved is actually using
- `DNS Servers` - All configured DNS servers
- Per-Link settings - DNS for each network interface

**Why this matters:** This shows what systemd-resolved thinks is configured, regardless of what's in /etc/resolv.conf.

---

## Part 2: Backing Up Current Configuration

Before making changes, ALWAYS back up. This lets you undo if something goes wrong.

### Step 2.1: Backup /etc/resolv.conf

```bash
sudo cp /etc/resolv.conf /etc/resolv.conf.backup
```

**What this does:**
- `cp` = copy command
- Creates a backup file with `.backup` extension
- If restoration fails, you can restore with: `sudo cp /etc/resolv.conf.backup /etc/resolv.conf`

---

### Step 2.2: Backup systemd-resolved Configuration

```bash
sudo cp /etc/systemd/resolved.conf /etc/systemd/resolved.conf.backup
```

**Why:** Same reason - safety net.

---

### Step 2.3: Backup Override Directory (if exists)

```bash
# Check if directory exists
if [ -d /etc/systemd/resolved.conf.d ]; then
    sudo cp -r /etc/systemd/resolved.conf.d /etc/systemd/resolved.conf.d.backup
    echo "Backup created"
else
    echo "No override directory to backup"
fi
```

**What this does:**
- `[ -d path ]` checks if directory exists
- `cp -r` copies directory recursively (all contents)
- Backs up any custom configuration files

---

### Step 2.4: Document Current DNS Servers

```bash
resolvectl status > ~/dns-status-before.txt
cat /etc/resolv.conf >> ~/dns-status-before.txt
```

**What this does:**
- `>` redirects output to a file
- `>>` appends to a file
- Saves your current DNS configuration to your home directory
- You can review this later if needed

---

## Part 3: Stop Conflicting Services

Before restoring defaults, we need to stop anything that might conflict.

### Step 3.1: Check for Other DNS Services

```bash
sudo systemctl status dnsmasq
sudo systemctl status bind9
sudo systemctl status unbound
sudo systemctl status pdns-recursor
```

**What to do:**
- If any show `Active: active (running)`, they might conflict
- You need to decide: Do you want these services or systemd-resolved?

**For default systemd-resolved setup:**
```bash
# Stop and disable each conflicting service
sudo systemctl stop dnsmasq
sudo systemctl disable dnsmasq

# Repeat for bind9, unbound, pdns-recursor if running
```

**What this does:**
- `stop` - Stops the service immediately
- `disable` - Prevents it from starting on boot
- This doesn't uninstall, just deactivates

**Important:** Only do this if you want the DEFAULT setup. If you installed these intentionally, you might want to keep them.

---

### Step 3.2: Check for Docker DNS Interference

```bash
# Check if Docker is managing DNS
if [ -f /etc/docker/daemon.json ]; then
    cat /etc/docker/daemon.json
fi
```

**If you see DNS configuration in Docker:**
```json
{
  "dns": ["127.0.0.1"],
  "dns-search": ["."]
}
```

**Why this matters:** Docker sometimes takes over DNS. For now, just note if Docker has DNS config. We'll address this later if needed.

---

## Part 4: Restore systemd-resolved Configuration

Now we restore the default configuration files.

### Step 4.1: Restore Default resolved.conf

**Option A: Reset to distribution defaults**
```bash
# Ubuntu/Debian - reinstall the package config
sudo apt-get install --reinstall systemd

# Or manually restore defaults
sudo tee /etc/systemd/resolved.conf > /dev/null << 'EOF'
#  This file is part of systemd.
#
#  systemd is free software; you can redistribute it and/or modify it
#  under the terms of the GNU Lesser General Public License as published by
#  the Free Software Foundation; either version 2.1 of the License, or
#  (at your option) any later version.
#
# Entries in this file show the compile time defaults.
# You can change settings by editing this file.
# Defaults can be restored by simply deleting this file.
#
# See resolved.conf(5) for details

[Resolve]
#DNS=
#FallbackDNS=
#Domains=
#LLMNR=yes
#MulticastDNS=yes
#DNSSEC=allow-downgrade
#DNSOverTLS=no
#Cache=yes
#DNSStubListener=yes
#ReadEtcHosts=yes
#ResolveUnicastSingleLabel=no
EOF
```

**What this does:**
- `tee` writes to file (like `echo` but for entire blocks)
- `> /dev/null` suppresses output to terminal
- `<< 'EOF'` starts a "here document" - everything until next `EOF` is the content
- All settings are commented (`#`) which means "use defaults"

**What the defaults mean:**
- `DNSStubListener=yes` - Listen on 127.0.0.53:53 ✓
- `Cache=yes` - Cache DNS queries ✓
- `ReadEtcHosts=yes` - Check /etc/hosts file ✓
- `DNSSEC=allow-downgrade` - Use DNSSEC when possible ✓

---

### Step 4.2: Remove Override Configurations

```bash
# List what's in the override directory
ls -la /etc/systemd/resolved.conf.d/

# Remove override files (BE CAREFUL - check what you're removing first!)
# Don't blindly copy this - check each file first!
sudo rm /etc/systemd/resolved.conf.d/*.conf
```

**BE CAREFUL:** 
- Look at what's in this directory FIRST
- Some might be distribution-specific (like Ubuntu's default configs)
- Only remove files YOU created or that are clearly custom

**Safer approach:**
```bash
# Move instead of delete (you can restore later)
sudo mkdir -p ~/dns-backup-configs
sudo mv /etc/systemd/resolved.conf.d/*.conf ~/dns-backup-configs/
```

---

### Step 4.3: Restart systemd-resolved

```bash
sudo systemctl restart systemd-resolved
```

**What this does:**
- Stops and starts systemd-resolved service
- Loads new configuration
- Clears DNS cache

**Check it worked:**
```bash
systemctl status systemd-resolved
```

Look for `Active: active (running)` in green.

---

## Part 5: Restore /etc/resolv.conf Symlink

This is the critical step to reconnect everything.

### Step 5.1: Remove Current resolv.conf

```bash
# First, check what it is
ls -la /etc/resolv.conf

# If it's a regular file, remove it
sudo rm /etc/resolv.conf
```

**What this does:**
- Removes the broken/regular file
- Makes way for the proper symlink

**Note:** DNS will be broken for a few seconds until we create the new symlink. Work quickly through the next step.

---

### Step 5.2: Create Proper Symlink

```bash
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
```

**What this does:**
- `ln -s` creates a symbolic link (symlink)
- Source: `/run/systemd/resolve/stub-resolv.conf` (the stub file)
- Destination: `/etc/resolv.conf` (what applications read)

**Verify it worked:**
```bash
ls -la /etc/resolv.conf
```

Should show:
```
lrwxrwxrwx 1 root root 39 ... /etc/resolv.conf -> ../run/systemd/resolve/stub-resolv.conf
```

The `l` at the start and the arrow `->` confirm it's a symlink.

---

### Step 5.3: Verify Contents

```bash
cat /etc/resolv.conf
```

**Should show:**
```
# This is /run/systemd/resolve/stub-resolv.conf managed by man:systemd-resolved(8).
# Do not edit.

nameserver 127.0.0.53
options edns0 trust-ad
search .
```

**What each line means:**
- `nameserver 127.0.0.53` - Send DNS queries here (systemd-resolved stub)
- `options edns0` - Use EDNS (Extension mechanisms for DNS)
- `trust-ad` - Trust the AD (Authentic Data) bit in responses
- `search .` - DNS search domain (root domain)

---

## Part 6: Verify Everything Works

Now test that DNS resolution works properly.

### Step 6.1: Test Basic DNS Query

```bash
nslookup google.com
```

**Expected output:**
```
Server:         127.0.0.53
Address:        127.0.0.53#53

Non-authoritative answer:
Name:   google.com
Address: 142.250.185.46
```

**What to check:**
- `Server: 127.0.0.53` - Confirms using systemd-resolved ✓
- Gets an IP address ✓
- NO "connection refused" errors ✓

---

### Step 6.2: Test with dig

```bash
dig google.com
```

**Look for:**
```
;; Query time: 10 msec
;; SERVER: 127.0.0.53#53(127.0.0.53)
;; WHEN: Sat Jan 31 12:00:00 WIB 2026
;; MSG SIZE  rcvd: 55
```

**What to check:**
- `SERVER: 127.0.0.53` ✓
- Query succeeds ✓
- Reasonable query time (< 100ms first time, < 10ms cached) ✓

---

### Step 6.3: Test with resolvectl

```bash
resolvectl query google.com
```

**Expected output:**
```
google.com: 142.250.185.46
-- link: eth0
```

**What this shows:**
- Direct query to systemd-resolved (bypasses /etc/resolv.conf)
- Which interface DNS came from
- Confirms systemd-resolved is working internally

---

### Step 6.4: Check Status Again

```bash
resolvectl status
```

**Should now show:**
```
Global
       Protocols: +LLMNR +mDNS -DNSOverTLS DNSSEC=no/unsupported
resolv.conf mode: stub
```

**Key field:**
- `resolv.conf mode: stub` - Confirms using the stub resolver ✓

If it says `foreign` or `uplink`, something is still wrong.

---

### Step 6.5: Test Cache

```bash
# First query (uncached) - note the time
dig google.com | grep "Query time"

# Second query (cached) - should be much faster
dig google.com | grep "Query time"
```

**Expected:**
- First query: 10-50ms (goes to upstream DNS)
- Second query: 0-2ms (from cache)

**This proves:**
- Cache is working ✓
- systemd-resolved is functioning properly ✓

---

## Part 7: Understanding What Changed

Let's compare before and after to understand what we fixed.

### The Broken State (Before)

```
Application (curl, firefox)
    ↓
reads /etc/resolv.conf (regular file)
    ↓
nameserver 127.0.0.1 ← NOTHING LISTENING HERE!
    ↓
Connection refused
    ↓
Falls back to 8.8.8.8 (bypasses systemd-resolved)
```

**Problems:**
- No caching
- No DNSSEC
- No per-interface DNS
- Unreliable (fallback behavior)

---

### The Fixed State (After)

```
Application (curl, firefox)
    ↓
reads /etc/resolv.conf (symlink)
    ↓
follows symlink → /run/systemd/resolve/stub-resolv.conf
    ↓
nameserver 127.0.0.53
    ↓
systemd-resolved stub listener (127.0.0.53:53)
    ↓
systemd-resolved daemon
    ├─ Checks cache
    ├─ Checks /etc/hosts
    └─ Forwards to upstream DNS
    ↓
Response cached and returned
```

**Benefits:**
- DNS caching (faster repeat queries)
- DNSSEC validation (security)
- Per-interface DNS (VPN/multi-network support)
- Integrated with NetworkManager
- Proper fallback handling

---

## Part 8: Long-term Maintenance

How to keep it working.

### Step 8.1: Prevent Future Breakage

**Protect /etc/resolv.conf from accidental overwrites:**

Some applications try to write to /etc/resolv.conf. The symlink prevents this, but you can add extra protection:

```bash
# Make the symlink immutable (advanced, optional)
sudo chattr +i /etc/resolv.conf

# Check it's protected
lsattr /etc/resolv.conf
```

**Should show:**
```
----i---------e----- /etc/resolv.conf
```

The `i` means immutable.

**To undo this later (if needed):**
```bash
sudo chattr -i /etc/resolv.conf
```

---

### Step 8.2: Configure NetworkManager Properly

If you use NetworkManager, configure it to work WITH systemd-resolved:

```bash
# Check if you have NetworkManager
systemctl status NetworkManager
```

**If running, configure it:**

```bash
sudo tee /etc/NetworkManager/conf.d/dns.conf << EOF
[main]
dns=systemd-resolved
EOF

sudo systemctl restart NetworkManager
```

**What this does:**
- Tells NetworkManager to send DNS info to systemd-resolved
- Prevents NetworkManager from overwriting /etc/resolv.conf
- They work together instead of fighting

---

### Step 8.3: Configure Docker (if you use it)

Docker can interfere with DNS. Configure it properly:

```bash
# Create or edit /etc/docker/daemon.json
sudo tee /etc/docker/daemon.json << EOF
{
  "dns": ["127.0.0.53"]
}
EOF

sudo systemctl restart docker
```

**What this does:**
- Tells Docker containers to use systemd-resolved
- Prevents Docker from overwriting /etc/resolv.conf
- Containers get proper DNS resolution

---

### Step 8.4: Monitor DNS Health

Create a simple check you can run anytime:

```bash
# Save this as ~/check-dns.sh
tee ~/check-dns.sh << 'EOF'
#!/bin/bash
echo "=== DNS Health Check ==="
echo ""
echo "1. resolv.conf type:"
ls -la /etc/resolv.conf
echo ""
echo "2. resolv.conf content:"
cat /etc/resolv.conf
echo ""
echo "3. systemd-resolved status:"
systemctl status systemd-resolved | grep Active
echo ""
echo "4. Current DNS servers:"
resolvectl status | grep "DNS Servers"
echo ""
echo "5. Test query:"
dig +short google.com
echo ""
echo "=== End Health Check ==="
EOF

chmod +x ~/check-dns.sh
```

**Run anytime:**
```bash
~/check-dns.sh
```

---

## Part 9: Troubleshooting Common Issues

If things still don't work after restoration.

### Issue 1: "connection refused" Still Appearing

**Diagnosis:**
```bash
sudo lsof -i :53
```

**If you see nothing on 127.0.0.53:**
- systemd-resolved isn't listening

**Fix:**
```bash
# Check logs for errors
journalctl -u systemd-resolved -n 50

# Try enabling stub listener explicitly
sudo sed -i 's/#DNSStubListener=yes/DNSStubListener=yes/' /etc/systemd/resolved.conf
sudo systemctl restart systemd-resolved
```

---

### Issue 2: DNS Queries Timeout

**Diagnosis:**
```bash
resolvectl status
```

**Check for:**
- No upstream DNS servers configured
- All DNS servers unreachable

**Fix:**
```bash
# Temporarily set public DNS
sudo resolvectl dns eth0 8.8.8.8 8.8.4.4

# Or configure permanently
sudo tee -a /etc/systemd/resolved.conf << EOF

[Resolve]
DNS=8.8.8.8 8.8.4.4
FallbackDNS=1.1.1.1
EOF

sudo systemctl restart systemd-resolved
```

---

### Issue 3: Symlink Keeps Getting Replaced

**Diagnosis:**
```bash
# Check what's overwriting it
sudo journalctl -n 1000 | grep resolv.conf
```

**Common culprits:**
- NetworkManager (misconfigured)
- dhclient (old DHCP client)
- VPN software
- Docker

**Fix:** Configure the offending software (see Steps 8.2, 8.3)

---

### Issue 4: "resolv.conf mode: foreign"

**This means:** Something else is managing /etc/resolv.conf

**Fix:**
```bash
# Force stub mode
sudo rm /etc/resolv.conf
sudo ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
sudo systemctl restart systemd-resolved

# Check again
resolvectl status | grep "resolv.conf mode"
```

---

## Part 10: Summary Checklist

After completing all steps, verify:

- [ ] systemd-resolved is active and running
- [ ] /etc/resolv.conf is a symlink to stub-resolv.conf
- [ ] /etc/resolv.conf contains `nameserver 127.0.0.53`
- [ ] Only systemd-resolved is listening on port 53
- [ ] `resolvectl status` shows `resolv.conf mode: stub`
- [ ] `nslookup google.com` uses `Server: 127.0.0.53`
- [ ] DNS queries succeed without errors
- [ ] Second queries are faster (cache working)
- [ ] Backups created of old configuration
- [ ] NetworkManager configured (if used)
- [ ] Docker configured (if used)

---

## Key Learning Points

**What you learned:**

1. **Symlinks vs Regular Files**
   - Symlinks point to other files
   - Breaking the symlink breaks the DNS chain
   - `ls -la` shows symlinks with `l` and `→`

2. **systemd-resolved Architecture**
   - Stub listener on 127.0.0.53:53
   - Central DNS management
   - Caching and DNSSEC
   - Per-interface DNS support

3. **DNS Resolution Flow**
   - Application → glibc → /etc/resolv.conf → systemd-resolved → upstream DNS
   - Each step must work for DNS to function

4. **Configuration Hierarchy**
   - /etc/systemd/resolved.conf (main config)
   - /etc/systemd/resolved.conf.d/*.conf (overrides)
   - Per-interface settings (from DHCP/NetworkManager)
   - Fallback DNS (last resort)

5. **Why Defaults Matter**
   - Distributions test defaults extensively
   - Custom configs often conflict with system tools
   - Understanding defaults helps debug issues

---

## What to Do If You Get Stuck

1. **Check Backups**
   ```bash
   ls -la /etc/resolv.conf.backup
   ls -la /etc/systemd/resolved.conf.backup
   ```

2. **Review Logs**
   ```bash
   journalctl -u systemd-resolved -n 100
   ```

3. **Ask for Help**
   - Include output of `resolvectl status`
   - Include output of `ls -la /etc/resolv.conf`
   - Include output of `sudo lsof -i :53`
   - Include any error messages

4. **Temporary Bypass** (if truly stuck)
   ```bash
   # Use Google DNS directly (temporary!)
   echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
   ```

---

**Good luck! Take it slow, read each section, and understand what you're doing before executing commands.**
