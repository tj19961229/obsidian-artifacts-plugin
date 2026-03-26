/**
 * @author tj
 */

import { describe, it, expect, vi } from 'vitest';
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
