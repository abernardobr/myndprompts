/**
 * Global Error Handler Boot File
 *
 * Handles and filters benign errors like Monaco Editor's "Canceled" errors
 * that occur during cleanup/disposal.
 */

import { boot } from 'quasar/wrappers';

// Type guard to check if a value is an error-like object
function isCanceledError(reason: unknown): boolean {
  if (reason === null || typeof reason !== 'object') {
    return false;
  }
  const errorLike = reason as {
    message?: unknown;
    name?: unknown;
    constructor?: { name?: unknown };
  };
  return (
    errorLike.message === 'Canceled' ||
    errorLike.name === 'Canceled' ||
    errorLike.constructor?.name === 'Canceled'
  );
}

export default boot(() => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    // Filter out Monaco Editor "Canceled" errors during disposal
    // These are benign and occur when Monaco disposes internal delayers
    if (isCanceledError(event.reason)) {
      event.preventDefault();
      return;
    }
  });
});
