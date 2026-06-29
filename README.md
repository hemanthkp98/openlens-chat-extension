# openlens-chat-extension

> AI-powered chat sidebar for [OpenLens](https://github.com/MuhammedKalkan/OpenLens) 6.5.x. Ask natural-language questions about your active Kubernetes cluster directly from the OpenLens UI.

---

## Architecture

```
OpenLens UI
        │
        ├── Sidebar icon (clusterPageMenus)
        └── Cluster page → ChatPanel
                              │
                              ├── useChat hook
                              │     ├── localStorage (per-cluster history)
                              │     └── chatClient.ts
                              │            └── POST /chat
                              │                    │
                              └──────────────────── FastAPI / LangGraph backend
                                                    (http://localhost:8000)
```

### Request payload shape
```json
{
  "message": "How many pods are running?",
  "context": {
    "clusterName": "my-cluster",
    "server": "my-context",
    "namespace": "default"
  },
  "history": [
    { "role": "user",      "content": "Tell me about the nginx pod" },
    { "role": "assistant", "content": "The nginx pod is running in kube-system..." }
  ]
}
```

> `history` contains the last ≤ 20 non-error turns (oldest first) so the LLM
> can resolve references like "it" or "that pod" across message turns.

### Response shape
```json
{ "reply": "There are 42 pods running across all namespaces." }
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node | **16.14.2** (must match Electron's bundled Node) |
| npm  | 8.x (bundled with Node 16) |
| OpenLens | 6.3+ |
| Backend | AI helper server running at `localhost:8000` |

> [!IMPORTANT]
> Node 18+ will break the build because `@k8slens/extensions` 6.5.x targets
> the Electron-bundled Node 16 ABI. Use `nvm` to pin the version.

```bash
# Install and pin Node 16.14.2
nvm install 16.14.2
nvm use 16.14.2
node --version   # → v16.14.2
```

---

## Build

```bash
cd openlens-chat-extension

# Install dev dependencies (no runtime deps to install)
npm ci

# Production build → dist/renderer.js
npm run build

# Development build (watch mode)
npm run dev
```

---

## Install in OpenLens

### Method 1 — Recommended (tarball drag-and-drop)

```bash
# Build and pack
npm run build
npm pack
# Creates: openlens-chat-extension-0.1.0.tgz
```

1. Open OpenLens
2. Go to **Extensions** (top-right ⚙️ → Extensions, or `Cmd+Shift+E`)
3. Click **"Install from file"**, select the `.tgz` file, or paste the full
   absolute path in the text field

### Method 2 — Developer install (symlink / copy)

```bash
# Build first
npm run build

# Copy to OpenLens extensions folder
cp -r . ~/.k8slens/extensions/openlens-chat-extension
```

Then reload OpenLens: **View → Reload** (or `Ctrl+R` / `Cmd+R`).

> [!NOTE]
> After any code change run `npm run build` again and reload OpenLens.

---

## Custom backend URL

The default backend URL is `http://localhost:8000`. To override it, set
`CHAT_API_URL` **before building** (it is inlined at build time by webpack):

```bash
CHAT_API_URL=http://my-ai-server:9000 npm run build
```

> [!TIP]
> If you need a runtime-configurable URL, expose it via a Lens preference
> store (requires adding `Common.Store` — see the OpenLens extension docs).

---

## Project structure

```
openlens-chat-extension/
├── package.json              # Extension manifest + devDeps
├── tsconfig.json             # ES2019 target, CommonJS, strict mode
├── webpack.config.js         # Single entry, electron-renderer target
└── src/
    ├── renderer.tsx          # Extension class (clusterPages + menu)
    ├── api/
    │   └── chatClient.ts     # fetch + AbortController, typed errors
    ├── hooks/
    │   └── useChat.ts        # State, localStorage persistence, API calls
    ├── components/
    │   ├── ChatPanel.tsx     # Layout: header / body / footer
    │   ├── MessageList.tsx   # List + empty state + typing indicator
    │   ├── MessageBubble.tsx # Bubble + markdown-lite + code copy
    │   └── ChatInput.tsx     # Auto-resize textarea + char counter
    └── styles/
        ├── ChatPanel.module.css
        ├── MessageList.module.css
        ├── MessageBubble.module.css
        └── ChatInput.module.css
```

---

## Design decisions

| Decision | Rationale |
|----------|-----------|
| **No `main.ts`** | Extension is renderer-only; no Node-side IPC needed |
| **`Renderer.Catalog.activeCluster`** | Correct API for cluster pages; `Common.Catalog.activeEntity` is unreliable inside `clusterPages` |
| **CSS Modules** | Scoped class names prevent collisions with OpenLens's own styles |
| **localStorage keyed by cluster name** | Each cluster gets independent history; survives extension reloads |
| **AbortController timeout** | 30 s hard cut-off prevents hung requests blocking the UI |
| **No React / ReactDOM in `package.json`** | They are already bundled inside `@k8slens/extensions`; adding them causes version conflicts |
| **`devtool: "source-map"`** | Separate `.map` files keep the bundle small while enabling debugging |
| **`target: "electron-renderer"`** | Required for Node built-ins (Buffer, crypto) to resolve correctly inside Electron |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Extension doesn't appear in sidebar | Confirm `dist/renderer.js` exists; reload OpenLens |
| `Cannot find module '@k8slens/extensions'` | Run `npm ci`; ensure Node 16 is active |
| "Chat API error 404" | Backend is running but `/chat` route is missing |
| "Request timed out" | Backend is unreachable; check `CHAT_API_URL` |
| Blank panel, no error | Open DevTools (`Cmd+Option+I`) and check the Console tab |
| Build fails on Node 18+ | Switch to Node 16.14.2 via `nvm use 16.14.2` |

---

## Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

### [Unreleased] — `feat/conversation-context-memory`

#### Added
- **Conversation context memory** — the chat now maintains a rolling window of the
  last 20 turns (user + assistant) and forwards them to the backend on every
  request, enabling the LLM to resolve pronoun references ("it", "that pod",
  "the one I mentioned") across message turns.
- `HistoryMessage` type in `chatClient.ts` (`{ role, content }`).
- `history` field in `ChatPayload` and in the `POST /chat` JSON body.
- Multi-turn `contents` array for the **Gemini** path (alternating `user` /
  `model` roles as required by the Gemini API).
- History injection into the **OpenAI** `messages` array between the system
  prompt and the new user message.
- Backend log now includes history depth: `[Query] ... | history: N turns`.

---

### [0.1.0] — Initial release

#### Added
- OpenLens/FreeLens renderer extension with an AI chat sidebar.
- `ChatPanel`, `MessageList`, `MessageBubble`, `ChatInput` components.
- `useChat` hook with optimistic UI updates and per-cluster `localStorage` history.
- `chatClient.ts` — typed fetch client with 30 s `AbortController` timeout.
- Plain Node.js backend (`server.js`) — no framework, no external deps.
- Dual LLM support: **Gemini 2.5 Flash** (primary) and **GPT-4o-mini** (fallback).
- Live cluster state injection via `kubectl get nodes/namespaces/pods`.
- Offline helper mode when no API key is configured.
- CSS Modules styling using Lens CSS custom properties.
