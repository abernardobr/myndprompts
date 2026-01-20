/**
 * External App Service
 *
 * Provides functionality to open files in external applications
 * and interact with the system file manager.
 */

/**
 * Interface for external app operations available in the renderer process
 */
export interface IExternalAppService {
  /**
   * Show file in system file manager (Finder on macOS, Explorer on Windows)
   */
  showInFolder(filePath: string): Promise<void>;

  /**
   * Open file with the system default application
   */
  openWithDefault(filePath: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Open file in a specific application by name
   */
  openInApp(filePath: string, appName: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Get the platform-specific file manager name
   */
  getFileManagerName(): string;

  /**
   * Get the current platform
   */
  getPlatform(): Promise<NodeJS.Platform>;
}

/**
 * External App Service Implementation
 *
 * All operations go through the IPC bridge to the main process
 * which has access to Electron's shell module.
 */
class ExternalAppService implements IExternalAppService {
  private cachedPlatform: NodeJS.Platform | null = null;

  /**
   * Show file in system file manager
   */
  async showInFolder(filePath: string): Promise<void> {
    if (!window.externalAppsAPI) {
      console.error('externalAppsAPI not available');
      return;
    }
    await window.externalAppsAPI.showInFolder(filePath);
  }

  /**
   * Open file with system default application
   */
  async openWithDefault(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (!window.externalAppsAPI) {
      return { success: false, error: 'externalAppsAPI not available' };
    }
    return window.externalAppsAPI.openWithDefault(filePath);
  }

  /**
   * Open file in a specific application
   * @param filePath - Path to the file
   * @param appName - Name of the application (e.g., 'Microsoft Word', 'Google Chrome')
   */
  async openInApp(
    filePath: string,
    appName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!window.externalAppsAPI) {
      return { success: false, error: 'externalAppsAPI not available' };
    }
    return window.externalAppsAPI.openInApp(filePath, appName);
  }

  /**
   * Get platform-specific file manager name
   */
  getFileManagerName(): string {
    // Use cached platform if available, otherwise default to 'darwin' assumption
    // The actual platform will be fetched asynchronously
    if (this.cachedPlatform) {
      return this.getFileManagerNameForPlatform(this.cachedPlatform);
    }

    // Fetch platform asynchronously for next time
    void this.getPlatform();

    // Default to Finder (macOS) as fallback
    return 'Finder';
  }

  /**
   * Get platform-specific file manager name for a given platform
   */
  private getFileManagerNameForPlatform(platform: NodeJS.Platform): string {
    switch (platform) {
      case 'darwin':
        return 'Finder';
      case 'win32':
        return 'Explorer';
      case 'linux':
        return 'Files';
      default:
        return 'File Manager';
    }
  }

  /**
   * Get the current platform
   */
  async getPlatform(): Promise<NodeJS.Platform> {
    if (this.cachedPlatform) {
      return this.cachedPlatform;
    }

    if (!window.electronAPI) {
      return 'darwin'; // Default fallback
    }

    this.cachedPlatform = await window.electronAPI.getPlatform();
    return this.cachedPlatform;
  }
}

// Export singleton instance
export const externalAppService = new ExternalAppService();

// Export class for testing
export { ExternalAppService };
