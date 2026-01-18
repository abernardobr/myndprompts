import { describe, it, expect } from 'vitest';
import { setupStorageTests } from './setup';
import { getConfigRepository, ConfigKeys } from '../repositories/config.repository';

describe('ConfigRepository', () => {
  setupStorageTests();

  it('should return undefined for non-existent key', async () => {
    const repo = getConfigRepository();
    const value = await repo.get(ConfigKeys.AUTO_SAVE);
    expect(value).toBeUndefined();
  });

  it('should set and get configuration value', async () => {
    const repo = getConfigRepository();

    await repo.set(ConfigKeys.AUTO_SAVE, true);
    const value = await repo.get<boolean>(ConfigKeys.AUTO_SAVE);

    expect(value).toBe(true);
  });

  it('should return default value when key does not exist', async () => {
    const repo = getConfigRepository();

    const value = await repo.getOrDefault(ConfigKeys.AUTO_SAVE, true);
    expect(value).toBe(true);
  });

  it('should return stored value instead of default', async () => {
    const repo = getConfigRepository();

    await repo.set(ConfigKeys.AUTO_SAVE, false);
    const value = await repo.getOrDefault(ConfigKeys.AUTO_SAVE, true);

    expect(value).toBe(false);
  });

  it('should remove configuration value', async () => {
    const repo = getConfigRepository();

    await repo.set(ConfigKeys.FONT_SIZE, 16);
    expect(await repo.has(ConfigKeys.FONT_SIZE)).toBe(true);

    await repo.remove(ConfigKeys.FONT_SIZE);
    expect(await repo.has(ConfigKeys.FONT_SIZE)).toBe(false);
  });

  it('should set multiple values at once', async () => {
    const repo = getConfigRepository();

    await repo.setMany({
      [ConfigKeys.AUTO_SAVE]: true,
      [ConfigKeys.FONT_SIZE]: 14,
      [ConfigKeys.TAB_SIZE]: 2,
    });

    expect(await repo.get(ConfigKeys.AUTO_SAVE)).toBe(true);
    expect(await repo.get(ConfigKeys.FONT_SIZE)).toBe(14);
    expect(await repo.get(ConfigKeys.TAB_SIZE)).toBe(2);
  });

  it('should get multiple values at once', async () => {
    const repo = getConfigRepository();

    await repo.set(ConfigKeys.AUTO_SAVE, true);
    await repo.set(ConfigKeys.FONT_SIZE, 14);

    const values = await repo.getMany([
      ConfigKeys.AUTO_SAVE,
      ConfigKeys.FONT_SIZE,
      ConfigKeys.TAB_SIZE,
    ]);

    expect(values[ConfigKeys.AUTO_SAVE]).toBe(true);
    expect(values[ConfigKeys.FONT_SIZE]).toBe(14);
    expect(values[ConfigKeys.TAB_SIZE]).toBeUndefined();
  });

  it('should initialize defaults without overwriting existing values', async () => {
    const repo = getConfigRepository();

    // Set a value first
    await repo.set(ConfigKeys.AUTO_SAVE, false);

    // Initialize defaults
    await repo.initializeDefaults({
      [ConfigKeys.AUTO_SAVE]: true,
      [ConfigKeys.FONT_SIZE]: 14,
    });

    // Existing value should not be overwritten
    expect(await repo.get(ConfigKeys.AUTO_SAVE)).toBe(false);
    // New value should be set
    expect(await repo.get(ConfigKeys.FONT_SIZE)).toBe(14);
  });
});
