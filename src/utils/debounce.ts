/**
 * Debounce Utility
 *
 * Creates a debounced version of a function that delays execution
 * until after a specified wait time has elapsed since the last call.
 */

export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after `wait` milliseconds have elapsed since the last time it was invoked.
 *
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function with cancel, flush, and pending methods
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    lastArgs = args;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs !== null) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, wait);
  };

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debounced.flush = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      if (lastArgs !== null) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }
  };

  debounced.pending = (): boolean => {
    return timeoutId !== null;
  };

  return debounced;
}
