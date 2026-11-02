# Linux Server Administration (Milestone 7)

This document provides a comprehensive, production-grade guide to Linux server administration established during Milestone 7 of the `devops-blog` DevOps learning project.

It covers remote server access via SSH, Linux filesystem architecture, user/group security, permissions, package management, process management, `systemd` service lifecycle, centralized logging with `journalctl`, networking, firewall configuration with UFW, and server maintenance.

---

## 1. Environment Details

Our production-grade learning environment runs on an Oracle Cloud Infrastructure (OCI) Compute Instance.

| Component | Specification | Description / Role |
|---|---|---|
| **Cloud Provider** | Oracle Cloud Infrastructure (OCI) | Always Free Tier Compute Instance |
| **Operating System** | Ubuntu 26.04.1 LTS (Resolute Raccoon) | Long-Term Support release with Linux 7.0 kernel |
| **Kernel** | `7.0.0-1013-oracle` | 64-bit Linux kernel optimized for OCI hypervisor |
| **Architecture** | `x86_64` (AMD64) | 64-bit Intel/AMD standard architecture |
| **Compute** | 2 vCPUs (AMD EPYC 7551 32-Core Processor) | Dual virtual CPU cores |
| **System Memory** | 951 MiB (~1 GB) RAM | Monitored resource; efficient daemon footprint |
| **Storage** | 45 GB NVMe/SSD on `/dev/sda1` | Root filesystem (ext4) |
| **Public IP** | `129.154.253.114` | Routable IPv4 Internet gateway address |
| **Private IP** | `10.0.0.214/24` (Interface `ens3`) | Internal virtual cloud network (VCN) subnet IP |
| **Default Gateway**| `10.0.0.1` | Next-hop cloud router |

---

## 2. SSH Architecture and Remote Access

Secure Shell (SSH) is a cryptographic network protocol operating on TCP port 22 that enables secure remote command-line login and system administration over an unsecured network.

### Public Key vs. Private Key Cryptography
SSH key-based authentication relies on asymmetric cryptography:
- **Public Key (`~/.ssh/devops-lab.pub`)**: Acting like an open padlock, this key is safe to share publicly and is placed on the server in `~/.ssh/authorized_keys`.
- **Private Key (`~/.ssh/devops-lab`)**: Acting like the unique physical key, this key stays strictly on your local machine (macOS) and is **never** transmitted across the network.
- **The Challenge Flow**: When authenticating, the server encrypts a challenge using your public key; only the matching private key in your possession can solve this challenge.

```
+-------------------------------------------------------+
|  Local Workstation (macOS)                            |
|  - Private Key: ~/.ssh/devops-lab (mode 0600)         |
|  - SSH Config:  ~/.ssh/config                         |
+-------------------------------------------------------+
                           |
                           v  TCP Port 22 (Encrypted TLS/SSH tunnel)
+-------------------------------------------------------+
|  Remote Linux Server (Ubuntu 26.04)                   |
|  - Daemon: /usr/sbin/sshd (Port 22)                   |
|  - Trust:  ~/.ssh/authorized_keys (contains .pub)     |
|  - Policy: PermitRootLogin no, PasswordAuth no        |
+-------------------------------------------------------+
```

### Dedicated Key Generation
We generated an **Ed25519** key pair. Ed25519 uses the Edwards-curve Digital Signature Algorithm, offering faster performance, shorter key lengths, and superior cryptographic resistance compared to legacy RSA.

```bash
# Generate dedicated Ed25519 key pair with comment
ssh-keygen -t ed25519 -C "devops-lab-server" -f ~/.ssh/devops-lab -N ""

# Protect local private key permissions (owner read/write only)
chmod 600 ~/.ssh/devops-lab
```

### Host Aliases in `~/.ssh/config`
To avoid having to memorize server IP addresses, specify paths to keys, or risk "too many authentication attempts" from ssh-agent, we configured client aliases:

