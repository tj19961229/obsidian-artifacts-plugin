# Obsidian Artifacts v1 — Core Sandbox Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an Obsidian plugin that renders `html-render` code blocks as interactive HTML/CSS/JS content inside sandboxed iframes, with theme adaptation, height auto-resize, error display, and settings panel.

**Architecture:** Register a `MarkdownCodeBlockProcessor` for `html-render` blocks. Each block gets wrapped in a styled container with a label. The user's HTML is injected into an iframe via `srcdoc` with `sandbox="allow-scripts"`. A `buildSrcdoc()` function constructs the full HTML document including: injected Obsidian theme CSS variables, a ResizeObserver for height reporting, error capture scripts, and CSP violation listeners. Parent-child communication uses `postMessage` with a versioned protocol. Theme changes are pushed via `postMessage` without iframe recreation. Live Preview mode uses content-hash debouncing. IntersectionObserver manages lazy-loading when iframe count exceeds the configured limit.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, vitest

**Design Spec:** `/Users/xyn/.gstack/projects/root-obsidian-resource/xyn-main-design-20260326-213332.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main.ts` | Plugin lifecycle: `onload`/`onunload`, register code block processor, register commands, show install notice |
| `src/settings.ts` | `ArtifactSettings` interface, defaults, `ArtifactSettingTab` class |
| `src/renderer.ts` | Code block processor: creates container DOM, manages iframe lifecycle, handles debounce |
| `src/srcdoc-builder.ts` | Pure function: builds complete `srcdoc` HTML string from user code + theme + injected scripts |
| `src/theme.ts` | Extracts Obsidian CSS variables, listens for theme changes, sends updates via postMessage |
| `src/constants.ts` | CSS variable list, postMessage types, default settings values |
| `src/types.ts` | `ArtifactMessage` interface, shared type definitions |
| `tests/srcdoc-builder.test.ts` | Unit tests for srcdoc construction |
| `tests/renderer.test.ts` | Unit tests for debounce/hash logic |
| `tests/theme.test.ts` | Unit tests for CSS variable extraction |
| `styles.css` | Container styles: label, hover actions, focus, error bar |

---

## Task 1: Constants and Types

**Files:**
- Create: `src/constants.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
/**
 * @author tj
 */

export interface ArtifactMessage {
  type:
    | 'obsidian-artifact-resize'
    | 'obsidian-artifact-error'
    | 'obsidian-artifact-ready'
    | 'obsidian-artifact-theme-update';
  version: 1;
  height?: number;
  error?: { message: string; stack?: string };
  theme?: Record<string, string>;
}

export interface ArtifactSettings {
  maxHeight: number;
  debounceDelay: number;
  maxActiveIframes: number;
}
```

- [ ] **Step 2: Create `src/constants.ts`**

```typescript
/**
 * @author tj
 */

import type { ArtifactSettings } from './types';

export const CODE_BLOCK_LANGUAGE = 'html-render';

export const DEFAULT_SETTINGS: ArtifactSettings = {
  maxHeight: 800,
  debounceDelay: 800,
  maxActiveIframes: 5,
};

export const THEME_CSS_VARIABLES = [
  '--background-primary',
  '--background-secondary',
  '--text-normal',
  '--text-muted',
  '--text-faint',
  '--text-on-accent',
  '--interactive-accent',
  '--background-modifier-border',
  '--background-modifier-error',
  '--font-text',
  '--font-monospace',
  '--radius-s',
  '--size-4-2',
] as const;

export const MESSAGE_TYPES = {
  RESIZE: 'obsidian-artifact-resize',
  ERROR: 'obsidian-artifact-error',
  READY: 'obsidian-artifact-ready',
  THEME_UPDATE: 'obsidian-artifact-theme-update',
} as const;

export const UNRESPONSIVE_TIMEOUT_MS = 5000;
export const MIN_IFRAME_HEIGHT = 60;
export const RESIZE_THROTTLE_MS = 100;
export const POSTMESSAGE_RATE_LIMIT_MS = 50;
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/constants.ts
git commit -m "feat: 添加类型定义和常量配置"
```

---

## Task 2: Srcdoc Builder (TDD)

