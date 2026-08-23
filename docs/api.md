# API Reference

Backend communication contract, request payload schema, response structure, and error handling for openlens-chat-extension.

---

## Endpoint Specification

### `POST /chat`

The extension sends conversation turns to the backend via a single HTTP POST request.

#### Request Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

---

## Request Payload Schema

```json
{
  "message": "How many pods are running in the default namespace?",
  "context": {
    "clusterName": "production-us-east",
    "server": "production-us-east",
    "namespace": "default"
  },
  "history": [
    {
      "role": "user",
      "content": "Tell me about the nginx deployment"
    },
    {
      "role": "assistant",
      "content": "The nginx deployment is running 3 replicas with all pods healthy."
    }
  ]
}
```

### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | The natural language query typed by the user. |
| `context.clusterName` | `string` | Yes | Name of the active cluster context selected in OpenLens. |
| `context.server` | `string` | Yes | Server context identifier from kubeconfig. |
| `context.namespace` | `string` | Yes | Active namespace (defaults to `"default"`). |
| `history` | `array` | No | Up to 20 previous non-error message turns (`role`, `content`) for conversational context. |

---

## Response Payload Schema

### Success Response (`200 OK`)

```json
{
  "reply": "There are 42 pods running across the cluster, 8 of which are in the default namespace."
}
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `reply` | `string` | Markdown-formatted answer returned by the backend LLM. |

---

## Error Handling

- **Non-2xx HTTP Responses**: Caught by `chatClient.ts` as `ChatApiError(status, body)` and rendered inside a red-tinted error bubble.
- **Network / Timeout (30s)**: Automatically aborted via `AbortController` and reported with an inline error message.
