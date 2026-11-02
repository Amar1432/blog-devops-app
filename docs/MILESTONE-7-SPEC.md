# Milestone 7 — Linux Server Administration

## 1. Objective

Learn to administer a remote Linux server that will eventually host the `devops-blog` application.

By the end of this milestone, you should be comfortable with:

- Connecting to a remote Linux server using SSH.
- Understanding Linux filesystem structure.
- Managing users and groups.
- Understanding file permissions and ownership.
- Installing and updating packages.
- Managing Linux processes and services.
- Understanding systemd.
- Inspecting CPU, memory, disk, and network usage.
- Configuring SSH securely.
- Configuring a basic firewall.
- Reading system logs.
- Understanding server networking.
- Troubleshooting common server problems.

This milestone focuses on server administration, not application deployment.

## 2. Learning environment

Recommended environment:

- Cloud VPS running Ubuntu Server 24.04 LTS or another currently supported Ubuntu LTS release.
- 1 vCPU.
- 2 GB RAM minimum.
- 20–25 GB SSD.
- Public IPv4 address.
- SSH access.

You can use a low-cost VPS provider or an existing Linux virtual machine.

Before purchasing anything, compare available providers and prices. Do not purchase an expensive server for this learning project.

Alternative: use an Ubuntu VM locally if you want to avoid VPS charges.

### Important

Do not use your personal Mac as the remote Linux server.

The objective is to understand the difference between your local development environment and a remote Linux machine.

## 3. SSH and remote access

Learn:

- What SSH is.
- SSH client vs SSH server.
- Public and private keys.
- Password authentication vs key authentication.
- SSH key generation.
- SSH authentication flow.
- `known_hosts`.
- SSH configuration.
- SSH port forwarding basics.

Practical tasks:

1. Generate a dedicated SSH key pair for this server.
2. Add the public key to the server.
3. Connect using SSH.
4. Configure a host alias in `~/.ssh/config`.
5. Verify that key-based authentication works.
6. Inspect SSH authentication logs.

Example:

```bash
ssh-keygen -t ed25519 -C "devops-blog-server"

ssh user@SERVER_IP
```

Example SSH config:

```sshconfig
Host devops-lab
    HostName SERVER_IP
    User ubuntu
    IdentityFile ~/.ssh/devops-lab
    IdentitiesOnly yes
```

Connect using:

```bash
ssh devops-lab
```

Never upload your private key to GitHub or commit it to your repository.

## 4. Linux filesystem

Understand the purpose of these directories:

| Directory | Purpose |
|---|---|
| `/` | Filesystem root |
| `/home` | User home directories |
| `/root` | Root user's home |
| `/etc` | System configuration |
| `/var` | Variable application and system data |
| `/var/log` | Log files |
| `/tmp` | Temporary files |
| `/usr` | Installed user-space programs and libraries |
| `/opt` | Optional third-party software |
| `/mnt` | Temporary mount points |
| `/proc` | Virtual filesystem exposing process and kernel information |
| `/dev` | Device files |

Practical tasks:

- Navigate the filesystem.
- Create and remove directories.
- Inspect hidden files.
- Copy and move files.
- Understand symbolic links.
- Inspect mounted filesystems.
- Find large files.

Commands to practice:

```bash
pwd
ls -lah
cd
mkdir
touch
cp
mv
rm
find
du -sh
df -h
mount
```

Understand the difference between a file's location, ownership, and permissions.

## 5. Users, groups, and permissions

Learn:

- Root user.
- Regular users.
- Groups.
- User IDs and group IDs.
- File ownership.
- Read, write, and execute permissions.
- Numeric permissions.
- `sudo`.
- Linux permission inheritance.
- Why applications should not run as root.

Practical tasks:

1. Create a separate non-root administrative user.
2. Add that user to the appropriate sudo group.
3. Inspect user and group information.
4. Create a directory owned by a particular user.
5. Change permissions using `chmod`.
6. Change ownership using `chown`.
7. Test access using different users.
8. Understand why `777` is usually a bad permission choice.

Commands:

```bash
whoami
id
groups
adduser
usermod
sudo
chmod
chown
stat
getent passwd
getent group
```

## 6. Package management

Learn how Ubuntu installs and maintains software.

Topics:

- APT package manager.
- Package repositories.
- Package indexes.
- Installing packages.
- Updating packages.
- Removing packages.
- Checking installed versions.
- Security updates.

Practical tasks:

```bash
sudo apt update
sudo apt upgrade

apt list --installed
apt search nginx

sudo apt install curl
sudo apt remove curl
```

Understand the difference between `apt update` and `apt upgrade`.

Do not blindly upgrade packages on a production server without understanding the implications.

## 7. Processes and system resources

Learn:

- What a process is.
- Process IDs.
- Parent and child processes.
- Foreground vs background processes.
- Signals.
- Process termination.
- CPU utilization.
- Memory utilization.
- Load average.
- Disk utilization.

Commands:

```bash
ps aux
top
htop
free -h
uptime
df -h
du -sh
lsof
kill
kill -9
```

Practical experiments:

1. Start a long-running process.
2. Find its PID.
3. Inspect its resource usage.
4. Stop it gracefully.
5. Observe the difference between SIGTERM and SIGKILL.
6. Identify a process consuming significant memory.
7. Inspect disk usage.

Understand why `kill -9` should not be your first choice.

## 8. systemd and service management

