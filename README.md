# openlens-chat-extension

AI-powered natural language chat sidebar for OpenLens and FreeLens to interact with your active Kubernetes clusters.

---

## Why It Exists

Navigating multi-cluster Kubernetes environments often requires querying complex status fields and searching through hundreds of pods and logs. `openlens-chat-extension` embeds an interactive AI assistant directly into the OpenLens cluster view, enabling operators to ask conversational questions about running resources, diagnose cluster issues, and inspect Kubernetes state without leaving the desktop IDE.

---

## Quickstart

```bash
# 1. Use Node 16.14.2 and install dependencies
nvm use 16.14.2 && npm ci

# 2. Build the extension bundle
npm run build

# 3. Copy to OpenLens extensions directory and reload Lens
cp -r . ~/.k8slens/extensions/openlens-chat-extension
```

Open OpenLens, connect to a cluster, and click **Kube Chat** in the sidebar.

---

## Documentation

- [Getting Started](docs/getting-started.md) — Prerequisites, Node 16 setup, build instructions, and installation methods.
- [Configuration](docs/configuration.md) — Backend URL configuration (`CHAT_API_URL`) and storage options.
- [Architecture](docs/architecture.md) — Renderer-only lifecycle, React component hierarchy, and data flow.
- [API Reference](docs/api.md) — Backend communication contract, request payload schema, and response format.
- [Development](docs/development.md) — Webpack watch mode, CSS Modules, and running Jest unit tests.
- [Troubleshooting](docs/troubleshooting.md) — Diagnosing Node ABI errors, linking issues, and network timeouts.

---

## Architecture

The extension runs entirely within the Electron renderer process, linking the OpenLens UI to a backend AI service:

```
OpenLens Cluster View ──► ChatPanel ──► useChat Hook ──► POST /chat ──► AI Backend (FastAPI)
```

For complete lifecycle and design decisions, see [Architecture](docs/architecture.md).

---

## Contributing & License

- Local development conventions and test workflows are in [Development](docs/development.md).
- Distributed under the MIT License.
