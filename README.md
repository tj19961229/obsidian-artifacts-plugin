# Obsidian Artifacts

Render interactive HTML, CSS, and JavaScript content directly in your Obsidian notes.

Write a `html-render` code block, switch to Reading View, and your code becomes a live, interactive application — charts can animate, calculators can compute, visualizations can respond to clicks.

## Usage

Create a fenced code block with the language `html-render`:

````markdown
```html-render
<style>
  body { font-family: var(--font-text); color: var(--text-normal); }
  button { padding: 8px 16px; cursor: pointer; }
</style>
<div style="text-align: center; padding: 20px;">
  <p id="count" style="font-size: 2em;">0</p>
  <button onclick="document.getElementById('count').textContent =
    parseInt(document.getElementById('count').textContent) + 1">+1</button>
</div>
```
````

Switch to **Reading View** or **Live Preview** — the code block renders as an interactive counter.

## Features

- **Sandboxed execution** — User code runs inside an iframe with `sandbox="allow-scripts"`. No access to Obsidian internals, Node.js, or the filesystem.
- **Theme adaptation** — Obsidian CSS variables are injected into the iframe. Content matches your current theme (light/dark). Theme switches preserve iframe state.
- **Auto-resize** — iframe height adjusts to content automatically via ResizeObserver.
- **Error display** — JavaScript errors show in a non-intrusive bottom bar without destroying rendered content.
- **CSP protection** — Content Security Policy blocks all external network requests (v1). External resource support planned for v1.1.
- **Lazy loading** — Notes with many code blocks use IntersectionObserver to activate iframes on scroll.
- **Accessibility** — Keyboard navigable, focus indicators, `prefers-reduced-motion` support.
- **Settings** — Configurable max height, debounce delay, and active iframe limit.

## Commands

- **Insert HTML Artifact** — Available in the command palette. Inserts a template code block.

## Available CSS Variables

Your HTML can use these Obsidian theme variables:

```css
var(--background-primary)
var(--background-secondary)
var(--text-normal)
var(--text-muted)
var(--text-faint)
var(--interactive-accent)
var(--font-text)
var(--font-monospace)
```

## Security Model

- iframe uses `sandbox="allow-scripts"` — scripts execute but cannot access the parent page, submit forms, or navigate.
- CSP meta tag blocks all external requests (`default-src 'none'`).
- postMessage communication uses source verification and protocol versioning.

## Installation

### From Community Plugins (pending review)

1. Open **Settings → Community Plugins**
2. Search for "Obsidian Artifacts"
3. Install and enable

### Manual / BRAT

1. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-artifacts/` directory.
2. Enable the plugin in Settings → Community Plugins.

## Roadmap

- **v1.1** — CDN package imports via esm.sh (D3, Chart.js, etc.)
- **v2** — Preact/React component support with htm (no build step)

## Development

```bash
npm install
npm run dev    # Watch mode
npm run build  # Production build
npm test       # Run tests
```
