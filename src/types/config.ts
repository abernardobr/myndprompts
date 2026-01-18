export interface IAppConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface ISyncConfig {
  enabled: boolean;
  provider: 'google-drive' | 'github' | null;
  lastSyncAt: string | null;
  autoSync: boolean;
  syncInterval: number;
}

export interface IUIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  settingsPanelOpen: boolean;
  activeTab: string | null;
  openTabs: string[];
  recentFiles: string[];
}

export const DEFAULT_APP_CONFIG: IAppConfig = {
  theme: 'auto',
  language: 'en-US',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 1000,
};

export const DEFAULT_SYNC_CONFIG: ISyncConfig = {
  enabled: false,
  provider: null,
  lastSyncAt: null,
  autoSync: false,
  syncInterval: 300000, // 5 minutes
};

export const DEFAULT_UI_STATE: IUIState = {
  sidebarOpen: true,
  sidebarWidth: 280,
  settingsPanelOpen: false,
  activeTab: null,
  openTabs: [],
  recentFiles: [],
};
