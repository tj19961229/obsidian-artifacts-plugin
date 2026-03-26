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
