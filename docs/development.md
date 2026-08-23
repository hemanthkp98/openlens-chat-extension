# Development

Development environment setup, Webpack 5 compilation, CSS Modules styling, and Jest testing for openlens-chat-extension.

---

## Local Development Workflow

### 1. Prerequisites

Ensure you are using Node `16.14.2`:

```bash
nvm use 16.14.2
npm ci
```

### 2. Watch Mode

Run Webpack in watch mode to automatically recompile `dist/renderer.js` when source files change:

```bash
npm run dev
```

### 3. Reloading OpenLens

After Webpack finishes rebuilding:
1. Focus the OpenLens window.
2. Press `Cmd+R` (or `Ctrl+R`) to reload the renderer process and test your changes immediately.

---

## Webpack Build Pipeline

The extension uses Webpack 5 with `ts-loader`:

- **Target**: `electron-renderer` (allows Node built-ins like `crypto` to resolve).
- **Output Target**: `commonjs2` (matches Lens plugin loader requirements).
- **Externals**: React, ReactDOM, and `@k8slens/extensions` are declared as externals because they are provided at runtime by OpenLens.
- **Source Maps**: Configured as `source-map` for full step-through debugging.

---

## Styling System (CSS Modules)

All components use CSS Modules (`*.module.css`) to prevent class collisions with OpenLens styles:

- **Class name format (Dev)**: `[local]__[hash:base64:5]` (e.g. `panel__a1b2c`)
- **Class name format (Prod)**: `[hash:base64:8]`

### Lens CSS Variables

Components inherit native Lens theme variables:

| CSS Variable | Usage |
|---|---|
| `--lens-main-layout-content-area-background` | Panel container background |
| `--primary` | User message bubbles, send button, focus rings |
| `--text-primary` | Main text color |
| `--text-secondary` | Timestamps, counter labels, hint text |
| `--border-radius` | Global corner radius |

---

## Running Tests

The test suite uses [Jest](https://jestjs.io/) and React Testing Library:

```bash
# Run unit tests
npm test

# Run tests with code coverage report
npm run test:coverage
```
