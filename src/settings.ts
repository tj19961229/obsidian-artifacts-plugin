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
