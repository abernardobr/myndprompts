/**
 * Update Service (Main Process)
 *
 * Handles version checking and update operations in the Electron main process.
 * Fetches remote version info, compares with current version, and manages update state.
 */

import { app } from 'electron';
import path from 'path';
import { readFileSync } from 'fs';
import { fetchVersion, API_ENDPOINTS } from '@/services/api/myndprompts-api';

// Read version from package.json (app.getVersion() returns Electron version in dev mode)
let cachedAppVersion: string | null = null;
function getAppVersion(): string {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
    cachedAppVersion = packageJson.version;
    return cachedAppVersion;
  } catch {
    cachedAppVersion = app.getVersion();
    return cachedAppVersion;
  }
}

// ==========================================
// Interfaces
// ==========================================

/**
 * Processed update information
 */
export interface IUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl?: string;
}

/**
 * Result of an update check operation
 */
export interface IUpdateCheckResult {
  success: boolean;
  updateInfo?: IUpdateInfo;
  error?: string;
}

// ==========================================
// Constants
// ==========================================

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ==========================================
// Service Implementation
// ==========================================

/**
 * Service for checking and managing application updates
 */
export class UpdateService {
  private static instance: UpdateService;

  private lastCheckTime: number = 0;
  private cachedResult: IUpdateCheckResult | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Get the current application version
   */
  getCurrentVersion(): string {
    return getAppVersion();
  }

  /**
   * Generate download URL for updates
   */
  getDownloadUrl(_version: string): string {
    return API_ENDPOINTS.DOWNLOAD_PAGE;
  }

  /**
   * Check for available updates
   * Uses cache to prevent excessive API calls
   */
  async checkForUpdates(forceRefresh = false): Promise<IUpdateCheckResult> {
    const now = Date.now();

    // Return cached result if still valid
    if (!forceRefresh && this.cachedResult && now - this.lastCheckTime < CACHE_DURATION_MS) {
      console.log('[UpdateService] Returning cached update check result');
      return this.cachedResult;
    }

    try {
      console.log('[UpdateService] Checking for updates...');

      const latestVersion = await this.fetchRemoteVersion();
      const currentVersion = this.getCurrentVersion();
      const updateAvailable = this.isUpdateAvailable(currentVersion, latestVersion);

      const updateInfo: IUpdateInfo = {
        currentVersion,
        latestVersion,
        updateAvailable,
        downloadUrl: updateAvailable ? this.getDownloadUrl(latestVersion) : undefined,
      };

      this.cachedResult = {
        success: true,
        updateInfo,
      };
      this.lastCheckTime = now;

      console.log(
        `[UpdateService] Current: ${currentVersion}, Latest: ${latestVersion}, Update available: ${updateAvailable}`
      );

      return this.cachedResult;
    } catch (error) {
      console.error('[UpdateService] Error checking for updates:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to check for updates';

      // Don't cache errors - allow retry
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch the latest version from the remote API
   */
  async fetchRemoteVersion(): Promise<string> {
    return fetchVersion();
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1: string, v2: string): number {
    // Remove 'v' prefix if present
    const clean1 = v1.replace(/^v/, '');
    const clean2 = v2.replace(/^v/, '');

    // Split into parts and handle pre-release tags
    const [version1, preRelease1] = clean1.split('-');
    const [version2, preRelease2] = clean2.split('-');

    const parts1 = version1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = version2.split('.').map((p) => parseInt(p, 10) || 0);

    // Pad arrays to same length
    const maxLength = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLength) parts1.push(0);
    while (parts2.length < maxLength) parts2.push(0);

    // Compare version numbers
    for (let i = 0; i < maxLength; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }

    // If versions are equal, compare pre-release tags
    // A version without pre-release is greater than one with pre-release
    // e.g., 1.0.0 > 1.0.0-beta
    if (!preRelease1 && preRelease2) return 1;
    if (preRelease1 && !preRelease2) return -1;
    if (preRelease1 && preRelease2) {
      return preRelease1.localeCompare(preRelease2);
    }

    return 0;
  }

  /**
   * Check if an update is available
   * Returns true if latest version is greater than current version
   */
  isUpdateAvailable(currentVersion: string, latestVersion: string): boolean {
    return this.compareVersions(latestVersion, currentVersion) > 0;
  }

  /**
   * Clear the cached result
   */
  clearCache(): void {
    this.cachedResult = null;
    this.lastCheckTime = 0;
    console.log('[UpdateService] Cache cleared');
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    UpdateService.instance = undefined as unknown as UpdateService;
  }
}

// ==========================================
// Convenience Export
// ==========================================

/**
 * Get the UpdateService singleton instance
 */
export function getUpdateService(): UpdateService {
  return UpdateService.getInstance();
}
