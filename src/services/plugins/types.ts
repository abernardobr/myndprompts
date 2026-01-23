import type { PluginType, IPluginItem } from '../storage/entities';

/**
 * Plugin from marketplace API (without install metadata)
 */
export interface IMarketplacePlugin {
  id: string;
  name: string;
  description?: string;
  version: string;
  type?: PluginType;
  language?: string;
  tags: string[];
  items: IPluginItem[];
}

/**
 * Update check result for a single plugin
 */
export interface IPluginUpdateInfo {
  pluginId: string;
  currentVersion: string;
  availableVersion: string;
}

/**
 * Result of plugin operations
 */
export interface IPluginOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Plugin type display information
 */
export interface IPluginTypeInfo {
  type: PluginType;
  label: string;
  icon: string;
  color: string;
}

/**
 * Plugin type metadata for UI display
 */
export const PLUGIN_TYPE_INFO: Record<PluginType, IPluginTypeInfo> = {
  persona: {
    type: 'persona',
    label: 'Persona',
    icon: 'mdi-account',
    color: 'purple',
  },
  templates: {
    type: 'templates',
    label: 'Templates',
    icon: 'mdi-file-document-outline',
    color: 'blue',
  },
  code_snippets: {
    type: 'code_snippets',
    label: 'Code Snippets',
    icon: 'mdi-code-braces',
    color: 'orange',
  },
  text_snippets: {
    type: 'text_snippets',
    label: 'Text Snippets',
    icon: 'mdi-text',
    color: 'green',
  },
};

/**
 * Plugin type to directory name mapping
 */
export const PLUGIN_TYPE_DIRECTORY_MAP: Record<PluginType, string> = {
  persona: 'Personas',
  templates: 'Templates',
  code_snippets: 'Snippets',
  text_snippets: 'Snippets',
};

/**
 * Format plugin type for display
 */
export function formatPluginType(type: PluginType): string {
  return PLUGIN_TYPE_INFO[type]?.label ?? type;
}

/**
 * Get icon for plugin type
 */
export function getPluginTypeIcon(type: PluginType): string {
  return PLUGIN_TYPE_INFO[type]?.icon ?? 'mdi-puzzle';
}

/**
 * Get color for plugin type
 */
export function getPluginTypeColor(type: PluginType): string {
  return PLUGIN_TYPE_INFO[type]?.color ?? 'grey';
}
