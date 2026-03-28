/**
 * @author tj
 */

import { describe, it, expect } from 'vitest';
import { createArtifactContainer } from '../src/renderer';

describe('createArtifactContainer', () => {
  it('is exported', () => {
    expect(typeof createArtifactContainer).toBe('function');
  });
});
