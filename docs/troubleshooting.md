# Troubleshooting

Diagnose and resolve build errors, extension loading failures, and backend connection issues in openlens-chat-extension.

---

## Common Issues & Solutions

| Symptom | Cause | Fix |
|---|---|---|
| **Build fails with ABI error or webpack crash** | Using Node 18+ or 20+ | Switch to Node 16.14.2 via `nvm use 16.14.2` and reinstall dependencies with `npm ci`. |
| **Extension does not appear in OpenLens sidebar** | Lens extension not linked or improperly loaded | Confirm `~/.k8slens/extensions/openlens-chat-extension` contains `package.json` and `dist/renderer.js`. Run **View → Reload** (`Cmd+R`). |
| **Chat responses fail with red error bubble** | Backend AI service unreachable | Ensure backend is running at `http://localhost:8000` (or your configured `CHAT_API_URL`) and check network connectivity. |
| **Request timed out after 30 seconds** | Backend LLM took too long to generate response | Verify backend LLM API keys and model health; check backend logs. |
| **Stale conversation messages displayed** | Persisted local storage cache | Click the **Clear** button in the header or run `localStorage.clear()` in the Electron DevTools console (`Cmd+Option+I`). |