**Files:**
- Create: `src/srcdoc-builder.ts`
- Create: `tests/srcdoc-builder.test.ts`

- [ ] **Step 1: Install dev dependencies**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npm install`
Expected: node_modules created, no errors

- [ ] **Step 2: Write failing tests for `buildSrcdoc`**

```typescript
/**
 * @author tj
 */

import { describe, it, expect } from 'vitest';
import { buildSrcdoc, computeContentHash } from '../src/srcdoc-builder';

describe('buildSrcdoc', () => {
  const baseTheme: Record<string, string> = {
    '--background-primary': '#ffffff',
    '--text-normal': '#000000',
    '--font-text': 'Inter',
  };

  it('wraps user content in a full HTML document', () => {
    const result = buildSrcdoc('<p>hello</p>', baseTheme);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain('</html>');
    expect(result).toContain('<p>hello</p>');
  });

  it('injects CSP meta tag blocking external resources', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain("default-src 'none'");
    expect(result).toContain("script-src 'unsafe-inline'");
    expect(result).toContain("style-src 'unsafe-inline'");
    expect(result).toContain("img-src data:");
  });

  it('injects theme CSS variables as :root styles', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain(':root');
    expect(result).toContain('--background-primary: #ffffff');
    expect(result).toContain('--text-normal: #000000');
    expect(result).toContain('--font-text: Inter');
  });

  it('injects ResizeObserver script for height reporting', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('ResizeObserver');
    expect(result).toContain('obsidian-artifact-resize');
    expect(result).toContain('parent.postMessage');
  });

  it('injects error capture script (onerror + unhandledrejection)', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('window.onerror');
    expect(result).toContain('unhandledrejection');
    expect(result).toContain('obsidian-artifact-error');
  });

  it('injects CSP violation listener', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('securitypolicyviolation');
  });

  it('injects theme update listener (postMessage)', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('obsidian-artifact-theme-update');
    expect(result).toContain('document.documentElement.style');
  });

  it('injects ready signal script', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('obsidian-artifact-ready');
  });

  it('throttles resize messages', () => {
    const result = buildSrcdoc('<p>test</p>', baseTheme);
    expect(result).toContain('lastResizeTime');
  });

  it('handles empty user content', () => {
    const result = buildSrcdoc('', baseTheme);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<body>');
  });

  it('handles user content with script tags', () => {
    const result = buildSrcdoc('<script>alert(1)</script>', baseTheme);
    expect(result).toContain('<script>alert(1)</script>');
  });
});

