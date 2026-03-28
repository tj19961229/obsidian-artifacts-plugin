/**
 * @author tj
 */

import type { MESSAGE_TYPES } from './constants';

type ArtifactMessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export interface ArtifactMessage {
  type: ArtifactMessageType;
  version: 1;
  height?: number;
  error?: { message: string; stack?: string };
  theme?: Record<string, string>;
}

export interface ArtifactSettings {
  maxHeight: number;
  maxActiveIframes: number;
}
