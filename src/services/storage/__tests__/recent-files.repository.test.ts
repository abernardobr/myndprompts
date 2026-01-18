import { describe, it, expect } from 'vitest';
import { setupStorageTests } from './setup';
import { getRecentFilesRepository } from '../repositories/recent-files.repository';

describe('RecentFilesRepository', () => {
  setupStorageTests();

  it('should add recent file', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/path/to/file.md', 'file.md', 'prompt');

    const files = await repo.getRecentFiles();
    expect(files).toHaveLength(1);
    expect(files[0]?.filePath).toBe('/path/to/file.md');
    expect(files[0]?.fileName).toBe('file.md');
    expect(files[0]?.fileType).toBe('prompt');
  });

  it('should update lastOpenedAt when adding existing file', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/path/to/file.md', 'file.md', 'prompt');
    const firstAdd = await repo.getRecentFiles();
    const firstOpenedAt = firstAdd[0]?.lastOpenedAt;

    // Wait a bit to ensure time difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await repo.addRecentFile('/path/to/file.md', 'file.md', 'prompt');
    const secondAdd = await repo.getRecentFiles();

    expect(secondAdd).toHaveLength(1);
    expect(secondAdd[0]?.lastOpenedAt.getTime()).toBeGreaterThan(firstOpenedAt?.getTime() ?? 0);
  });

  it('should order by lastOpenedAt descending', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/path/file1.md', 'file1.md', 'prompt');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await repo.addRecentFile('/path/file2.md', 'file2.md', 'prompt');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await repo.addRecentFile('/path/file3.md', 'file3.md', 'prompt');

    const files = await repo.getRecentFiles();
    expect(files[0]?.filePath).toBe('/path/file3.md');
    expect(files[2]?.filePath).toBe('/path/file1.md');
  });

  it('should pin and unpin files', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/path/to/file.md', 'file.md', 'prompt');

    await repo.pinFile('/path/to/file.md');
    let files = await repo.getPinnedFiles();
    expect(files).toHaveLength(1);

    await repo.unpinFile('/path/to/file.md');
    files = await repo.getPinnedFiles();
    expect(files).toHaveLength(0);
  });

  it('should toggle pin state', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/path/to/file.md', 'file.md', 'prompt');

    const firstToggle = await repo.togglePin('/path/to/file.md');
    expect(firstToggle).toBe(true);

    const secondToggle = await repo.togglePin('/path/to/file.md');
    expect(secondToggle).toBe(false);
  });

  it('should get files by type', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/prompts/p1.md', 'p1.md', 'prompt');
    await repo.addRecentFile('/snippets/s1.md', 's1.md', 'snippet');
    await repo.addRecentFile('/prompts/p2.md', 'p2.md', 'prompt');

    const prompts = await repo.getRecentFilesByType('prompt');
    expect(prompts).toHaveLength(2);

    const snippets = await repo.getRecentFilesByType('snippet');
    expect(snippets).toHaveLength(1);
  });

  it('should remove recent file', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/path/to/file.md', 'file.md', 'prompt');
    expect(await repo.count()).toBe(1);

    await repo.removeRecentFile('/path/to/file.md');
    expect(await repo.count()).toBe(0);
  });

  it('should clear non-pinned files', async () => {
    const repo = getRecentFilesRepository();

    await repo.addRecentFile('/file1.md', 'file1.md', 'prompt');
    await repo.addRecentFile('/file2.md', 'file2.md', 'prompt');
    await repo.pinFile('/file1.md');

    await repo.clearNonPinned();

    const files = await repo.getRecentFiles();
    expect(files).toHaveLength(1);
    expect(files[0]?.filePath).toBe('/file1.md');
  });
});
