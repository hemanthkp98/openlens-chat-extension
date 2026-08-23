# Architecture

Renderer-only extension lifecycle, component hierarchy, data flow, and design decisions for openlens-chat-extension.

---

## High-Level Architecture

`openlens-chat-extension` runs strictly inside the Electron renderer process without background main-process workers:

```
OpenLens UI (Electron Renderer)
        │
        ├── Sidebar Menu Icon (clusterPageMenus)
        └── Cluster View Page (clusterPages) ──► ChatPanel
                                                   │
                                                   ├── useChat Hook
                                                   │     ├── localStorage (per-cluster history)
                                                   │     └── chatClient.ts
                                                   │            │
                                                   └────────────┼──► POST /chat
                                                                ▼
                                                    AI Backend (FastAPI / KubeNova)
                                                    (default: http://localhost:8000)
```

---

## Extension Registration

Declared in `src/renderer.tsx` via `Renderer.LensExtension`:

```
KubeChatExtension (extends Renderer.LensExtension)
 │
 ├── clusterPages
 │    └── id: "kube-chat"
 │    └── Page: () => <ChatPanel />
 │
 └── clusterPageMenus
      └── target: { pageId: "kube-chat" }   (target wrapper required)
      └── title: "Kube Chat"
      └── Icon: <Renderer.Component.Icon material="chat" />
```

### Critical Extension API Rules

- **Class Inheritance**: Extends `Renderer.LensExtension` (the legacy `LensRendererExtension` is deprecated).
- **Target Routing**: `clusterPageMenus` requires `target: { pageId: "kube-chat" }`. Omitting the target object breaks sidebar routing.
- **Default Export**: Export the un-instantiated class (`export default class KubeChatExtension`).

---

## Component Layout Hierarchy

```
<ChatPanel> (Root container: flex column, 100% height)
  ├── <header> (Title, active cluster badge, clear history button)
  ├── <MessageList> (Scrollable feed, empty state, typing indicator)
  │     └── <MessageBubble> (Role-based alignment, markdown-lite, relative timestamp)
  └── <ChatInput> (Auto-resizing textarea, 2000 char cap, submit button / spinner)
```

---

## Data Flow Lifecycle

```
User types query & presses Enter
         │
         ▼
   ChatInput.handleSubmit()
         │  calls onSend(text)
         ▼
   ChatPanel → useChat.sendMessage(text)
         │
         ├─ 1. Optimistic Update: Append user message to state
         ├─ 2. Set isLoading = true
         │
         ├─ 3. chatClient.sendChatMessage({ message, context, history })
         │            │
         │            └─ POST /chat ─────────────────────► Backend API
         │                                                    │
         │            ◄─────────────── { reply: "…" } ───────┘
         │
         ├─ 4a. SUCCESS: Append assistant message to state
         └─ 4b. FAILURE: Append error message; set error state
         │
         └─ 5. Set isLoading = false

Side Effects (useEffect):
   - messages updated → localStorage.setItem("kube-chat:<clusterName>", ...)
   - requestAnimationFrame → scroll MessageList to bottom
```

---

## Key Design Decisions

1. **Renderer-Only Architecture**: No main-process code, background Node workers, or IPC channels. Minimizes overhead and simplifies packaging.
2. **`Renderer.Catalog.activeCluster`**: Uses `Renderer.Catalog.activeCluster` to resolve the current cluster reliably within `clusterPages` instead of `Common.Catalog.activeEntity`.
3. **Per-Cluster History Isolation**: Stores conversation records under `kube-chat:<clusterName>` in `localStorage`. Switching clusters in the sidebar dynamically switches conversation context.
4. **Zero-Dependency Markdown-Lite Renderer**: Parses code blocks, bold text, and inline code with native regex rather than bundling external heavyweight AST libraries.
5. **AbortController 30s Timeout**: Hard cancels requests that exceed 30 seconds to prevent UI hangs.
