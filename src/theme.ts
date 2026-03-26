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
