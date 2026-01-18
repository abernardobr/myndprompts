import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAppStore = defineStore('app', () => {
  // State
  const isLoading = ref(false);
  const appVersion = ref('0.0.0');
  const platform = ref<NodeJS.Platform>('darwin');
  const userDataPath = ref('');

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
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  return {
    // State
    isLoading,
    appVersion,
    platform,
    userDataPath,
    // Getters
    isMac,
    isWindows,
    isLinux,
    // Actions
    initialize,
    setLoading,
  };
});
