# Configuration

Configure build-time API targets, runtime extension preferences, and local storage state for openlens-chat-extension.

---

## Build-Time Configuration

The backend API URL and environment mode are inlined into the extension bundle at build time:

| Variable | Target Step | Default | Description |
|---|---|---|---|
| `CHAT_API_URL` | `npm run build` | `http://localhost:8000` | Base URL of the backend AI server. Inlined into `dist/renderer.js`. |
| `NODE_ENV` | `npm run build` | `development` | Set to `production` for minification, dead code elimination, and short CSS module hash class names. |

### Customizing Backend URL at Build Time

To point the extension to a remote or custom backend during build:

```bash
CHAT_API_URL="https://kubenova.mycompany.internal" npm run build
```

---

## Runtime Storage Configuration

Chat conversations are isolated per cluster using browser `localStorage`:

| Storage Key | Format | Description |
|---|---|---|
| `kube-chat:<clusterName>` | JSON array of `ChatMessage` objects | Preserves conversation history across sessions for the specific connected cluster. |

### Clearing Conversation History

- Click the **Clear** button in the top-right corner of the ChatPanel header.
- This immediately wipes the in-memory state and removes the corresponding `kube-chat:<clusterName>` key from `localStorage`.
