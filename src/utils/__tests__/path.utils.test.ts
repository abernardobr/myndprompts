/**
 * Unit tests for cross-platform path utilities
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  getBasename,
  getDirname,
  joinPath,
  splitPath,
  getRelativePath,
  getExtension,
  hasExtension,
  pathsEqual,
  isChildPath,
} from '../path.utils';

describe('path.utils', () => {
  describe('normalizePath', () => {
    it('should convert Windows backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\name\\folder')).toBe('C:/Users/name/folder');
    });

    it('should leave Unix paths unchanged', () => {
      expect(normalizePath('/home/user/folder')).toBe('/home/user/folder');
    });

    it('should handle mixed separators', () => {
      expect(normalizePath('C:\\Users/name\\folder')).toBe('C:/Users/name/folder');
    });

    it('should handle empty string', () => {
      expect(normalizePath('')).toBe('');
    });

    it('should handle paths with multiple consecutive backslashes', () => {
      expect(normalizePath('C:\\\\Users\\\\name')).toBe('C://Users//name');
    });
  });

  describe('getBasename', () => {
    it('should extract folder name from Windows path', () => {
      expect(getBasename('C:\\Users\\name\\folder')).toBe('folder');
    });

    it('should extract folder name from Unix path', () => {
      expect(getBasename('/home/user/folder')).toBe('folder');
    });

    it('should extract file name with extension', () => {
      expect(getBasename('/home/user/file.txt')).toBe('file.txt');
    });

    it('should handle trailing slash', () => {
      expect(getBasename('C:\\Users\\name\\folder\\')).toBe('folder');
      expect(getBasename('/home/user/folder/')).toBe('folder');
    });

    it('should handle root path', () => {
      expect(getBasename('/')).toBe('');
      expect(getBasename('C:\\')).toBe('');
      expect(getBasename('C:')).toBe('');
    });

    it('should handle empty string', () => {
      expect(getBasename('')).toBe('');
    });

    // The actual bug scenario from the Windows issue:
    it('should extract "Change Management" from Windows path', () => {
      expect(getBasename('C:\\Users\\rhr_c\\.myndprompt\\prompts\\Hexa64\\Change Management')).toBe(
        'Change Management'
      );
    });

    it('should handle paths with spaces', () => {
      expect(getBasename('/home/user/My Documents/file.txt')).toBe('file.txt');
      expect(getBasename('C:\\Users\\name\\My Documents')).toBe('My Documents');
    });

    it('should handle single component path', () => {
      expect(getBasename('file.txt')).toBe('file.txt');
      expect(getBasename('folder')).toBe('folder');
    });
  });

  describe('getDirname', () => {
    it('should get directory from Windows path', () => {
      expect(getDirname('C:\\Users\\name\\file.txt')).toBe('C:/Users/name');
    });

    it('should get directory from Unix path', () => {
      expect(getDirname('/home/user/file.txt')).toBe('/home/user');
    });

    it('should handle path without file', () => {
      expect(getDirname('/home/user/folder')).toBe('/home/user');
    });

    it('should handle root level file on Unix', () => {
      expect(getDirname('/file.txt')).toBe('/');
    });

    it('should handle root level file on Windows', () => {
      expect(getDirname('C:\\file.txt')).toBe('C:');
    });

    it('should handle empty string', () => {
      expect(getDirname('')).toBe('');
    });

    it('should handle single component', () => {
      expect(getDirname('file.txt')).toBe('');
    });
  });

  describe('joinPath', () => {
    it('should join path segments with forward slashes', () => {
      expect(joinPath('C:/Users', 'name', 'folder')).toBe('C:/Users/name/folder');
    });

    it('should handle segments with existing slashes', () => {
      expect(joinPath('/home/', '/user/', 'folder')).toBe('/home/user/folder');
    });

    it('should handle Windows segments', () => {
      expect(joinPath('C:\\Users', 'name')).toBe('C:/Users/name');
    });

    it('should handle empty segments', () => {
      expect(joinPath('', 'home', '', 'user')).toBe('home/user');
    });

    it('should handle single segment', () => {
      expect(joinPath('/home')).toBe('/home');
    });

    it('should handle no segments', () => {
      expect(joinPath()).toBe('');
    });

    it('should normalize mixed separators in segments', () => {
      expect(joinPath('C:\\Users\\name', 'sub\\folder')).toBe('C:/Users/name/sub/folder');
    });
  });

  describe('splitPath', () => {
    it('should split Windows path into components', () => {
      expect(splitPath('C:\\Users\\name\\folder')).toEqual(['C:', 'Users', 'name', 'folder']);
    });

    it('should split Unix path into components', () => {
      expect(splitPath('/home/user/folder')).toEqual(['home', 'user', 'folder']);
    });

    it('should handle empty string', () => {
      expect(splitPath('')).toEqual([]);
    });

    it('should handle trailing slashes', () => {
      expect(splitPath('/home/user/folder/')).toEqual(['home', 'user', 'folder']);
    });

    it('should handle single component', () => {
      expect(splitPath('file.txt')).toEqual(['file.txt']);
    });

    it('should filter out empty segments', () => {
      expect(splitPath('/home//user///folder')).toEqual(['home', 'user', 'folder']);
    });
  });

  describe('getRelativePath', () => {
    it('should get relative path from base to target', () => {
      expect(getRelativePath('/home/user/projects', '/home/user/projects/app/file.txt')).toBe(
        'app/file.txt'
      );
    });

    it('should handle Windows paths', () => {
      expect(
        getRelativePath(
          'C:\\Users\\name\\.myndprompt\\prompts',
          'C:\\Users\\name\\.myndprompt\\prompts\\folder\\file.md'
        )
      ).toBe('folder/file.md');
    });

    it('should handle same path', () => {
      expect(getRelativePath('/home/user', '/home/user')).toBe('');
    });

    it('should handle base with trailing slash', () => {
      expect(getRelativePath('/home/user/', '/home/user/file.txt')).toBe('file.txt');
    });

    it('should return target if not under base', () => {
      expect(getRelativePath('/home/user', '/other/path/file.txt')).toBe('/other/path/file.txt');
    });

    it('should handle empty base', () => {
      expect(getRelativePath('', '/home/user/file.txt')).toBe('/home/user/file.txt');
    });

    it('should handle empty target', () => {
      expect(getRelativePath('/home/user', '')).toBe('');
    });
  });

  describe('getExtension', () => {
    it('should get extension from file name', () => {
      expect(getExtension('file.txt')).toBe('.txt');
    });

    it('should get extension from path', () => {
      expect(getExtension('/home/user/file.test.ts')).toBe('.ts');
    });

    it('should return empty string for no extension', () => {
      expect(getExtension('folder')).toBe('');
      expect(getExtension('/home/user/folder')).toBe('');
    });

    it('should handle dotfiles (files starting with dot)', () => {
      expect(getExtension('.gitignore')).toBe('');
      expect(getExtension('/home/user/.bashrc')).toBe('');
    });

    it('should handle dotfiles with extension', () => {
      expect(getExtension('.env.local')).toBe('.local');
      expect(getExtension('.config.json')).toBe('.json');
    });

    it('should handle empty string', () => {
      expect(getExtension('')).toBe('');
    });

    it('should handle Windows paths', () => {
      expect(getExtension('C:\\Users\\name\\file.txt')).toBe('.txt');
    });
  });

  describe('hasExtension', () => {
    it('should return true for files with extension', () => {
      expect(hasExtension('file.txt')).toBe(true);
      expect(hasExtension('/home/user/file.md')).toBe(true);
      expect(hasExtension('C:\\Users\\file.ts')).toBe(true);
    });

    it('should return false for files without extension', () => {
      expect(hasExtension('folder')).toBe(false);
      expect(hasExtension('/home/user/folder')).toBe(false);
      expect(hasExtension('Makefile')).toBe(false);
    });

    it('should handle dotfiles', () => {
      expect(hasExtension('.gitignore')).toBe(false);
      expect(hasExtension('.env.local')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(hasExtension('')).toBe(false);
    });
  });

  describe('pathsEqual', () => {
    it('should return true for same paths with different separators', () => {
      expect(pathsEqual('C:\\Users\\name', 'C:/Users/name')).toBe(true);
    });

    it('should return true for paths with and without trailing slash', () => {
      expect(pathsEqual('/home/user/', '/home/user')).toBe(true);
      expect(pathsEqual('C:\\Users\\name\\', 'C:/Users/name')).toBe(true);
    });

    it('should return false for different paths', () => {
      expect(pathsEqual('/home/user', '/home/other')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(pathsEqual('', '')).toBe(true);
      expect(pathsEqual('', '/home')).toBe(false);
    });
  });

  describe('isChildPath', () => {
    it('should return true if child is under parent', () => {
      expect(isChildPath('/home/user', '/home/user/file.txt')).toBe(true);
      expect(isChildPath('/home/user', '/home/user/sub/folder/file.txt')).toBe(true);
    });

    it('should return true for Windows paths', () => {
      expect(isChildPath('C:\\Users', 'C:\\Users\\name\\file')).toBe(true);
    });

    it('should return false if child is not under parent', () => {
      expect(isChildPath('/home/user', '/home/other/file.txt')).toBe(false);
      expect(isChildPath('/home/user', '/home/username/file.txt')).toBe(false);
    });

    it('should return true for same path', () => {
      expect(isChildPath('/home/user', '/home/user')).toBe(true);
    });

    it('should handle trailing slashes', () => {
      expect(isChildPath('/home/user/', '/home/user/file.txt')).toBe(true);
    });

    it('should return false for empty paths', () => {
      expect(isChildPath('', '/home/user')).toBe(false);
      expect(isChildPath('/home/user', '')).toBe(false);
    });

    it('should not match partial directory names', () => {
      // /home/user should NOT match /home/username
      expect(isChildPath('/home/user', '/home/username')).toBe(false);
    });
  });
});
