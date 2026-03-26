/**
 * @author tj
 */

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

export function setEditingState(
  container: HTMLElement,
  editing: boolean
): void {
  const watermark = container.querySelector('.artifact-editing-watermark');
  if (watermark instanceof HTMLElement) {
    watermark.style.display = editing ? 'block' : 'none';
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

  // Editing watermark
  const watermark = container.createDiv({ cls: 'artifact-editing-watermark' });
  watermark.setText('editing...');
  watermark.style.display = 'none';

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
