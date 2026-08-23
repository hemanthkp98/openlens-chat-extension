# Getting Started

Build, install, and load openlens-chat-extension into OpenLens or FreeLens.

---

## Prerequisites

| Tool | Required Version | Reason |
|---|---|---|
| **Node.js** | `16.14.2` | Matches Electron's bundled Node ABI; Node 18+ will break the build |
| **npm** | `8.x` (bundled with Node 16) | Package management |
| **OpenLens / FreeLens** | `6.3+` | Target extension runtime |
| **AI Backend** | Accessible HTTP endpoint | Server running at `http://localhost:8000` (default) |

> [!IMPORTANT]
> Use `nvm` or your preferred Node version manager to switch to Node `16.14.2`:
> ```bash
> nvm install 16.14.2
> nvm use 16.14.2
> node --version  # Must output v16.14.2
> ```

---

## Building the Extension

```bash
# 1. Navigate to extension root
cd openlens-chat-extension

# 2. Install devDependencies
npm ci

# 3. Compile the bundle
npm run build
```

This compiles `src/renderer.tsx` into a single CommonJS bundle at `dist/renderer.js` and a source map at `dist/renderer.js.map`.

---

## Installing into OpenLens / FreeLens

### Option A: Install via Tarball (Recommended)

```bash
# Package the extension
npm pack
# Produces openlens-chat-extension-0.1.0.tgz
```

1. Open OpenLens or FreeLens.
2. Open the Extensions manager with `Cmd+Shift+E` (or `Ctrl+Shift+E`).
3. Click **Install from file** (or paste the absolute path to `.tgz`) and click **Install**.

---

### Option B: Developer Copy / Symlink

Copy or symlink the extension folder into the Lens extensions directory:

```bash
# OpenLens on macOS
cp -r openlens-chat-extension ~/.k8slens/extensions/openlens-chat-extension

# FreeLens on macOS
cp -r openlens-chat-extension ~/.freelens/extensions/openlens-chat-extension
```

Reload Lens to activate the extension:
- Press `Cmd+R` (or `Ctrl+R`), or select **View → Reload**.

---

## Verifying the Installation

1. Connect to any Kubernetes cluster in OpenLens.
2. Locate the **Kube Chat** icon in the cluster sidebar.
3. Click the icon to open the chat panel.
4. Type a query (e.g. `How many pods are running?`) and press `Enter`.
