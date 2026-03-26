/**
 * @author tj
 */

import { Notice, Plugin } from 'obsidian';
import type { ArtifactSettings } from './types';
import { CODE_BLOCK_LANGUAGE, DEFAULT_SETTINGS } from './constants';
import { ArtifactSettingTab } from './settings';
import { ThemeManager } from './theme';
import { createArtifactContainer } from './renderer';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app.workspace as any).on('css-change', () => {
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
    if (this.isFirstLoad) {
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

  private isFirstLoad = false;

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.isFirstLoad = data == null;
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
