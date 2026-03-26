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
