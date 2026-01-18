/**
 * Snippet Provider Tests
 *
 * Tests for the custom snippet completion provider.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllSnippets,
  addCustomSnippet,
  removeCustomSnippet,
  setCustomSnippets,
  type Snippet,
} from '../snippet-provider';

describe('Snippet Provider', () => {
  beforeEach(() => {
    // Reset custom snippets before each test
    setCustomSnippets([]);
  });

  describe('Built-in snippets', () => {
    it('should have frontmatter snippets', () => {
      const snippets = getAllSnippets();
      const frontmatterSnippets = snippets.filter(
        (s) => s.label.includes('frontmatter') || s.label.startsWith('fm-')
      );
      expect(frontmatterSnippets.length).toBeGreaterThan(0);
    });

    it('should have variable snippets', () => {
      const snippets = getAllSnippets();
      const varSnippets = snippets.filter((s) => s.label.startsWith('var'));
      expect(varSnippets.length).toBeGreaterThan(0);
    });

    it('should have section snippets', () => {
      const snippets = getAllSnippets();
      const sectionSnippet = snippets.find((s) => s.label === 'section');
      expect(sectionSnippet).toBeDefined();
    });

    it('should have code block snippets', () => {
      const snippets = getAllSnippets();
      const codeblockSnippet = snippets.find((s) => s.label === 'codeblock');
      expect(codeblockSnippet).toBeDefined();
    });

    it('should have markdown formatting snippets', () => {
      const snippets = getAllSnippets();
      const boldSnippet = snippets.find((s) => s.label === 'bold');
      const italicSnippet = snippets.find((s) => s.label === 'italic');
      const linkSnippet = snippets.find((s) => s.label === 'link');

      expect(boldSnippet).toBeDefined();
      expect(italicSnippet).toBeDefined();
      expect(linkSnippet).toBeDefined();
    });

    it('should have list snippets', () => {
      const snippets = getAllSnippets();
      const listSnippet = snippets.find((s) => s.label === 'list');
      const numberedListSnippet = snippets.find((s) => s.label === 'numbered-list');
      const taskListSnippet = snippets.find((s) => s.label === 'task-list');

      expect(listSnippet).toBeDefined();
      expect(numberedListSnippet).toBeDefined();
      expect(taskListSnippet).toBeDefined();
    });

    it('should have table snippet', () => {
      const snippets = getAllSnippets();
      const tableSnippet = snippets.find((s) => s.label === 'table');
      expect(tableSnippet).toBeDefined();
      expect(tableSnippet?.insertText).toContain('|');
    });

    it('should have prompt-specific snippets', () => {
      const snippets = getAllSnippets();
      const roleSystemSnippet = snippets.find((s) => s.label === 'role-system');
      const chainOfThoughtSnippet = snippets.find((s) => s.label === 'chain-of-thought');

      expect(roleSystemSnippet).toBeDefined();
      expect(chainOfThoughtSnippet).toBeDefined();
    });
  });

  describe('Snippet content', () => {
    it('should have valid insertText for frontmatter', () => {
      const snippets = getAllSnippets();
      const frontmatterSnippet = snippets.find((s) => s.label === 'frontmatter');

      expect(frontmatterSnippet).toBeDefined();
      expect(frontmatterSnippet?.insertText).toContain('---');
      expect(frontmatterSnippet?.insertText).toContain('title:');
      expect(frontmatterSnippet?.insertText).toContain('tags:');
    });

    it('should have placeholder syntax in insertText', () => {
      const snippets = getAllSnippets();
      const frontmatterSnippet = snippets.find((s) => s.label === 'frontmatter');

      // Check for snippet placeholder syntax
      expect(frontmatterSnippet?.insertText).toMatch(/\$\{\d+:/);
    });

    it('should have template variable snippet with mustache syntax', () => {
      const snippets = getAllSnippets();
      const varSnippet = snippets.find((s) => s.label === 'var');

      expect(varSnippet).toBeDefined();
      expect(varSnippet?.insertText).toContain('{{');
      expect(varSnippet?.insertText).toContain('}}');
    });

    it('should have documentation for snippets', () => {
      const snippets = getAllSnippets();
      const documentedSnippets = snippets.filter((s) => s.documentation);

      // All snippets should have documentation
      expect(documentedSnippets.length).toBe(snippets.length);
    });
  });

  describe('Custom snippets', () => {
    it('should add custom snippet', () => {
      const customSnippet: Snippet = {
        label: 'custom-test',
        insertText: 'Custom test snippet',
        documentation: 'A test snippet',
      };

      addCustomSnippet(customSnippet);

      const snippets = getAllSnippets();
      const found = snippets.find((s) => s.label === 'custom-test');

      expect(found).toBeDefined();
      expect(found?.insertText).toBe('Custom test snippet');
    });

    it('should remove custom snippet', () => {
      const customSnippet: Snippet = {
        label: 'to-remove',
        insertText: 'Will be removed',
      };

      addCustomSnippet(customSnippet);
      expect(getAllSnippets().some((s) => s.label === 'to-remove')).toBe(true);

      removeCustomSnippet('to-remove');
      expect(getAllSnippets().some((s) => s.label === 'to-remove')).toBe(false);
    });

    it('should set all custom snippets at once', () => {
      const customSnippets: Snippet[] = [
        { label: 'custom-1', insertText: 'First' },
        { label: 'custom-2', insertText: 'Second' },
        { label: 'custom-3', insertText: 'Third' },
      ];

      setCustomSnippets(customSnippets);

      const snippets = getAllSnippets();
      expect(snippets.some((s) => s.label === 'custom-1')).toBe(true);
      expect(snippets.some((s) => s.label === 'custom-2')).toBe(true);
      expect(snippets.some((s) => s.label === 'custom-3')).toBe(true);
    });

    it('should replace custom snippets when setting', () => {
      addCustomSnippet({ label: 'old-snippet', insertText: 'Old' });

      setCustomSnippets([{ label: 'new-snippet', insertText: 'New' }]);

      const snippets = getAllSnippets();
      expect(snippets.some((s) => s.label === 'old-snippet')).toBe(false);
      expect(snippets.some((s) => s.label === 'new-snippet')).toBe(true);
    });

    it('should not affect built-in snippets when adding custom', () => {
      const builtInCount = getAllSnippets().length;

      addCustomSnippet({ label: 'custom', insertText: 'Custom' });

      const newCount = getAllSnippets().length;
      expect(newCount).toBe(builtInCount + 1);

      // Verify built-in snippets still exist
      expect(getAllSnippets().some((s) => s.label === 'frontmatter')).toBe(true);
    });
  });

  describe('Snippet categories', () => {
    it('should have instruction section snippet', () => {
      const snippets = getAllSnippets();
      const instructionSnippet = snippets.find((s) => s.label === 'instruction');

      expect(instructionSnippet).toBeDefined();
      expect(instructionSnippet?.insertText).toContain('## Instructions');
    });

    it('should have context section snippet', () => {
      const snippets = getAllSnippets();
      const contextSnippet = snippets.find((s) => s.label === 'context');

      expect(contextSnippet).toBeDefined();
      expect(contextSnippet?.insertText).toContain('## Context');
    });

    it('should have example section snippet', () => {
      const snippets = getAllSnippets();
      const exampleSnippet = snippets.find((s) => s.label === 'example');

      expect(exampleSnippet).toBeDefined();
      expect(exampleSnippet?.insertText).toContain('## Example');
      expect(exampleSnippet?.insertText).toContain('**Input:**');
      expect(exampleSnippet?.insertText).toContain('**Output:**');
    });

    it('should have constraints section snippet', () => {
      const snippets = getAllSnippets();
      const constraintsSnippet = snippets.find((s) => s.label === 'constraints');

      expect(constraintsSnippet).toBeDefined();
      expect(constraintsSnippet?.insertText).toContain('## Constraints');
    });

    it('should have format section snippet', () => {
      const snippets = getAllSnippets();
      const formatSnippet = snippets.find((s) => s.label === 'format');

      expect(formatSnippet).toBeDefined();
      expect(formatSnippet?.insertText).toContain('## Output Format');
    });
  });
});
