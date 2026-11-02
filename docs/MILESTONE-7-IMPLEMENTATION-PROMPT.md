# Implementation Prompt — Milestone 7: Linux Server Administration

You are helping implement Milestone 7 of the `devops-blog` DevOps learning project.

The goal is to learn Linux server administration through hands-on work.

This milestone does not involve deploying the blog application.

## Important teaching rules

- Explain commands before executing them.
- Explain what each command changes.
- Prefer safe, reversible operations.
- Never execute destructive commands without explaining their consequences.
- Never assume the server is disposable.
- Do not expose SSH private keys or credentials.
- Do not lock the developer out of SSH.
- Do not introduce Docker or application deployment yet.
- Ask for confirmation before potentially disruptive server configuration changes.

The developer is using macOS and may connect to a remote Ubuntu VPS.

## Phase 1 — Environment assessment

Determine whether the developer has:

- An Ubuntu VPS.
- A local Ubuntu VM.
- An existing Linux server.

If no server exists, explain the minimum recommended VPS specifications and provide an affordable setup path.

Do not purchase infrastructure or create paid resources without explicit permission.

Record:

- Linux distribution.
- Linux version.
- Architecture.
- CPU count.
- Memory.
- Disk size.
- Public/private IP information where appropriate.

Do not ask the developer to share passwords or private keys.

## Phase 2 — SSH configuration

Teach SSH step by step.

1. Generate a dedicated Ed25519 key pair on macOS if necessary.
2. Explain public vs private keys.
3. Add the public key to the server.
4. Verify key-based login.
5. Configure an SSH alias.
6. Inspect SSH service status.
7. Explain SSH host key verification.

Never overwrite an existing SSH key without checking whether it is used elsewhere.

Do not request the private key.

## Phase 3 — Linux fundamentals

Guide the developer through:

- Filesystem navigation.
- Filesystem structure.
- Users and groups.
- File ownership.
- File permissions.
- `sudo`.
- Package management.

Use practical exercises.

Ask the developer to predict the outcome of selected commands before execution when that improves learning.

## Phase 4 — Processes and systemd

Teach:

- Process inspection.
- Process IDs.
- Signals.
- CPU and memory inspection.
- Service management.
- systemd unit files.

Create a harmless custom service that writes timestamps to a log file.

Verify:

- Service starts.
- Service stops.
- Service restarts.
- Logs can be inspected.
- Enable-on-boot works.

Explain every line of the systemd unit file.

## Phase 5 — Logs and networking

Teach the developer to inspect:

- System logs.
- SSH logs.
- Service logs.
- Network interfaces.
- Routing.
- DNS.
- Listening ports.
- TCP connectivity.

Create small troubleshooting exercises.

Examples:

- Find a listening port.
- Identify which process owns a port.
- Resolve a DNS hostname.
- Find a failed systemd service.
- Filter logs by time.

## Phase 6 — Firewall and security

Before making firewall or SSH configuration changes:

1. Inspect current access configuration.
2. Confirm the SSH port.
3. Ensure the non-root sudo user can log in.
4. Allow SSH in UFW.
5. Enable UFW.
6. Open a second terminal and test a new SSH session.
7. Only then consider further SSH hardening.

Never disable the current working access path before verifying the alternative.

Explain each UFW rule.

Do not disable root login or password authentication until the key-based alternative has been verified.

## Phase 7 — Reboot and recovery test

Prepare the machine for reboot.

Confirm:

- SSH configuration is valid.
- Firewall rules permit SSH.
- The non-root user has sudo.
- Required services are enabled.
- No unsaved work is at risk.

Reboot only after explicit confirmation.

After reboot, verify server access and service behavior.

## Phase 8 — Documentation

Create:

`docs/LINUX-SERVER-ADMINISTRATION.md`

Include:

- Environment details.
- SSH setup.
- Linux filesystem.
- Users and groups.
- Permissions.
- Package management.
- Process management.
- systemd.
- Logs.
- Networking.
- Firewall.
- Maintenance.
- Commands and explanations.
- Practical experiments.
- Troubleshooting.
- Security precautions.

Never include secrets or private key contents.

## Phase 9 — Final report

Provide:

1. Server environment details.
2. Configuration changes.
3. Commands executed.
4. Experiments completed.
5. Results.
6. Security decisions.
7. Remaining limitations.
8. Acceptance criteria checklist.
9. Topics the developer should be able to explain independently.

Do not claim a task was completed unless it was actually verified.

Do not start Milestone 8.

Wait for the developer to review and confirm completion.