```sshconfig
Host devops-lab
    HostName 129.154.253.114
    User ubuntu
    IdentityFile ~/.ssh/devops-lab
    IdentitiesOnly yes

Host devops-admin
    HostName 129.154.253.114
    User devopsadmin
    IdentityFile ~/.ssh/devops-lab
    IdentitiesOnly yes
```

- `HostName`: Target IPv4 address.
- `User`: Remote account to log into.
- `IdentityFile`: Path to the dedicated private key.
- `IdentitiesOnly yes`: Forces SSH to use only the specified key, ignoring other identities in memory.

### Host Key Verification & `known_hosts`
When connecting to a remote host for the first time, OpenSSH presents the server's public host key fingerprint. Upon acceptance, the fingerprint is saved locally in `~/.ssh/known_hosts`. 

If a malicious third party attempts a Man-In-The-Middle (MITM) attack or if a server's identity changes without notice, SSH blocks connection with the warning:
```text
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
```

---

## 3. Linux Filesystem Structure

Linux organizes all files, hardware devices, kernel metrics, and system mounts into a single unified hierarchical tree starting at the root `/`.

| Path | Purpose | Characteristics |
|---|---|---|
| `/` | Root directory | The top of the unified filesystem hierarchy |
| `/etc` | System configuration | Host-wide plaintext configuration files (e.g. `/etc/ssh`, `/etc/sudoers`) |
| `/home` | User workspaces | Home directories for unprivileged user accounts (e.g. `/home/devopsadmin`) |
| `/root` | Root home | Dedicated workspace for the root administrative superuser |
| `/var` | Variable runtime data | Files that change continuously: spool files, databases, and logs (`/var/log`) |
| `/tmp` | Temporary files | World-writable scratch storage. Uses the **sticky bit** (`drwxrwxrwt`) |
| `/proc` | Process virtual filesystem | In-memory pseudo-filesystem generated by kernel (PID directories, `/proc/cpuinfo`) |
| `/sys` | System virtual filesystem | In-memory tree exposing kernel device drivers and subsystem settings |
| `/dev` | Device files | Nodes representing physical and virtual hardware (`/dev/sda1`, `/dev/null`) |
| `/usr` | User programs & libraries | Read-only user-space binaries (`/usr/bin`), shared libraries (`/usr/lib`) |
| `/opt` | Optional third-party software | Add-on software packages and self-contained applications |
| `/run` | Ephemeral runtime state | RAM-backed storage (`tmpfs`) storing PIDs, sockets, and lockfiles since boot |

### The UsrMerge Modern Layout
In modern Ubuntu/Debian releases, `/bin`, `/sbin`, and `/lib` are symbolic links to their counterparts under `/usr`:
```text
/bin -> usr/bin
/sbin -> usr/sbin
/lib -> usr/lib
/lib64 -> usr/lib64
```

---

## 4. Users, Groups, and `sudo` Security

### User & Group Identification
Every user in Linux has a unique numeric **User ID (UID)**, and every group has a **Group ID (GID)**:
- **`root` (UID 0)**: Unrestricted superuser access.
- **System Users (UID 1–999)**: Dedicated accounts created for daemons (`systemd-resolve`, `sshd`, `chrony`) to restrict service rights.
- **Regular Users (UID 1000+)**: Human interactive accounts (`ubuntu` = 1001, `devopsadmin` = 1002).

### Creating a Dedicated Administrative User
Following the Principle of Least Privilege, daily server operations should never be conducted directly as `root`. We created a dedicated administrator:

```bash
# Create user with home directory (-m), bash shell (-s), in sudo group (-G)
sudo useradd -m -s /bin/bash -G sudo devopsadmin

# Add devopsadmin to logging groups
sudo usermod -aG adm,systemd-journal devopsadmin
```

### Safe `sudo` Configuration with `visudo`
`sudo` (SuperUser DO) allows authorized users to execute individual administrative tasks with root privileges.

To avoid syntax errors that could permanently lock out all administrative access, `/etc/sudoers` files must always be validated:
```bash
# Create isolated sudoers drop-in
echo 'devopsadmin ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/99-devopsadmin > /dev/null
sudo chmod 440 /etc/sudoers.d/99-devopsadmin

# Validate file syntax before saving
sudo visudo -cf /etc/sudoers.d/99-devopsadmin
# Output: /etc/sudoers.d/99-devopsadmin: parsed OK
```

