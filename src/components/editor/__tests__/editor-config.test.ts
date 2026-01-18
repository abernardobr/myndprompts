/**
 * Editor Configuration Tests
 *
 * Tests for the Monaco editor configuration options and themes.
 */

import { describe, it, expect } from 'vitest';
import {
  lightTheme,
  darkTheme,
  getDefaultEditorOptions,
  getDiffEditorOptions,
  getReadOnlyEditorOptions,
} from '../editor-config';

describe('Editor Configuration', () => {
  describe('Theme definitions', () => {
    it('should define light theme with correct base', () => {
      expect(lightTheme.base).toBe('vs');
      expect(lightTheme.inherit).toBe(true);
    });

    it('should define dark theme with correct base', () => {
      expect(darkTheme.base).toBe('vs-dark');
      expect(darkTheme.inherit).toBe(true);
    });

    it('should have token rules for YAML in light theme', () => {
      const yamlRule = lightTheme.rules.find((r) => r.token === 'keyword.yaml');
      expect(yamlRule).toBeDefined();
      expect(yamlRule?.foreground).toBeDefined();
    });

    it('should have token rules for YAML in dark theme', () => {
      const yamlRule = darkTheme.rules.find((r) => r.token === 'keyword.yaml');
      expect(yamlRule).toBeDefined();
      expect(yamlRule?.foreground).toBeDefined();
    });

    it('should have markdown emphasis rules', () => {
      const emphasisRule = lightTheme.rules.find((r) => r.token === 'emphasis');
      expect(emphasisRule).toBeDefined();
      expect(emphasisRule?.fontStyle).toBe('italic');
    });

    it('should have markdown strong rules', () => {
      const strongRule = lightTheme.rules.find((r) => r.token === 'strong');
      expect(strongRule).toBeDefined();
      expect(strongRule?.fontStyle).toBe('bold');
    });

    it('should define editor background colors', () => {
      expect(lightTheme.colors['editor.background']).toBe('#ffffff');
      expect(darkTheme.colors['editor.background']).toBe('#1e1e1e');
    });

    it('should define cursor colors', () => {
      expect(lightTheme.colors['editorCursor.foreground']).toBeDefined();
      expect(darkTheme.colors['editorCursor.foreground']).toBeDefined();
    });
  });

  describe('Default editor options', () => {
    it('should set markdown as default language', () => {
      const options = getDefaultEditorOptions();
      expect(options.language).toBe('markdown');
    });

    it('should enable automatic layout', () => {
      const options = getDefaultEditorOptions();
      expect(options.automaticLayout).toBe(true);
    });

    it('should set default font size', () => {
      const options = getDefaultEditorOptions();
      expect(options.fontSize).toBe(14);
    });

    it('should enable word wrap', () => {
      const options = getDefaultEditorOptions();
      expect(options.wordWrap).toBe('on');
    });

    it('should enable minimap', () => {
      const options = getDefaultEditorOptions();
      expect(options.minimap?.enabled).toBe(true);
    });

    it('should enable folding', () => {
      const options = getDefaultEditorOptions();
      expect(options.folding).toBe(true);
    });

    it('should enable smooth scrolling', () => {
      const options = getDefaultEditorOptions();
      expect(options.smoothScrolling).toBe(true);
    });

    it('should have padding configured', () => {
      const options = getDefaultEditorOptions();
      expect(options.padding?.top).toBe(10);
      expect(options.padding?.bottom).toBe(10);
    });
  });

  describe('Diff editor options', () => {
    it('should inherit from default options', () => {
      const options = getDiffEditorOptions();
      expect(options.language).toBe('markdown');
      expect(options.automaticLayout).toBe(true);
    });

    it('should enable side by side rendering', () => {
      const options = getDiffEditorOptions();
      expect(options.renderSideBySide).toBe(true);
    });

    it('should make original editor read-only', () => {
      const options = getDiffEditorOptions();
      expect(options.originalEditable).toBe(false);
    });

    it('should not ignore whitespace trimming', () => {
      const options = getDiffEditorOptions();
      expect(options.ignoreTrimWhitespace).toBe(false);
    });
  });

  describe('Read-only editor options', () => {
    it('should inherit from default options', () => {
      const options = getReadOnlyEditorOptions();
      expect(options.automaticLayout).toBe(true);
    });

    it('should be read-only', () => {
      const options = getReadOnlyEditorOptions();
      expect(options.readOnly).toBe(true);
      expect(options.domReadOnly).toBe(true);
    });

    it('should disable line highlighting', () => {
      const options = getReadOnlyEditorOptions();
      expect(options.renderLineHighlight).toBe('none');
    });

    it('should disable minimap', () => {
      const options = getReadOnlyEditorOptions();
      expect(options.minimap?.enabled).toBe(false);
    });
  });
});
