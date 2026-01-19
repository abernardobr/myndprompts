/**
 * File Sync Boot File
 *
 * Initializes the file sync system and starts background indexing
 * of configured project folders on application startup.
 */

import { boot } from 'quasar/wrappers';
import { useFileSyncStore } from '@/stores/fileSyncStore';

export default boot(async () => {
  // Only run in Electron environment
  if (window?.fileSystemAPI === undefined) {
    return;
  }

  const fileSyncStore = useFileSyncStore();

  try {
    // Initialize store (loads folder configs from IndexedDB)
    await fileSyncStore.initialize();

    // Start background indexing after a delay
    // This ensures the main UI is fully loaded first
    setTimeout(() => {
      void fileSyncStore.startBackgroundIndexing();
    }, 3000); // 3 second delay
  } catch (err) {
    console.error('Failed to initialize file sync:', err);
  }
});
