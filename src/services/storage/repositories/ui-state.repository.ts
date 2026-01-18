import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IUIState } from '../entities';
import { DEFAULT_UI_STATE } from '../entities';

/**
 * Repository for managing UI state persistence.
 *
 * Stores layout preferences, open tabs, theme settings, etc.
 */
export class UIStateRepository extends BaseRepository<IUIState, string> {
  private static instance: UIStateRepository | null = null;
  private static readonly DEFAULT_STATE_ID = 'default';

  private constructor() {
    super(getDB().uiState);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UIStateRepository {
    if (!UIStateRepository.instance) {
      UIStateRepository.instance = new UIStateRepository();
    }
    return UIStateRepository.instance;
  }

  /**
   * Get the current UI state (creates default if not exists)
   */
  async getState(): Promise<IUIState> {
    let state = await this.getById(UIStateRepository.DEFAULT_STATE_ID);

    if (!state) {
      state = {
        id: UIStateRepository.DEFAULT_STATE_ID,
        ...DEFAULT_UI_STATE,
      };
      await this.create(state);
    }

    return state;
  }

  /**
   * Update the UI state
   */
  async updateState(changes: Partial<Omit<IUIState, 'id'>>): Promise<void> {
    const exists = await this.exists(UIStateRepository.DEFAULT_STATE_ID);

    if (exists) {
      await this.update(UIStateRepository.DEFAULT_STATE_ID, changes);
    } else {
      await this.create({
        id: UIStateRepository.DEFAULT_STATE_ID,
        ...DEFAULT_UI_STATE,
        ...changes,
      });
    }
  }

  /**
   * Add a tab to the open tabs list
   */
  async addTab(filePath: string): Promise<void> {
    const state = await this.getState();
    if (!state.openTabs.includes(filePath)) {
      await this.updateState({
        openTabs: [...state.openTabs, filePath],
        activeTab: filePath,
      });
    } else {
      await this.updateState({ activeTab: filePath });
    }
  }

  /**
   * Remove a tab from the open tabs list
   */
  async removeTab(filePath: string): Promise<void> {
    const state = await this.getState();
    const newTabs = state.openTabs.filter((tab) => tab !== filePath);
    const newActiveTab =
      state.activeTab === filePath ? newTabs[newTabs.length - 1] : state.activeTab;

    await this.updateState({
      openTabs: newTabs,
      activeTab: newActiveTab,
    });
  }

  /**
   * Set the active tab
   */
  async setActiveTab(filePath: string | undefined): Promise<void> {
    await this.updateState({ activeTab: filePath });
  }

  /**
   * Reorder tabs
   */
  async reorderTabs(newOrder: string[]): Promise<void> {
    await this.updateState({ openTabs: newOrder });
  }

  /**
   * Set sidebar width
   */
  async setSidebarWidth(width: number): Promise<void> {
    await this.updateState({ sidebarWidth: width });
  }

  /**
   * Toggle sidebar collapsed state
   */
  async toggleSidebar(): Promise<void> {
    const state = await this.getState();
    await this.updateState({ sidebarCollapsed: !state.sidebarCollapsed });
  }

  /**
   * Set panel height
   */
  async setPanelHeight(height: number): Promise<void> {
    await this.updateState({ panelHeight: height });
  }

  /**
   * Toggle panel collapsed state
   */
  async togglePanel(): Promise<void> {
    const state = await this.getState();
    await this.updateState({ panelCollapsed: !state.panelCollapsed });
  }

  /**
   * Set theme
   */
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.updateState({ theme });
  }

  /**
   * Set locale
   */
  async setLocale(locale: string): Promise<void> {
    await this.updateState({ locale });
  }

  /**
   * Reset UI state to defaults
   */
  async resetToDefaults(): Promise<void> {
    await this.upsert({
      id: UIStateRepository.DEFAULT_STATE_ID,
      ...DEFAULT_UI_STATE,
    });
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    UIStateRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getUIStateRepository(): UIStateRepository {
  return UIStateRepository.getInstance();
}
