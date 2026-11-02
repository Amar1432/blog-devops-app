# Incident Report: INC-05 — Bounded Disk-Pressure Simulation

- **Incident ID**: INC-05
- **Title**: Bounded Root Disk Pressure Simulation
- **Environment**: Production Host OS (OCI Ubuntu VM)
- **Date / Time**: 2026-11-02 19:23:20 UTC
- **Severity**: P3 (Resource Pressure Drill)

---

## 1. Objective
Simulate bounded filesystem consumption and verify threshold detection in `inspect-resources.sh` without risking disk exhaustion or database freezing.

## 2. Preconditions & Safety Checks
- Safety check: Predefined file size limit capped at 500 MB (< 2% of the 38 GB free disk).
- Cleanup plan: Immediate removal of the test file via `rm -f`.

## 3. Exact Action
```bash
# Allocate strictly 500 MB test file on /dev/sda1
fallocate -l 500M /var/tmp/disk-pressure-test.img

# Run health inspection
/opt/devops-blog/scripts/inspect-resources.sh

# Immediate cleanup
rm -f /var/tmp/disk-pressure-test.img
```

## 4. Observed Behavior
- Baseline root disk usage: `6.4 GB used (15%)`.
- With 500 MB allocation: `6.8 GB used (16%)`.
- Evaluation output:
  ```text
  [6] Operational Health Evaluation
  Disk Usage: [HEALTHY] Root filesystem is at 16% capacity.
  RAM Usage:  [HEALTHY] 42% memory available.
  ```
- Post-cleanup disk usage: Returned to `6.4 GB used (15%)`.

## 5. Architectural Discovery
Attempting to allocate 500 MB in `/tmp` revealed that `/tmp` is mounted on a `476M tmpfs` RAM filesystem. Placing large disk simulations in `/tmp` would consume RAM rather than block storage; persistent root disk tests must use `/var/tmp` or a path on `/dev/sda1`.

## 6. Final Status
RESOLVED (Closed).
