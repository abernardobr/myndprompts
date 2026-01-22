import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Update info interface
interface IUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl?: string;
}

export const useAppStore = defineStore('app', () => {
  // State
  const isLoading = ref(false);
  const appVersion = ref('0.0.0');
  const platform = ref<NodeJS.Platform>('darwin');
  const userDataPath = ref('');

  // Update state
  const updateInfo = ref<IUpdateInfo | null>(null);
  const isCheckingUpdate = ref(false);
  const updateError = ref<string | null>(null);
  const showUpdateDialog = ref(false);
  const skippedVersions = ref<string[]>([]);

  // Getters
  const isMac = computed(() => platform.value === 'darwin');
  const isWindows = computed(() => platform.value === 'win32');
  const isLinux = computed(() => platform.value === 'linux');

  // Actions
  async function initialize(): Promise<void> {
    if (typeof window.electronAPI !== 'undefined') {
      try {
        const [version, plat, dataPath] = await Promise.all([
          window.electronAPI.getVersion(),
          window.electronAPI.getPlatform(),
          window.electronAPI.getUserDataPath(),
        ]);
        appVersion.value = version;
        platform.value = plat;
        userDataPath.value = dataPath;
      } catch (error) {
        console.error('Failed to initialize app store:', error);
      }
    }

    // Load skipped versions from localStorage
    try {
      const storedSkipped = localStorage.getItem('myndprompts:skippedVersions');
      if (storedSkipped) {
        skippedVersions.value = JSON.parse(storedSkipped) as string[];
      }
    } catch (error) {
      console.error('Failed to load skipped versions:', error);
    }
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  /**
   * Check for updates
   * @param showDialogIfNoUpdate - If true, shows dialog even when up-to-date or on error
   */
  async function checkForUpdates(showDialogIfNoUpdate = false): Promise<void> {
    if (!window.updateAPI) return;

    isCheckingUpdate.value = true;
    updateError.value = null;

    // Show dialog immediately if manual check
    if (showDialogIfNoUpdate) {
      showUpdateDialog.value = true;
    }

    try {
      const result = await window.updateAPI.checkForUpdates();

      if (result.success && result.updateInfo) {
        updateInfo.value = result.updateInfo;

        // Show dialog if update available and not skipped
        if (
          result.updateInfo.updateAvailable &&
          !skippedVersions.value.includes(result.updateInfo.latestVersion)
        ) {
          showUpdateDialog.value = true;
        } else if (showDialogIfNoUpdate) {
          showUpdateDialog.value = true;
        }
      } else if (result.error) {
        updateError.value = result.error;
        if (showDialogIfNoUpdate) {
          showUpdateDialog.value = true;
        }
      }
    } catch (err) {
      updateError.value = err instanceof Error ? err.message : 'Failed to check for updates';
      if (showDialogIfNoUpdate) {
        showUpdateDialog.value = true;
      }
    } finally {
      isCheckingUpdate.value = false;
    }
  }

  /**
   * Dismiss the update dialog
   */
  function dismissUpdateDialog(): void {
    showUpdateDialog.value = false;
  }

  /**
   * Skip a specific version
   */
  function skipVersion(version: string): void {
    if (!skippedVersions.value.includes(version)) {
      skippedVersions.value.push(version);
      localStorage.setItem('myndprompts:skippedVersions', JSON.stringify(skippedVersions.value));
    }
    showUpdateDialog.value = false;
  }

  /**
   * Open the download page for the update
   */
  async function openDownloadPage(): Promise<void> {
    if (updateInfo.value?.downloadUrl && window.updateAPI) {
      await window.updateAPI.openDownloadPage(updateInfo.value.downloadUrl);
    }
    showUpdateDialog.value = false;
  }

  return {
    // State
    isLoading,
    appVersion,
    platform,
    userDataPath,
    // Update state
    updateInfo,
    isCheckingUpdate,
    updateError,
    showUpdateDialog,
    skippedVersions,
    // Getters
    isMac,
    isWindows,
    isLinux,
    // Actions
    initialize,
    setLoading,
    // Update actions
    checkForUpdates,
    dismissUpdateDialog,
    skipVersion,
    openDownloadPage,
  };
});
