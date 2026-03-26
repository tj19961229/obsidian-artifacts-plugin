/**
 * @author tj
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebouncedRenderer } from '../src/renderer';

describe('DebouncedRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls render after debounce delay', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('content1');
    expect(renderFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledWith('content1');
  });

  it('resets timer on rapid calls', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('content1');
    vi.advanceTimersByTime(400);
    debounced.schedule('content2');
    vi.advanceTimersByTime(400);
    expect(renderFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(renderFn).toHaveBeenCalledOnce();
    expect(renderFn).toHaveBeenCalledWith('content2');
  });

  it('skips render if content hash unchanged', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('same');
    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledOnce();

    debounced.schedule('same');
    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledOnce();
  });

  it('renders again if content changes', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('v1');
    vi.advanceTimersByTime(800);
    debounced.schedule('v2');
    vi.advanceTimersByTime(800);
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('cancel stops pending render', () => {
    const renderFn = vi.fn();
    const debounced = new DebouncedRenderer(renderFn, 800);

    debounced.schedule('content');
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(renderFn).not.toHaveBeenCalled();
  });
});
