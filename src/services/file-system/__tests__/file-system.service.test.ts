import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  FileSystemService,
  getFileSystemService,
  resetFileSystemService,
} from '../../../electron/main/services/file-system.service';

describe('FileSystemService', () => {
  let service: FileSystemService;
  let testDir: string;

  beforeEach(async () => {
    resetFileSystemService();
    // Create a unique temp directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'myndprompt-test-'));
    service = new FileSystemService(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('path validation', () => {
    it('should validate paths within base directory', () => {
      const validPath = path.join(testDir, 'test.md');
      const result = service.validatePath(validPath);
      expect(result).toBe(validPath);
    });

    it('should validate relative paths', () => {
      const relativePath = 'subdir/test.md';
      const result = service.validatePath(relativePath);
      expect(result).toBe(path.join(testDir, relativePath));
    });

    it('should reject path traversal attempts', () => {
      const maliciousPath = '../../../etc/passwd';
      expect(() => service.validatePath(maliciousPath)).toThrow('Path traversal detected');
    });

    it('should reject absolute paths outside base directory', () => {
      const outsidePath = '/etc/passwd';
      expect(() => service.validatePath(outsidePath)).toThrow('Path traversal detected');
    });

    it('should reject paths with null bytes', () => {
      const nullBytePath = 'test\0.md';
      expect(() => service.validatePath(nullBytePath)).toThrow('contains null bytes');
    });

    it('should handle complex path traversal attempts', () => {
      const complexPath = path.join(testDir, 'a', '..', '..', 'etc', 'passwd');
      expect(() => service.validatePath(complexPath)).toThrow('Path traversal detected');
    });
  });

  describe('isPathAllowed', () => {
    it('should return true for valid paths', () => {
      expect(service.isPathAllowed('test.md')).toBe(true);
      expect(service.isPathAllowed(path.join(testDir, 'test.md'))).toBe(true);
    });

    it('should return false for invalid paths', () => {
      expect(service.isPathAllowed('../etc/passwd')).toBe(false);
      expect(service.isPathAllowed('/etc/passwd')).toBe(false);
    });
  });

  describe('file operations', () => {
    it('should write and read a file', async () => {
      const filePath = path.join(testDir, 'test.md');
      const content = '# Test Content\n\nHello World!';

      const writeResult = await service.writeFile(filePath, content, { createDirectories: true });
      expect(writeResult.success).toBe(true);

      const readContent = await service.readFile(filePath);
      expect(readContent).toBe(content);
    });

    it('should check if file exists', async () => {
      const filePath = path.join(testDir, 'exists.md');

      expect(await service.fileExists(filePath)).toBe(false);

      await service.writeFile(filePath, 'content', { createDirectories: true });

      expect(await service.fileExists(filePath)).toBe(true);
    });

    it('should delete a file', async () => {
      const filePath = path.join(testDir, 'to-delete.md');
      await service.writeFile(filePath, 'content', { createDirectories: true });

      expect(await service.fileExists(filePath)).toBe(true);

      const result = await service.deleteFile(filePath);
      expect(result.success).toBe(true);

      expect(await service.fileExists(filePath)).toBe(false);
    });

    it('should copy a file', async () => {
      const sourcePath = path.join(testDir, 'source.md');
      const destPath = path.join(testDir, 'dest.md');
      const content = 'Source content';

      await service.writeFile(sourcePath, content, { createDirectories: true });

      const result = await service.copyFile(sourcePath, destPath);
      expect(result.success).toBe(true);

      const copiedContent = await service.readFile(destPath);
      expect(copiedContent).toBe(content);
    });

    it('should move a file', async () => {
      const sourcePath = path.join(testDir, 'to-move.md');
      const destPath = path.join(testDir, 'moved.md');
      const content = 'Moving content';

      await service.writeFile(sourcePath, content, { createDirectories: true });

      const result = await service.moveFile(sourcePath, destPath);
      expect(result.success).toBe(true);

      expect(await service.fileExists(sourcePath)).toBe(false);
      expect(await service.fileExists(destPath)).toBe(true);

      const movedContent = await service.readFile(destPath);
      expect(movedContent).toBe(content);
    });

    it('should get file info', async () => {
      const filePath = path.join(testDir, 'info-test.md');
      const content = 'File info content';

      await service.writeFile(filePath, content, { createDirectories: true });

      const info = await service.getFileInfo(filePath);

      expect(info).not.toBeNull();
      expect(info?.name).toBe('info-test.md');
      expect(info?.extension).toBe('.md');
      expect(info?.size).toBe(content.length);
      expect(info?.isDirectory).toBe(false);
      expect(info?.createdAt).toBeInstanceOf(Date);
      expect(info?.modifiedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent file info', async () => {
      const info = await service.getFileInfo(path.join(testDir, 'non-existent.md'));
      expect(info).toBeNull();
    });
  });

  describe('directory operations', () => {
    it('should create a directory', async () => {
      const dirPath = path.join(testDir, 'new-dir');

      const result = await service.createDirectory(dirPath);
      expect(result.success).toBe(true);

      expect(await service.directoryExists(dirPath)).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedPath = path.join(testDir, 'a', 'b', 'c');

      const result = await service.createDirectory(nestedPath);
      expect(result.success).toBe(true);

      expect(await service.directoryExists(nestedPath)).toBe(true);
    });

    it('should read a directory', async () => {
      const dirPath = path.join(testDir, 'list-test');
      await service.createDirectory(dirPath);

      await service.writeFile(path.join(dirPath, 'file1.md'), 'content1');
      await service.writeFile(path.join(dirPath, 'file2.md'), 'content2');
      await service.createDirectory(path.join(dirPath, 'subdir'));

      const listing = await service.readDirectory(dirPath);

      expect(listing.path).toBe(dirPath);
      expect(listing.files).toHaveLength(2);
      expect(listing.directories).toHaveLength(1);
      expect(listing.files.map((f) => f.name).sort()).toEqual(['file1.md', 'file2.md']);
      expect(listing.directories[0]?.name).toBe('subdir');
    });

    it('should delete an empty directory', async () => {
      const dirPath = path.join(testDir, 'empty-dir');
      await service.createDirectory(dirPath);

      const result = await service.deleteDirectory(dirPath);
      expect(result.success).toBe(true);

      expect(await service.directoryExists(dirPath)).toBe(false);
    });

    it('should delete a directory recursively', async () => {
      const dirPath = path.join(testDir, 'recursive-dir');
      await service.createDirectory(dirPath);
      await service.writeFile(path.join(dirPath, 'file.md'), 'content');
      await service.createDirectory(path.join(dirPath, 'subdir'));
      await service.writeFile(path.join(dirPath, 'subdir', 'nested.md'), 'nested');

      const result = await service.deleteDirectory(dirPath, true);
      expect(result.success).toBe(true);

      expect(await service.directoryExists(dirPath)).toBe(false);
    });
  });

  describe('path utilities', () => {
    it('should join paths', () => {
      const result = service.joinPath('a', 'b', 'c.md');
      expect(result).toBe(path.join('a', 'b', 'c.md'));
    });

    it('should get file name', () => {
      expect(service.getFileName('/path/to/file.md')).toBe('file.md');
      expect(service.getFileName('file.md')).toBe('file.md');
    });

    it('should get file extension', () => {
      expect(service.getFileExtension('/path/to/file.md')).toBe('.md');
      expect(service.getFileExtension('/path/to/file.snippet.md')).toBe('.md');
    });

    it('should get directory name', () => {
      expect(service.getDirectoryName('/path/to/file.md')).toBe('/path/to');
    });
  });

  describe('listMarkdownFiles', () => {
    it('should list all markdown files recursively', async () => {
      const dirPath = path.join(testDir, 'md-files');
      await service.createDirectory(dirPath);
      await service.writeFile(path.join(dirPath, 'file1.md'), '# File 1');
      await service.writeFile(path.join(dirPath, 'file2.md'), '# File 2');
      await service.writeFile(path.join(dirPath, 'other.txt'), 'Not markdown');
      await service.createDirectory(path.join(dirPath, 'subdir'));
      await service.writeFile(path.join(dirPath, 'subdir', 'nested.md'), '# Nested');

      const files = await service.listMarkdownFiles(dirPath);

      expect(files).toHaveLength(3);
      const names = files.map((f) => f.name);
      expect(names).toContain('file1.md');
      expect(names).toContain('file2.md');
      expect(names).toContain('nested.md');
      expect(names).not.toContain('other.txt');
    });

    it('should filter by custom pattern', async () => {
      const dirPath = path.join(testDir, 'pattern-test');
      await service.createDirectory(dirPath);
      await service.writeFile(path.join(dirPath, 'prompt.md'), 'content');
      await service.writeFile(path.join(dirPath, 'snippet.snippet.md'), 'content');
      await service.writeFile(path.join(dirPath, 'persona.persona.md'), 'content');

      const snippets = await service.listMarkdownFiles(dirPath, /\.snippet\.md$/);

      expect(snippets).toHaveLength(1);
      expect(snippets[0]?.name).toBe('snippet.snippet.md');
    });
  });

  describe('configuration', () => {
    it('should return storage configuration', () => {
      const config = service.getConfig();

      expect(config.baseDir).toBe(testDir);
      expect(config.promptsDir).toBe(path.join(testDir, 'prompts'));
      expect(config.snippetsDir).toBe(path.join(testDir, 'snippets'));
      expect(config.personasDir).toBe(path.join(testDir, 'personas'));
      expect(config.templatesDir).toBe(path.join(testDir, 'templates'));
      expect(config.projectsDir).toBe(path.join(testDir, 'projects'));
      expect(config.backupsDir).toBe(path.join(testDir, 'backups'));
    });

    it('should return base path', () => {
      expect(service.getBasePath()).toBe(testDir);
    });
  });

  describe('initializeDirectories', () => {
    it('should create all default directories', async () => {
      await service.initializeDirectories();

      const config = service.getConfig();

      expect(await service.directoryExists(config.baseDir)).toBe(true);
      expect(await service.directoryExists(config.promptsDir)).toBe(true);
      expect(await service.directoryExists(config.snippetsDir)).toBe(true);
      expect(await service.directoryExists(config.personasDir)).toBe(true);
      expect(await service.directoryExists(config.templatesDir)).toBe(true);
      expect(await service.directoryExists(config.projectsDir)).toBe(true);
      expect(await service.directoryExists(config.backupsDir)).toBe(true);
    });
  });

  describe('backupFile', () => {
    it('should create a backup of a file', async () => {
      await service.initializeDirectories();

      const filePath = path.join(testDir, 'prompts', 'to-backup.md');
      const content = '# Important prompt';
      await service.writeFile(filePath, content, { createDirectories: true });

      const result = await service.backupFile(filePath);

      expect(result.success).toBe(true);
      expect(result.path).toContain('.bak');
      expect(result.path).toContain('to-backup.md');

      // Verify backup exists and has correct content
      if (result.path) {
        const backupContent = await service.readFile(result.path);
        expect(backupContent).toBe(content);
      }
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetFileSystemService();
      const instance1 = getFileSystemService(testDir);
      const instance2 = getFileSystemService();

      expect(instance1).toBe(instance2);
    });

    it('should reset the instance', () => {
      const instance1 = getFileSystemService(testDir);
      resetFileSystemService();
      const instance2 = getFileSystemService(testDir);

      expect(instance1).not.toBe(instance2);
    });
  });
});