Learn:

- What systemd is.
- What a Linux service is.
- Unit files.
- Service lifecycle.
- Service dependencies.
- Automatic startup on boot.
- Restart policies.
- Service logs.

Commands:

```bash
systemctl status ssh
systemctl list-units --type=service
systemctl start ssh
systemctl stop ssh
systemctl restart ssh
systemctl enable ssh
systemctl disable ssh
```

Create a simple custom systemd service that runs a harmless long-running script.

Example:

- Create a script that periodically writes a timestamp to a log file.
- Create a systemd unit file.
- Start the service.
- Inspect its status.
- Read its logs.
- Configure it to start on boot.
- Stop and disable it.

Do not use your blog application for this exercise yet.

## 9. Logs and troubleshooting

Learn:

- System logs.
- Application logs.
- Authentication logs.
- Kernel logs.
- journald.
- Log rotation.
- Following logs in real time.

Commands:

```bash
journalctl
journalctl -xe
journalctl -u ssh
journalctl -f
journalctl --since "1 hour ago"

dmesg
tail -f
grep
less
```

Practical tasks:

1. Inspect SSH authentication events.
2. Inspect system service failures.
3. Follow logs in real time.
4. Filter logs by time.
5. Find errors using grep.
6. Inspect system boot logs.

## 10. Networking fundamentals on Linux

Learn:

- Network interfaces.
- IP addresses.
- Private vs public IP.
- Default gateway.
- DNS resolution.
- Listening ports.
- TCP connections.
- Firewall rules.
- Loopback interface.

Commands:

```bash
ip addr
ip route
ip link
ss -tulpn
hostname
hostname -I
getent hosts example.com

curl -I https://example.com
ping -c 4 example.com
```

Understand the difference between:

- `127.0.0.1`
- Private IP address.
- Public IP address.
- `0.0.0.0`.

Understand what it means for an application to listen on `127.0.0.1` versus `0.0.0.0`.

## 11. Firewall and basic server security

Learn:

- What a firewall does.
- Inbound vs outbound rules.
- UFW.
- Default-deny inbound policy.
- SSH exposure.
- Open network ports.
- Security updates.

Use UFW for this milestone.

Practical tasks:

1. Inspect current firewall status.
2. Allow SSH before enabling the firewall.
3. Allow only the required management ports.
4. Enable UFW.
5. Inspect firewall rules.
6. Verify that SSH access still works.
7. Inspect listening network ports.

Example:

```bash
sudo ufw status verbose

sudo ufw allow OpenSSH

sudo ufw enable

sudo ufw status numbered
```

### Critical safety rule

Before enabling UFW or changing SSH configuration:

- Keep your current SSH session open.
- Verify the SSH port is allowed.
- Open a second terminal.
- Test a new SSH connection.
- Only then close the original session.

Do not disable password authentication or root login until key-based access through a separate sudo-enabled user has been tested.

## 12. Server maintenance

Understand:

- Disk usage.
- Memory usage.
- System updates.
- Rebooting.
- Service startup after reboot.
- Time synchronization.
- Basic server health checks.

Practical tasks:

```bash
hostnamectl
timedatectl
free -h
df -h
uptime

sudo apt update
```

Reboot the server after preparing a safe configuration.

Verify that:

- SSH works.
- Your user can use sudo.
- The firewall remains active.
- Your custom systemd service behaves as expected.

## 13. Documentation deliverables

Create:

`docs/LINUX-SERVER-ADMINISTRATION.md`

Document:

- Server specifications.
- SSH setup.
- Filesystem structure.
- Users and groups.
- File permissions.
- APT package management.
- Process management.
- systemd.
- Logs.
- Networking.
- UFW configuration.
- Server maintenance.
- Security practices.
- Commands used.
- Troubleshooting experiments.

Do not include:

- Private SSH keys.
- Passwords.
- API tokens.
- Personal access tokens.
- Sensitive server credentials.

## 14. Practical experiments checklist

- [ ] Connect to server through SSH.
- [ ] Configure SSH key authentication.
- [ ] Create a non-root sudo user.
- [ ] Understand filesystem structure.
- [ ] Practice file permissions and ownership.
- [ ] Install and update packages.
- [ ] Inspect and manage processes.
- [ ] Create and manage a custom systemd service.
- [ ] Inspect system and service logs.
- [ ] Inspect network interfaces and listening ports.
- [ ] Configure UFW safely.
- [ ] Reboot and verify server access.
- [ ] Document all experiments.

## 15. Out of scope

Do not install or configure:

- Docker.
- Docker Compose.
- Nginx reverse proxy.
- PostgreSQL for the blog application.
- Coolify.
- Application deployment.
- TLS certificates.
- Kubernetes.
- Terraform.
- Ansible.

These belong to later milestones.

## 16. Acceptance criteria

Milestone 7 is complete when:

- The server can be accessed through SSH key authentication.
- A separate non-root sudo user exists.
- Basic Linux permissions are understood.
- Packages can be installed and updated.
- Processes can be inspected and managed.
- A custom systemd service can be managed.
- System logs can be inspected.
- Network interfaces and listening ports can be inspected.
- UFW is configured without locking out SSH.
- The server survives a reboot with expected access and service behavior.
- Documentation and experiment results are complete.

**Definition of success:** You can connect to a remote Linux machine, understand its state, troubleshoot common problems, and maintain it safely without relying on a graphical interface.