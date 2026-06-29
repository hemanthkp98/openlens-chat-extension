# Workspace Agent Rules — openlens-chat-extension

## Local Development Environment

- **Docker runtime**: Always use **Colima** (`colima start`) as the Docker/container runtime. Never assume Docker Desktop.
- **Kubernetes**: Always use **k3s** (via Colima's built-in k3s) or **k3d** for local Kubernetes clusters. Do not suggest minikube or Docker Desktop Kubernetes.
- Before running any `docker` or `kubectl` command, check that Colima is running (`colima status`). If it is stopped, start it with `colima start` before proceeding.
- The Docker socket is at `~/.colima/default/docker.sock` (not the default `/var/run/docker.sock`).
- **Committing**: Always commit *only* when the user explicitly says so (e.g. "Commit the changes"). Never commit automatically or proactively without explicit instruction.
- **Changelog**: Always update the changelog (if it exists on the repo, e.g. in README or CHANGELOG.md) post-commit or when wrapping up a feature.