---

## 5. File Ownership and Permissions

### The Permission Triad
Every file and directory has 3 sets of permission bits:
1. **User / Owner (`u`)**
2. **Group (`g`)**
3. **Others (`o`)**

Each triad has three operations:
- **Read (`r` = 4)**: Read file contents; list directory contents.
- **Write (`w` = 2)**: Modify file contents; add/remove files in a directory.
- **Execute (`x` = 1)**: Run binary or script; enter/traverse into a directory (`cd`).

```
Mode: - r w - r - - - - -
Bits: 0 4 2 0 4 0 0 0 0 0 -> Sum: 640
      |---|   |---|   |---|
      User    Group   Others
```

### Why `chmod 777` is a Severe Antipattern
Running `chmod 777` grants read, write, and execute permissions to everyone on the machine. Any compromised unprivileged process or web server worker could overwrite binaries, modify configurations, or inject malicious executable scripts.

### Practical Permissions Verification Experiment
During testing, we proved permission isolation:
```bash
# Created directory owned by devopsadmin:devopsadmin with mode 750 (drwxr-x---)
# Created file secret.txt inside with mode 640 (-rw-r-----)
sudo mkdir -p /opt/devops-lab-perms
sudo chown -R devopsadmin:devopsadmin /opt/devops-lab-perms
sudo chmod 750 /opt/devops-lab-perms
echo "CONFIDENTIAL" > /opt/devops-lab-perms/secret.txt
chmod 640 /opt/devops-lab-perms/secret.txt

# Tested read as user 'ubuntu' (non-member of group devopsadmin):
cat /opt/devops-lab-perms/secret.txt
# Result: cat: /opt/devops-lab-perms/secret.txt: Permission denied
```

---

## 6. Package Management with APT

Ubuntu uses the **APT (Advanced Package Tool)** ecosystem managing Debian `.deb` packages.

### `apt update` vs. `apt upgrade`
- **`sudo apt update`**: Synchronizes local package index metadata from upstream mirrors listed in `/etc/apt/sources.list`. It does **not** install or update any software.
- **`sudo apt upgrade`**: Downloads and installs newer versions of already installed packages. In production, this should only be performed during planned maintenance windows because package upgrades can trigger service restarts and configuration migrations.

### Package Operations Performed
```bash
# Refresh repository indexes
sudo apt update

# Search for available packages
apt search htop

# Install package unattended
sudo apt install -y htop ufw

# Inspect installed files belonging to a package
dpkg -L htop
```

---

## 7. Process Management and System Resources

### Process Metrics and Commands
- **PID**: Unique Process ID assigned by the Linux kernel.
- **PPID**: Parent Process ID (the process that spawned it).
- **`uptime`**: Shows system uptime and **Load Average** over 1, 5, and 15 minutes. (A load average equal to the number of CPU cores indicates 100% capacity).
- **`free -h`**: Reports RAM metrics: Total, Used, Free, Buffers/Cache, and **Available** (memory that can be immediately allocated without swapping).

### Process Signals: SIGTERM vs. SIGKILL
- **`kill <PID>` (SIGTERM, Signal 15)**: The graceful termination signal. The process catches the signal, flushes pending disk writes, closes network sockets, cleans up lockfiles, and exits cleanly.
- **`kill -9 <PID>` (SIGKILL, Signal 9)**: Uncatchable kernel-level kill. The kernel immediately terminates the process in memory. **Never make `SIGKILL` your default choice**, as it can corrupt SQLite/PostgreSQL databases and leave orphaned locks.

### Practical Signal Verification Experiment
```bash
# Spawn background sleep process
sleep 300 &
PID=$!

# Send graceful SIGTERM
kill $PID

# Confirmed process exited cleanly
ps -p $PID
# Output: Process 3209 successfully terminated by SIGTERM
```

---