describe('computeContentHash', () => {
  it('returns same hash for same content', () => {
    expect(computeContentHash('hello')).toBe(computeContentHash('hello'));
  });

  it('returns different hash for different content', () => {
    expect(computeContentHash('hello')).not.toBe(computeContentHash('world'));
  });

  it('returns consistent numeric hash', () => {
    const hash = computeContentHash('test');
    expect(typeof hash).toBe('number');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run tests/srcdoc-builder.test.ts`
Expected: FAIL — module `../src/srcdoc-builder` not found

- [ ] **Step 4: Implement `buildSrcdoc` and `computeContentHash`**

```typescript
/**
 * @author tj
 */

import { RESIZE_THROTTLE_MS } from './constants';

export function computeContentHash(content: string): number {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

function buildThemeStyles(theme: Record<string, string>): string {
  const vars = Object.entries(theme)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `:root {\n${vars}\n}`;
}

function buildInjectedScripts(): string {
  return `
<script>
(function() {
  // --- Resize Observer with throttle ---
  var lastResizeTime = 0;
  var pendingResize = null;
  var resizeThrottle = ${RESIZE_THROTTLE_MS};

  function sendResize(height) {
    var now = Date.now();
    if (now - lastResizeTime < resizeThrottle) {
      clearTimeout(pendingResize);
      pendingResize = setTimeout(function() {
        lastResizeTime = Date.now();
        parent.postMessage({
          type: 'obsidian-artifact-resize',
          version: 1,
          height: height
        }, '*');
      }, resizeThrottle - (now - lastResizeTime));
      return;
    }
    lastResizeTime = now;
    parent.postMessage({
      type: 'obsidian-artifact-resize',
      version: 1,
      height: height
    }, '*');
  }

  var ro = new ResizeObserver(function(entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      sendResize(Math.ceil(entry.target.scrollHeight));
    }
  });

  if (document.body) {
    ro.observe(document.body);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      ro.observe(document.body);
    });
  }

  // --- Error capture ---
  window.onerror = function(message, source, lineno, colno, error) {
    parent.postMessage({
      type: 'obsidian-artifact-error',
      version: 1,
      error: {
        message: String(message),
        stack: error && error.stack ? error.stack : ''
      }
    }, '*');
  };

  window.addEventListener('unhandledrejection', function(event) {
    parent.postMessage({
      type: 'obsidian-artifact-error',
      version: 1,
      error: {
        message: event.reason ? String(event.reason) : 'Unhandled promise rejection',
        stack: event.reason && event.reason.stack ? event.reason.stack : ''
      }
    }, '*');
  });

  // --- CSP violation listener ---
  document.addEventListener('securitypolicyviolation', function(event) {
    parent.postMessage({
      type: 'obsidian-artifact-error',
      version: 1,
      error: {
        message: 'CSP blocked: ' + event.blockedURI + ' (' + event.violatedDirective + '). External resources blocked (v1). Supported in v1.1.',
        stack: ''
      }
    }, '*');
  });

  // --- Theme update listener ---
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'obsidian-artifact-theme-update' && event.data.version === 1) {
      var theme = event.data.theme;
      if (theme) {
        var keys = Object.keys(theme);
        for (var i = 0; i < keys.length; i++) {
          document.documentElement.style.setProperty(keys[i], theme[keys[i]]);
        }
      }
    }
  });

  // --- Ready signal ---
  parent.postMessage({
    type: 'obsidian-artifact-ready',
    version: 1
  }, '*');
})();
</script>`;
}

export function buildSrcdoc(
  userContent: string,
  theme: Record<string, string>
): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:;">`;
  const themeStyles = buildThemeStyles(theme);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${csp}
<style>${themeStyles}</style>
<style>
html, body {
  margin: 0;
  padding: 0;
  overflow: auto;
  font-family: var(--font-text, sans-serif);
  color: var(--text-normal, inherit);
  background: var(--background-primary, transparent);
}
</style>
</head>
<body>
${userContent}
${buildInjectedScripts()}
</body>
</html>`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run tests/srcdoc-builder.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/srcdoc-builder.ts tests/srcdoc-builder.test.ts
git commit -m "feat: 实现 srcdoc 构建器，含主题注入、错误捕获和高度自适应"
```

---

## Task 3: Theme Extraction (TDD)

**Files:**
- Create: `src/theme.ts`
- Create: `tests/theme.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @author tj
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractThemeVariables } from '../src/theme';
import { THEME_CSS_VARIABLES } from '../src/constants';

describe('extractThemeVariables', () => {
  it('extracts CSS variables from a computed style object', () => {
    const mockGetPropertyValue = vi.fn((prop: string) => {
      const values: Record<string, string> = {
        '--background-primary': '#ffffff',
        '--text-normal': '#000000',
        '--font-text': 'Inter',
      };
      return values[prop] || '';
    });

    const mockComputedStyle = {
      getPropertyValue: mockGetPropertyValue,
    } as unknown as CSSStyleDeclaration;

    const result = extractThemeVariables(mockComputedStyle);

    expect(result['--background-primary']).toBe('#ffffff');
    expect(result['--text-normal']).toBe('#000000');
    expect(result['--font-text']).toBe('Inter');
  });

  it('includes all defined THEME_CSS_VARIABLES keys', () => {
    const mockComputedStyle = {
      getPropertyValue: vi.fn(() => 'value'),
    } as unknown as CSSStyleDeclaration;

    const result = extractThemeVariables(mockComputedStyle);

    for (const varName of THEME_CSS_VARIABLES) {
      expect(result).toHaveProperty(varName);
    }
  });

  it('trims whitespace from values', () => {
    const mockComputedStyle = {
      getPropertyValue: vi.fn(() => '  #fff  '),
    } as unknown as CSSStyleDeclaration;

    const result = extractThemeVariables(mockComputedStyle);
    expect(result['--background-primary']).toBe('#fff');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run tests/theme.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `extractThemeVariables` and `ThemeManager`**

```typescript
/**
 * @author tj
 */

import { THEME_CSS_VARIABLES, MESSAGE_TYPES } from './constants';
import type { ArtifactMessage } from './types';

export function extractThemeVariables(
  computedStyle: CSSStyleDeclaration
): Record<string, string> {
  const theme: Record<string, string> = {};
  for (const varName of THEME_CSS_VARIABLES) {
    theme[varName] = computedStyle.getPropertyValue(varName).trim();
  }
  return theme;
}

export class ThemeManager {
  private readonly iframes: Set<HTMLIFrameElement> = new Set();
  private currentTheme: Record<string, string> = {};
  private readonly getComputedBodyStyle: () => CSSStyleDeclaration;

  constructor(getComputedBodyStyle: () => CSSStyleDeclaration) {
    this.getComputedBodyStyle = getComputedBodyStyle;
    this.currentTheme = extractThemeVariables(getComputedBodyStyle());
  }

  getTheme(): Record<string, string> {
    return { ...this.currentTheme };
  }

  registerIframe(iframe: HTMLIFrameElement): void {
    this.iframes.add(iframe);
  }

  unregisterIframe(iframe: HTMLIFrameElement): void {
    this.iframes.delete(iframe);
  }

  handleThemeChange(): void {
    this.currentTheme = extractThemeVariables(this.getComputedBodyStyle());
    const message: ArtifactMessage = {
      type: MESSAGE_TYPES.THEME_UPDATE,
      version: 1,
      theme: this.currentTheme,
    };
    for (const iframe of this.iframes) {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
      }
    }
  }

  destroy(): void {
    this.iframes.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run tests/theme.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts tests/theme.test.ts
git commit -m "feat: 实现主题 CSS 变量提取和 ThemeManager"
```

---

## Task 4: Settings

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: Implement settings tab**

```typescript
/**
 * @author tj
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type { ArtifactSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import type ArtifactPlugin from './main';

export class ArtifactSettingTab extends PluginSettingTab {
  private readonly plugin: ArtifactPlugin;

  constructor(app: App, plugin: ArtifactPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Obsidian Artifacts Settings' });

    new Setting(containerEl)
      .setName('Max iframe height')
      .setDesc('Maximum height of rendered artifacts in pixels. Content beyond this scrolls inside the iframe.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            '400': '400px',
            '600': '600px',
            '800': '800px (default)',
            '1200': '1200px',
            '0': 'Unlimited',
          })
          .setValue(String(this.plugin.settings.maxHeight))
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              maxHeight: Number(value),
            };
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Debounce delay')
      .setDesc('Delay in ms before re-rendering after editing in Live Preview mode (300-2000ms).')
      .addSlider((slider) =>
        slider
          .setLimits(300, 2000, 100)
          .setValue(this.plugin.settings.debounceDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              debounceDelay: value,
            };
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Max active iframes')
      .setDesc('Maximum number of active iframes per note. Additional blocks are lazy-loaded on scroll.')
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.maxActiveIframes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              maxActiveIframes: value,
            };
            await this.plugin.saveSettings();
          })
      );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx tsc --noEmit --skipLibCheck`
Expected: No errors (may show warnings from missing main.ts, that's OK at this stage — if it errors on missing `./main` import, proceed to Task 5 first then come back)

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat: 添加插件设置面板（最大高度、防抖延迟、iframe 上限）"
```

---

## Task 5: Renderer — Core Code Block Processor

**Files:**
- Create: `src/renderer.ts`
- Create: `tests/renderer.test.ts`

This is the largest task. It creates the container DOM, manages iframe lifecycle, handles debouncing, lazy loading, and error display.

- [ ] **Step 1: Write failing test for debounce utility**

```typescript
/**
 * @author tj
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebouncedRenderer } from '../src/renderer';

describe('DebouncedRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls render after debounce delay', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('content1');
    expect(renderFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledWith('content1');
  });

  it('resets timer on rapid calls', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('content1');
    vi.advanceTimersByTime(400);
    debounced.schedule('content2');
    vi.advanceTimersByTime(400);
    expect(renderFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(renderFn).toHaveBeenCalledOnce();
    expect(renderFn).toHaveBeenCalledWith('content2');
  });

  it('skips render if content hash unchanged', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('same');
    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledOnce();

    debounced.schedule('same');
    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledOnce();
  });

  it('renders again if content changes', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('v1');
    vi.advanceTimersByTime(800);
    debounced.schedule('v2');
    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('cancel stops pending render', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('content');
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(renderFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run tests/renderer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement renderer**

```typescript
/**
 * @author tj
 */

import { MarkdownPostProcessorContext, Notice } from 'obsidian';
import { buildSrcdoc, computeContentHash } from './srcdoc-builder';
import { ThemeManager } from './theme';
import type { ArtifactSettings, ArtifactMessage } from './types';
import {
  MESSAGE_TYPES,
  UNRESPONSIVE_TIMEOUT_MS,
  MIN_IFRAME_HEIGHT,
} from './constants';

export class DebouncedRenderer {
  private readonly renderFn: (content: string) => void;
  private readonly delay: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastHash: number | null = null;

  constructor(renderFn: (content: string) => void, delay: number) {
    this.renderFn = renderFn;
    this.delay = delay;
  }

  schedule(content: string): void {
    const hash = computeContentHash(content);
    if (hash === this.lastHash) {
      return;
    }

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.lastHash = hash;
      this.renderFn(content);
      this.timer = null;
    }, this.delay);
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export function createArtifactContainer(
  source: string,
  el: HTMLElement,
  settings: ArtifactSettings,
  themeManager: ThemeManager,
  activeIframeCount: () => number
): { iframe: HTMLIFrameElement | null; destroy: () => void } {
  const container = el.createDiv({ cls: 'artifact-container' });
  container.setAttribute('tabindex', '0');

  // Label
  const label = container.createDiv({ cls: 'artifact-label' });
  label.setText('HTML');

  // Handle empty content
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    const placeholder = container.createDiv({ cls: 'artifact-placeholder' });
    placeholder.setText('Write HTML here to see it rendered');
    return { iframe: null, destroy: () => container.remove() };
  }

  // Lazy loading check
  if (activeIframeCount() >= settings.maxActiveIframes) {
    const lazyPlaceholder = container.createDiv({ cls: 'artifact-lazy' });
    lazyPlaceholder.setText('Scroll to activate');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            lazyPlaceholder.remove();
            renderIframe(container, trimmed, settings, themeManager);
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    return {
      iframe: null,
      destroy: () => {
        observer.disconnect();
        container.remove();
      },
    };
  }

  const result = renderIframe(container, trimmed, settings, themeManager);
  return result;
}

function renderIframe(
  container: HTMLElement,
  source: string,
  settings: ArtifactSettings,
  themeManager: ThemeManager
): { iframe: HTMLIFrameElement; destroy: () => void } {
  // Reload button (hidden, shows on hover)
  const reloadBtn = container.createDiv({ cls: 'artifact-reload' });
  reloadBtn.setText('↻');
  reloadBtn.setAttribute('aria-label', 'Reload artifact');

  const iframe = document.createElement('iframe');
  iframe.classList.add('artifact-iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('title', 'HTML Artifact');
  iframe.setAttribute('tabindex', '0');
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = `${MIN_IFRAME_HEIGHT}px`;
  iframe.style.opacity = '0';

  if (settings.maxHeight > 0) {
    iframe.style.maxHeight = `${settings.maxHeight}px`;
  }

  const theme = themeManager.getTheme();
  const srcdoc = buildSrcdoc(source, theme);
  iframe.setAttribute('srcdoc', srcdoc);

  container.appendChild(iframe);
  themeManager.registerIframe(iframe);

  // Error bar (hidden by default)
  const errorBar = container.createDiv({ cls: 'artifact-error-bar' });
  errorBar.setAttribute('role', 'alert');
  errorBar.style.display = 'none';

  // Unresponsive timeout
  let readyReceived = false;
  const unresponsiveTimer = setTimeout(() => {
    if (!readyReceived) {
      errorBar.setText('Content unresponsive');
      errorBar.style.display = 'block';
      reloadBtn.style.opacity = '1';
    }
  }, UNRESPONSIVE_TIMEOUT_MS);

  // Message handler
  const messageHandler = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) {
      return;
    }

    const data = event.data as ArtifactMessage;
    if (!data || data.version !== 1) {
      return;
    }

    switch (data.type) {
      case MESSAGE_TYPES.READY:
        readyReceived = true;
        clearTimeout(unresponsiveTimer);
        iframe.style.opacity = '1';
        break;

      case MESSAGE_TYPES.RESIZE:
        if (data.height != null && data.height > 0) {
          iframe.style.height = `${data.height}px`;
        }
        break;

      case MESSAGE_TYPES.ERROR:
        if (data.error) {
          errorBar.style.display = 'block';
          errorBar.textContent = data.error.message;
          errorBar.setAttribute('title', data.error.stack || '');
        }
        break;
    }
  };

  window.addEventListener('message', messageHandler);

  // Reload
  reloadBtn.addEventListener('click', () => {
    errorBar.style.display = 'none';
    iframe.style.opacity = '0';
    readyReceived = false;
    const freshTheme = themeManager.getTheme();
    iframe.setAttribute('srcdoc', buildSrcdoc(source, freshTheme));
  });

  const destroy = () => {
    clearTimeout(unresponsiveTimer);
    window.removeEventListener('message', messageHandler);
    themeManager.unregisterIframe(iframe);
    container.remove();
  };

  return { iframe, destroy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run tests/renderer.test.ts`
Expected: All DebouncedRenderer tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: 实现代码块渲染器，含防抖、懒加载、错误条和重载按钮"
```

---

## Task 6: Plugin Entry Point

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Implement main plugin class**

```typescript
/**
 * @author tj
 */

import { Notice, Plugin } from 'obsidian';
import type { ArtifactSettings } from './types';
import { CODE_BLOCK_LANGUAGE, DEFAULT_SETTINGS } from './constants';
import { ArtifactSettingTab } from './settings';
import { ThemeManager } from './theme';
import { createArtifactContainer, DebouncedRenderer } from './renderer';

export default class ArtifactPlugin extends Plugin {
  settings: ArtifactSettings = { ...DEFAULT_SETTINGS };
  private themeManager: ThemeManager | null = null;
  private activeIframeCount = 0;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.themeManager = new ThemeManager(
      () => getComputedStyle(document.body)
    );

    // Listen for theme changes
    this.registerEvent(
      // @ts-expect-error — css-change is an internal Obsidian event
      this.app.workspace.on('css-change', () => {
        this.themeManager?.handleThemeChange();
      })
    );

    // Register code block processor
    this.registerMarkdownCodeBlockProcessor(
      CODE_BLOCK_LANGUAGE,
      (source, el, ctx) => {
        this.processCodeBlock(source, el, ctx);
      }
    );

    // Register command: Insert HTML Artifact
    this.addCommand({
      id: 'insert-html-artifact',
      name: 'Insert HTML Artifact',
      editorCallback: (editor) => {
        const template = [
          '```html-render',
          '<style>',
          '  body { font-family: var(--font-text); color: var(--text-normal); }',
          '</style>',
          '<div>',
          '  <h2>Hello, Artifact!</h2>',
          '  <p>Edit this code to create interactive content.</p>',
          '</div>',
          '```',
        ].join('\n');
        editor.replaceSelection(template);
      },
    });

    // Settings tab
    this.addSettingTab(new ArtifactSettingTab(this.app, this));

    // First install notice
    if (this.settings === DEFAULT_SETTINGS) {
      new Notice(
        'Obsidian Artifacts installed! Try: ```html-render in any note.',
        8000
      );
    }
  }

  onunload(): void {
    this.themeManager?.destroy();
    this.themeManager = null;
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private processCodeBlock(
    source: string,
    el: HTMLElement,
    _ctx: unknown
  ): void {
    if (!this.themeManager) {
      return;
    }

    const result = createArtifactContainer(
      source,
      el,
      this.settings,
      this.themeManager,
      () => this.activeIframeCount
    );

    if (result.iframe) {
      this.activeIframeCount++;
    }

    this.register(() => {
      result.destroy();
      if (result.iframe) {
        this.activeIframeCount--;
      }
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: 实现插件入口，注册代码块处理器、命令面板和设置面板"
```

---

## Task 7: Styles

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Create plugin styles**

```css
/* Obsidian Artifacts Plugin Styles — @author tj */

.artifact-container {
  position: relative;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s, 6px);
  overflow: hidden;
  margin: var(--size-4-2, 8px) 0;
  background: var(--background-primary);
  transition: outline 150ms ease;
}

.artifact-container:focus-within {
  outline: 2px solid var(--interactive-accent);
  outline-offset: -2px;
}

.artifact-label {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 11px;
  color: var(--text-faint);
  opacity: 0.6;
  padding: 2px 6px;
  pointer-events: none;
  z-index: 1;
  user-select: none;
}

.artifact-reload {
  position: absolute;
  top: 0;
  right: 30px;
  font-size: 14px;
  color: var(--text-faint);
  padding: 2px 6px;
  cursor: pointer;
  z-index: 2;
  opacity: 0;
  transition: opacity 150ms ease;
  user-select: none;
}

.artifact-container:hover .artifact-reload {
  opacity: 1;
}

.artifact-reload:hover {
  color: var(--text-normal);
}

.artifact-iframe {
  display: block;
  width: 100%;
  border: none;
  min-height: 60px;
  box-sizing: border-box;
  transition: opacity 150ms ease;
}

.artifact-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  color: var(--text-faint);
  font-size: 13px;
  user-select: none;
}

.artifact-lazy {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  color: var(--text-faint);
  font-size: 12px;
  font-style: italic;
  user-select: none;
}

.artifact-error-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--background-modifier-error);
  color: var(--text-on-accent);
  font-size: 12px;
  padding: 6px 12px;
  z-index: 3;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact-error-bar:hover {
  white-space: normal;
  word-break: break-word;
}

.artifact-editing-watermark {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 12px;
  color: var(--text-faint);
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .artifact-iframe,
  .artifact-reload,
  .artifact-container {
    transition: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: 添加插件样式（容器、标签、错误条、无障碍焦点）"
```

---

## Task 8: Build and Smoke Test

**Files:**
- No new files

- [ ] **Step 1: Install dependencies**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npm install`
Expected: Success, node_modules created

- [ ] **Step 2: Run all unit tests**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Run TypeScript type check**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Run production build**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npm run build`
Expected: `main.js` generated in project root, no build errors

- [ ] **Step 5: Verify build output exists**

Run: `ls -la /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin/main.js`
Expected: File exists, reasonable size (should be under 50KB)

- [ ] **Step 6: Commit build artifacts check to .gitignore**

Verify `.gitignore` includes `main.js` and `node_modules/`. If not, update it.

Run: `cat /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin/.gitignore`

If `main.js` is not listed, add it (Obsidian plugins ship `main.js` in releases but shouldn't track it in git).

- [ ] **Step 7: Symlink to Obsidian vault for manual testing**

Run:
```bash
VAULT_PLUGINS="/Users/xyn/X_工具/文档/Resources/.obsidian/plugins"
PLUGIN_DIR="$VAULT_PLUGINS/obsidian-artifacts"
mkdir -p "$PLUGIN_DIR"
ln -sf /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin/main.js "$PLUGIN_DIR/main.js"
ln -sf /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin/manifest.json "$PLUGIN_DIR/manifest.json"
ln -sf /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin/styles.css "$PLUGIN_DIR/styles.css"
```

- [ ] **Step 8: Manual smoke test in Obsidian**

1. Open Obsidian → Settings → Community Plugins → Enable "Obsidian Artifacts"
2. Create a new note with this content:

````markdown
```html-render
<style>
  body { font-family: var(--font-text); color: var(--text-normal); }
  .counter { text-align: center; padding: 20px; }
  button { padding: 8px 16px; cursor: pointer; font-size: 16px; }
  #count { font-size: 2em; margin: 10px 0; }
</style>
<div class="counter">
  <p id="count">0</p>
  <button onclick="document.getElementById('count').textContent = parseInt(document.getElementById('count').textContent) + 1">+1</button>
</div>
```
````

3. Switch to Reading View — verify:
   - [ ] Counter renders with +1 button
   - [ ] Button click increments counter
   - [ ] Theme colors match (dark/light)
   - [ ] Container has border and "HTML" label
   - [ ] iframe height adapts to content
4. Toggle dark/light theme — verify counter state is preserved
5. Open Command Palette → "Insert HTML Artifact" — verify template inserted

- [ ] **Step 9: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: 修复冒烟测试中发现的问题"
```

---

## Task 9: Live Preview Debounce Support

**Files:**
- Modify: `src/renderer.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add editing watermark support to renderer**

In `src/renderer.ts`, add to the `createArtifactContainer` function — after the iframe is created, add a watermark div that shows during editing:

```typescript
// Add after iframe creation in renderIframe function
const watermark = container.createDiv({ cls: 'artifact-editing-watermark' });
watermark.setText('editing...');
watermark.style.display = 'none';
```

Export a function to show/hide the watermark:

```typescript
export function setEditingState(
  container: HTMLElement,
  editing: boolean
): void {
  const watermark = container.querySelector('.artifact-editing-watermark');
  if (watermark instanceof HTMLElement) {
    watermark.style.display = editing ? 'block' : 'none';
  }
}
```

- [ ] **Step 2: Wire debounce in main.ts processCodeBlock**

Update `processCodeBlock` in `src/main.ts` to use `DebouncedRenderer` for Live Preview mode:

The code block processor is called each time the block content changes in Live Preview. Use `DebouncedRenderer` to avoid excessive iframe recreation:

```typescript
private processCodeBlock(
  source: string,
  el: HTMLElement,
  _ctx: unknown
): void {
  if (!this.themeManager) {
    return;
  }

  // Use debounced rendering — the processor may be called rapidly in Live Preview
  const debounced = new DebouncedRenderer(
    (content: string) => {
      el.empty();
      const result = createArtifactContainer(
        content,
        el,
        this.settings,
        this.themeManager!,
        () => this.activeIframeCount
      );
      if (result.iframe) {
        this.activeIframeCount++;
      }
      this.register(() => {
        result.destroy();
        if (result.iframe) {
          this.activeIframeCount--;
        }
      });
    },
    this.settings.debounceDelay
  );

  // Initial render (immediate, no debounce)
  const result = createArtifactContainer(
    source,
    el,
    this.settings,
    this.themeManager,
    () => this.activeIframeCount
  );

  if (result.iframe) {
    this.activeIframeCount++;
  }

  this.register(() => {
    debounced.cancel();
    result.destroy();
    if (result.iframe) {
      this.activeIframeCount--;
    }
  });
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Build and verify**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/renderer.ts src/main.ts
git commit -m "feat: 添加 Live Preview 编辑防抖和 editing 水印"
```

---

## Task 10: Final Verification

**Files:**
- No new files

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Production build**

Run: `cd /Users/xyn/X_工作/project/claude/obsidian-artifacts-plugin && npm run build`
Expected: `main.js` generated successfully

- [ ] **Step 4: Comprehensive manual test checklist**

Test in Obsidian (reload plugin after build):

**Reading View:**
- [ ] Simple HTML renders correctly
- [ ] CSS styles are applied
- [ ] JavaScript executes (counter works)
- [ ] Theme colors match Obsidian (light mode)
- [ ] Theme colors match Obsidian (dark mode)
- [ ] Theme switch preserves iframe state
- [ ] "HTML" label visible in top-right
- [ ] Reload button appears on hover
- [ ] Reload button reloads content
- [ ] Empty code block shows placeholder
- [ ] JS error shows red error bar at bottom
- [ ] Error bar shows error message
- [ ] iframe height adapts to content
- [ ] Tab key enters iframe, Escape exits
- [ ] Focus outline visible on container

**Live Preview:**
- [ ] Code block renders in Live Preview
- [ ] Editing shows "editing..." watermark
- [ ] Re-renders after debounce delay

**Multiple Blocks:**
- [ ] 5 blocks render without issues
- [ ] 6th+ block shows "Scroll to activate"
- [ ] Scrolling activates lazy blocks

**Settings:**
- [ ] Settings panel accessible
- [ ] Max height dropdown works
- [ ] Debounce slider works
- [ ] Max iframes slider works

**Command Palette:**
- [ ] "Insert HTML Artifact" command exists
- [ ] Template is inserted correctly

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: v1 完成最终验证"
```
