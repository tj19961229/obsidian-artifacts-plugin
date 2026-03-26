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