## 8. Service Management with `systemd`

`systemd` is the init system that runs as **PID 1**, responsible for orchestrating boot sequencing, daemon supervision, process cgroups, and service lifecycles.

### Custom Service Architecture: `devops-heartbeat`
We engineered and deployed a harmless background service that logs timestamped status pings.

#### 1. Executable Script: `/usr/local/bin/devops-heartbeat.sh`
```bash
#!/bin/bash
echo "Heartbeat service starting..."
while true; do
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Heartbeat ping - server OK"
    sleep 5
done
```
Permissions: `chmod 755 /usr/local/bin/devops-heartbeat.sh`

#### 2. Service Unit: `/etc/systemd/system/devops-heartbeat.service`
```ini
[Unit]
Description=DevOps Learning Heartbeat Service
After=network.target

[Service]
Type=simple
User=devopsadmin
ExecStart=/usr/local/bin/devops-heartbeat.sh
Restart=on-failure
RestartSec=3s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### Unit File Anatomy:
- `[Unit]`: Header containing metadata and boot dependencies.
- `Description`: Descriptive human-readable label shown in `systemctl status`.
- `After=network.target`: Ensures networking is initialized before the service starts.
- `Type=simple`: Standard process execution mode; `ExecStart` is the main process.
- `User=devopsadmin`: Runs the service under the unprivileged `devopsadmin` user (Principle of Least Privilege).
- `ExecStart`: Full absolute path to the executable.
- `Restart=on-failure`: Directs systemd to automatically restart the service if the process exits with a non-zero exit code or crashes.
- `RestartSec=3s`: Prevents CPU-exhausting restart storms by pausing 3 seconds before restart attempts.
- `StandardOutput=journal` / `StandardError=journal`: Seamlessly ships stdout and stderr streams to `systemd-journald`.
- `[Install]`: Controls boot configuration.
- `WantedBy=multi-user.target`: When enabled, creates a symlink in `/etc/systemd/system/multi-user.target.wants/` to run at system startup.

### Lifecycle Commands
```bash
# Rescan unit files after creating or modifying
sudo systemctl daemon-reload

# Start the service
sudo systemctl start devops-heartbeat

# Check real-time status and logs
systemctl status devops-heartbeat

# Restart the service (issues SIGTERM, launches fresh PID)
sudo systemctl restart devops-heartbeat

# Enable automatic start on system boot
sudo systemctl enable devops-heartbeat

# Stop the service
sudo systemctl stop devops-heartbeat
```

---

## 9. System Logs and `journalctl`

`systemd-journald` provides structured, tamper-resistant system logging.

### Essential Log Inspection Commands
```bash
# View last 10 entries of a specific service
journalctl -u devops-heartbeat -n 10 --no-pager

# Follow service logs in real time
journalctl -u devops-heartbeat -f

# Inspect logs within a specific time window
journalctl --since "30 minutes ago"

# View kernel and boot errors from current boot
journalctl -p err -b

# Check if any system service failed
systemctl --failed
```

---

## 10. Linux Networking and Socket Inspection

### Network Interfaces
- **`lo` (127.0.0.1)**: Loopback interface. Internal to the server kernel only. External traffic cannot reach it.
- **`ens3` (10.0.0.214)**: Primary network interface attached to the Oracle VCN subnet.

### Interface & Routing Inspection
```bash
# Brief network interface addresses
ip -br addr

