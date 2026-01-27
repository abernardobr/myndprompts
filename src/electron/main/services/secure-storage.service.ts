import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Secure Storage Service
 *
 * Uses Electron's safeStorage API to encrypt/decrypt API keys.
 * Encrypted keys are stored as base64 strings in a JSON file.
 */
export class SecureStorageService {
  private static instance: SecureStorageService | null = null;
  private readonly filePath: string;

  private constructor() {
    this.filePath = path.join(app.getPath('userData'), 'secure-keys.json');
  }

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  /**
   * Check if encryption is available on this platform
   */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Save an API key for a provider
   */
  saveApiKey(provider: string, key: string): void {
    const store = this.readStore();

    if (this.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key);
      store[provider] = encrypted.toString('base64');
    } else {
      // Fallback: base64 encode (not secure, but better than plaintext)
      console.warn('Secure encryption not available. Storing key with basic encoding.');
      store[provider] = `plain:${Buffer.from(key, 'utf-8').toString('base64')}`;
    }

    this.writeStore(store);
  }

  /**
   * Get an API key for a provider
   */
  getApiKey(provider: string): string | null {
    const store = this.readStore();
    const value = store[provider];

    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'string' && value.startsWith('plain:')) {
      // Fallback format
      return Buffer.from(value.substring(6), 'base64').toString('utf-8');
    }

    if (this.isEncryptionAvailable()) {
      const buffer = Buffer.from(value, 'base64');
      return safeStorage.decryptString(buffer);
    }

    return null;
  }

  /**
   * Delete an API key for a provider
   */
  deleteApiKey(provider: string): boolean {
    const store = this.readStore();

    if (store[provider] === undefined) {
      return false;
    }

    delete store[provider];
    this.writeStore(store);
    return true;
  }

  /**
   * Check if an API key exists for a provider
   */
  hasApiKey(provider: string): boolean {
    const store = this.readStore();
    return store[provider] !== undefined && store[provider] !== null;
  }

  /**
   * Read the encrypted key store from disk
   */
  private readStore(): Record<string, string> {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(data) as Record<string, string>;
      }
    } catch (err) {
      console.error('Failed to read secure key store:', err);
    }
    return {};
  }

  /**
   * Write the encrypted key store to disk
   */
  private writeStore(store: Record<string, string>): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write secure key store:', err);
      throw new Error('Failed to save API key securely');
    }
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    SecureStorageService.instance = null;
  }
}

export function getSecureStorageService(): SecureStorageService {
  return SecureStorageService.getInstance();
}
