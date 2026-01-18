import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);

    debouncedFn();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the debounced function', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should use the last arguments when called multiple times', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  describe('cancel', () => {
    it('should cancel pending execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn.cancel();
      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should execute immediately if pending', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      debouncedFn.flush();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('test');
    });

    it('should not execute if not pending', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn.flush();

      expect(fn).not.toHaveBeenCalled();
    });

    it('should clear the timer after flush', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      debouncedFn.flush();
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('pending', () => {
    it('should return true when execution is pending', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      expect(debouncedFn.pending()).toBe(false);

      debouncedFn();
      expect(debouncedFn.pending()).toBe(true);

      vi.advanceTimersByTime(100);
      expect(debouncedFn.pending()).toBe(false);
    });

    it('should return false after cancel', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(debouncedFn.pending()).toBe(true);

      debouncedFn.cancel();
      expect(debouncedFn.pending()).toBe(false);
    });
  });
});
