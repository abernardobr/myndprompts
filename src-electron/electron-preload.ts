/**
 * Electron Preload Script
 *
 * This file bridges the main process and renderer process.
 * It exposes secure APIs to the renderer via contextBridge.
 */

// Import and re-export the full preload implementation
import '../src/electron/preload/index';