# Routing table and default gateway
ip route
# default via 10.0.0.1 dev ens3 proto dhcp src 10.0.0.214 metric 100
```

### Listening Sockets (`ss -tulpn`)
The `ss` utility provides visibility into TCP/UDP sockets:
- `-t`: TCP sockets
- `-u`: UDP sockets
- `-l`: Listening sockets only
- `-p`: Process name and PID
- `-n`: Numeric port resolution

```text
Netid  State   Local Address:Port   Process
tcp    LISTEN  0.0.0.0:22           sshd (pid 1253)
tcp    LISTEN  127.0.0.53:53        systemd-resolved (pid 464)
```

#### Binding Differences: `127.0.0.1` vs. `0.0.0.0`
- **`127.0.0.1:PORT`**: Socket is bound exclusively to loopback. Only programs running locally on the server can connect.
- **`0.0.0.0:PORT`**: Socket is bound to **all IPv4 interfaces**, exposing the application to external traffic subject to firewall rules.

---

## 11. Firewall Configuration with UFW

UFW (Uncomplicated Firewall) manages kernel netfilter/iptables rules with a simplified syntax.

### Safety Rules Before Enabling Firewalls
To prevent locking oneself out of a remote cloud server:
1. Always keep the current active SSH connection open.
2. Confirm the SSH port (port 22).
3. Explicitly allow SSH before enabling the firewall.
4. Test a new session from a secondary shell before disconnecting.

### Active Firewall Configuration
```bash
# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Explicitly permit SSH management
sudo ufw allow 22/tcp comment 'Allow SSH management'

# Enable the firewall
sudo ufw --force enable

# Inspect active numbered rules
sudo ufw status verbose
```

Active Status:
```text
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere    # Allow SSH management
22/tcp (v6)                ALLOW IN    Anywhere    # Allow SSH management
```

### SSH Hardening: Disabling Root Login
To enforce accountability and prevent automated root brute-force attempts:
```bash
# Created /etc/ssh/sshd_config.d/99-hardened.conf with PermitRootLogin no
echo 'PermitRootLogin no' | sudo tee /etc/ssh/sshd_config.d/99-hardened.conf

# Validated sshd configuration syntax before reload
sudo sshd -t

# Reloaded SSH service
sudo systemctl reload ssh
```

---

## 12. Reboot and Recovery Verification

A comprehensive pre-reboot audit and live reboot test was executed to confirm configuration persistence.

### Pre-Reboot Verification Checklist
- [x] `sudo sshd -t` validated configuration syntax without error.
- [x] `sudo ufw status verbose` confirmed port 22 is allowed and default incoming is deny.
- [x] `systemctl is-enabled ufw` confirmed UFW starts automatically on boot.
- [x] `systemctl is-enabled devops-heartbeat` confirmed heartbeat service starts on boot.
- [x] `sudo id` confirmed `devopsadmin` retains passwordless sudo privilege.

### Post-Reboot Verification Results
After executing `sudo systemctl reboot`:
1. **Network Recovery**: Port 22 came online within 30 seconds.
2. **Uptime**: Confirmed clean reboot (`uptime` reported `up 0 min`).
3. **Firewall**: UFW remained active with rule `22/tcp ALLOW IN`.
4. **Service Persistence**: `devops-heartbeat.service` was active (`running`) with a newly assigned PID (`PID 981`), actively writing heartbeats.
5. **Authentication**: `devopsadmin` authenticated instantly using the Ed25519 key pair with full sudo rights.

---

## 13. Practical Troubleshooting Guide

| Problem | Potential Root Cause | Investigation Command | Remediation |
|---|---|---|---|
| **Cannot connect via SSH** | Firewall blocking port, wrong key permissions, sshd down | `nc -zv -w 5 <IP> 22`, check `chmod 600 ~/.ssh/id_ed25519` | Check UFW rules and OCI Cloud Security Lists; fix key permissions |
| **Service fails to start** | Syntax error in unit file, bad script path, crashed process | `systemctl status <service>`, `journalctl -u <service> -xe` | Run `sudo systemctl daemon-reload` after fixing syntax or permissions |
| **High CPU or Out of Memory** | Runaway process, memory leak, no swap space | `htop`, `ps aux --sort=-%mem`, `free -h` | Gracefully terminate with `kill <PID>`, configure swap space |
| **Permission Denied on directory** | Incorrect file mode or ownership | `stat <path>`, `id` | Update permissions (`chmod 755`) or ownership (`chown user:group`) |
| **DNS resolution fails** | `systemd-resolved` down or broken `/etc/resolv.conf` | `resolvectl status`, `getent hosts google.com` | Restart resolver: `sudo systemctl restart systemd-resolved` |
