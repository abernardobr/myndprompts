/**
 * MyndPrompts API Service
 *
 * Centralized API calls to myndprompts.com
 * All external API calls should go through this service.
 */

// ==========================================
// Configuration
// ==========================================

const BASE_URL = 'https://www.myndprompts.com';

export const API_ENDPOINTS = {
  /** Returns JSON with current version: { version: string } */
  VERSION: `${BASE_URL}/version`,
  /** Returns JSON array of marketplace plugins */
  PLUGINS: `${BASE_URL}/plugins`,
  /** HTML page for downloading the app (not an API endpoint) */
  DOWNLOAD_PAGE: `${BASE_URL}/update`,
} as const;

const DEFAULT_TIMEOUT_MS = 10_000; // 10 seconds

// ==========================================
// Types
// ==========================================

export interface IVersionResponse {
  version: string;
}

export interface IPluginItemResponse {
  title?: string;
  description?: string;
  content?: string;
  language?: string;
  tags?: string[];
  type?: string;
}

export interface IMarketplacePluginResponse {
  id: string;
  name: string;
  description?: string;
  version: string;
  type?: string;
  language?: string;
  tags: string[];
  items: IPluginItemResponse[];
}

export interface IApiError {
  message: string;
  status?: number;
  isTimeout?: boolean;
  isOffline?: boolean;
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Check if browser/node is online
 */
function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if we can't check
}

/**
 * Create a fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse API error from response or exception
 */
function parseError(error: unknown, url: string): IApiError {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        message: `Request timeout - server did not respond`,
        isTimeout: true,
      };
    }
    return { message: error.message };
  }
  return { message: `Failed to fetch from ${url}` };
}

// ==========================================
// API Methods
// ==========================================

/**
 * Fetch the latest version from the API
 * @returns The latest version string
 * @throws IApiError on failure
 */
export async function fetchVersion(): Promise<string> {
  const url = API_ENDPOINTS.VERSION;

  if (!isOnline()) {
    throw { message: 'No internet connection', isOffline: true } as IApiError;
  }

  try {
    console.log('[MyndPromptsAPI] Fetching version from:', url);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      } as IApiError;
    }

    const data = (await response.json()) as IVersionResponse;

    if (!data || typeof data.version !== 'string') {
      throw { message: 'Invalid version response format' } as IApiError;
    }

    console.log('[MyndPromptsAPI] Version fetched:', data.version);
    return data.version;
  } catch (error) {
    if ((error as IApiError).message) {
      throw error;
    }
    throw parseError(error, url);
  }
}

/**
 * Fetch marketplace plugins from the API
 * @returns Array of marketplace plugins
 * @throws IApiError on failure
 */
export async function fetchMarketplacePlugins(): Promise<IMarketplacePluginResponse[]> {
  const url = API_ENDPOINTS.PLUGINS;

  if (!isOnline()) {
    throw { message: 'No internet connection', isOffline: true } as IApiError;
  }

  try {
    console.log('[MyndPromptsAPI] Fetching plugins from:', url);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      } as IApiError;
    }

    const data = (await response.json()) as IMarketplacePluginResponse[];

    if (!Array.isArray(data)) {
      throw { message: 'Invalid plugins response format - expected array' } as IApiError;
    }

    console.log('[MyndPromptsAPI] Plugins fetched:', data.length, 'plugins');
    return data;
  } catch (error) {
    if ((error as IApiError).message) {
      throw error;
    }
    throw parseError(error, url);
  }
}

// ==========================================
// Singleton API Client (optional usage pattern)
// ==========================================

export const myndPromptsApi = {
  endpoints: API_ENDPOINTS,
  fetchVersion,
  fetchMarketplacePlugins,
} as const;

export default myndPromptsApi;
