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
