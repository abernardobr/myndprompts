import { describe, it, expect } from 'vitest';
import { setupStorageTests } from './setup';
import { getUIStateRepository } from '../repositories/ui-state.repository';
import { DEFAULT_UI_STATE } from '../entities';

describe('UIStateRepository', () => {
  setupStorageTests();

  it('should create default state if not exists', async () => {
    const repo = getUIStateRepository();
    const state = await repo.getState();

    expect(state).toBeDefined();
    expect(state.openTabs).toEqual(DEFAULT_UI_STATE.openTabs);
    expect(state.sidebarWidth).toBe(DEFAULT_UI_STATE.sidebarWidth);
    expect(state.theme).toBe(DEFAULT_UI_STATE.theme);
  });

  it('should update state', async () => {
    const repo = getUIStateRepository();

    await repo.updateState({ sidebarWidth: 300 });
    const state = await repo.getState();

    expect(state.sidebarWidth).toBe(300);
  });

  it('should add and remove tabs', async () => {
    const repo = getUIStateRepository();

    await repo.addTab('/path/to/file1.md');
    await repo.addTab('/path/to/file2.md');

    let state = await repo.getState();
    expect(state.openTabs).toEqual(['/path/to/file1.md', '/path/to/file2.md']);
    expect(state.activeTab).toBe('/path/to/file2.md');

    await repo.removeTab('/path/to/file1.md');
    state = await repo.getState();
    expect(state.openTabs).toEqual(['/path/to/file2.md']);
  });

  it('should not duplicate tabs', async () => {
    const repo = getUIStateRepository();

    await repo.addTab('/path/to/file.md');
    await repo.addTab('/path/to/file.md');

    const state = await repo.getState();
    expect(state.openTabs).toEqual(['/path/to/file.md']);
  });

  it('should set active tab when adding existing tab', async () => {
    const repo = getUIStateRepository();

    await repo.addTab('/path/to/file1.md');
    await repo.addTab('/path/to/file2.md');

    let state = await repo.getState();
    expect(state.activeTab).toBe('/path/to/file2.md');

    await repo.addTab('/path/to/file1.md');
    state = await repo.getState();
    expect(state.activeTab).toBe('/path/to/file1.md');
  });

  it('should toggle sidebar', async () => {
    const repo = getUIStateRepository();

    let state = await repo.getState();
    expect(state.sidebarCollapsed).toBe(false);

    await repo.toggleSidebar();
    state = await repo.getState();
    expect(state.sidebarCollapsed).toBe(true);

    await repo.toggleSidebar();
    state = await repo.getState();
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('should set theme', async () => {
    const repo = getUIStateRepository();

    await repo.setTheme('dark');
    const state = await repo.getState();
    expect(state.theme).toBe('dark');
  });

  it('should reset to defaults', async () => {
    const repo = getUIStateRepository();

    await repo.updateState({
      sidebarWidth: 400,
      theme: 'dark',
    });

    await repo.resetToDefaults();
    const state = await repo.getState();

    expect(state.sidebarWidth).toBe(DEFAULT_UI_STATE.sidebarWidth);
    expect(state.theme).toBe(DEFAULT_UI_STATE.theme);
  });
});
