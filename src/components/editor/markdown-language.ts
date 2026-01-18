/**
 * Markdown Language Configuration for Monaco Editor
 *
 * Enhanced markdown syntax highlighting with YAML frontmatter support.
 * Optimized for prompt editing with template variable highlighting.
 */

import * as monaco from 'monaco-editor';

/**
 * Register enhanced markdown language configuration
 */
export function registerMarkdownLanguage(): void {
  // Register the language configuration
  monaco.languages.setLanguageConfiguration('markdown', {
    comments: {
      blockComment: ['<!--', '-->'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] },
      { open: '`', close: '`', notIn: ['string'] },
      { open: '**', close: '**' },
      { open: '__', close: '__' },
      { open: '*', close: '*' },
      { open: '_', close: '_' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
      { open: '**', close: '**' },
      { open: '__', close: '__' },
      { open: '*', close: '*' },
      { open: '_', close: '_' },
    ],
    folding: {
      markers: {
        start: /^---\s*$/,
        end: /^---\s*$/,
      },
    },
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()=+[{\]}\\|;:'",.<>/?\s]+)/g,
    indentationRules: {
      increaseIndentPattern: /^(\s*)([-*+]|\d+\.)\s/,
      decreaseIndentPattern: /^\s*$/,
    },
  });

  // Register tokens provider for enhanced highlighting
  monaco.languages.setMonarchTokensProvider('markdown', createMarkdownMonarch());
}

/**
 * Create Monarch tokenizer for enhanced markdown with YAML frontmatter
 */
function createMarkdownMonarch(): monaco.languages.IMonarchLanguage {
  return {
    defaultToken: '',
    tokenPostfix: '.md',
    ignoreCase: true,

    // Frontmatter state
    frontMatter: false,

    // Control flow
    control: /[\\`*_[\]{}()#+\-.!]/,
    escapes: /\\(?:@control)/,

    // Non-control characters
    nonWs: /[^\s]/,

    tokenizer: {
      root: [
        // YAML frontmatter start
        [/^---\s*$/, { token: 'metatag.yaml', next: '@frontmatter' }],

        // Include standard markdown rules
        { include: '@markdown' },
      ],

      // YAML frontmatter
      frontmatter: [
        // End of frontmatter
        [/^---\s*$/, { token: 'metatag.yaml', next: '@root' }],

        // YAML key-value pairs
        [/^([a-zA-Z_][a-zA-Z0-9_-]*)(\s*:\s*)/, ['keyword.yaml', 'delimiter.yaml']],

        // YAML array items
        [/^\s*-\s+/, 'delimiter.yaml'],

        // Quoted strings
        [/"([^"\\]|\\.)*"/, 'string.yaml'],
        [/'([^'\\]|\\.)*'/, 'string.yaml'],

        // Booleans and special values
        [/\b(true|false|null|yes|no)\b/, 'keyword.yaml'],

        // Numbers
        [/\b\d+(\.\d+)?\b/, 'number.yaml'],

        // Comments
        [/#.*$/, 'comment.yaml'],

        // Default text
        [/[^\s#]+/, 'string.yaml'],
        [/\s+/, ''],
      ],

      // Standard markdown
      markdown: [
        // Template variables: {{variable}} or ${variable}
        [/\{\{[^}]+\}\}/, 'variable.md'],
        [/\$\{[^}]+\}/, 'variable.md'],

        // Headers
        [/^(#{1,6})(\s)(.*)$/, ['keyword.md', '', 'keyword.md']],

        // Code blocks with language
        [/^```\s*(\w+)\s*$/, { token: 'string.code', next: '@codeblock' }],
        [/^```\s*$/, { token: 'string.code', next: '@codeblock' }],

        // Inline code
        [/`[^`]+`/, 'string.code'],

        // Bold
        [/\*\*([^*]+)\*\*/, 'strong'],
        [/__([^_]+)__/, 'strong'],

        // Italic
        [/\*([^*]+)\*/, 'emphasis'],
        [/_([^_]+)_/, 'emphasis'],

        // Strikethrough
        [/~~([^~]+)~~/, 'invalid'],

        // Links
        [/\[([^\]]+)\]\(([^)]+)\)/, ['string.link.md', 'string.link.md']],
        [/\[([^\]]+)\]\[([^\]]*)\]/, ['string.link.md', 'string.link.md']],

        // Images
        [/!\[([^\]]*)\]\(([^)]+)\)/, ['string.link.md', 'string.link.md']],

        // Reference links
        [/^\[([^\]]+)\]:\s*(.+)$/, ['string.link.md', 'string.link.md']],

        // Blockquotes
        [/^\s*>+/, 'comment'],

        // Horizontal rules
        [/^[-*_]{3,}\s*$/, 'keyword.md'],

        // Lists
        [/^\s*[-*+]\s/, 'keyword.md'],
        [/^\s*\d+\.\s/, 'keyword.md'],

        // Task lists
        [/^\s*[-*+]\s+\[[x ]\]\s/, 'keyword.md'],

        // Tables
        [/\|/, 'keyword.md'],

        // HTML comments (for hiding content)
        [/<!--/, { token: 'comment', next: '@htmlComment' }],

        // Escape sequences
        [/@escapes/, 'escape'],

        // Default
        [/./, ''],
      ],

      // Code block
      codeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop' }],
        [/.*$/, 'string.code'],
      ],

      // HTML comment
      htmlComment: [
        [/-->/, { token: 'comment', next: '@pop' }],
        [/./, 'comment'],
      ],
    },
  };
}

/**
 * Register folding range provider for markdown
 */
export function registerMarkdownFoldingProvider(): void {
  monaco.languages.registerFoldingRangeProvider('markdown', {
    provideFoldingRanges(model: monaco.editor.ITextModel): monaco.languages.FoldingRange[] {
      const ranges: monaco.languages.FoldingRange[] = [];
      const lines = model.getLinesContent();

      // Track frontmatter
      let frontmatterStart = -1;

      // Track headers for folding
      const headerStack: { level: number; line: number }[] = [];

      // Track code blocks
      let codeBlockStart = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Frontmatter folding
        if (line.match(/^---\s*$/)) {
          if (frontmatterStart === -1) {
            frontmatterStart = lineNumber;
          } else {
            ranges.push({
              start: frontmatterStart,
              end: lineNumber,
              kind: monaco.languages.FoldingRangeKind.Region,
            });
            frontmatterStart = -1;
          }
          continue;
        }

        // Code block folding
        if (line.match(/^```/)) {
          if (codeBlockStart === -1) {
            codeBlockStart = lineNumber;
          } else {
            ranges.push({
              start: codeBlockStart,
              end: lineNumber,
              kind: monaco.languages.FoldingRangeKind.Region,
            });
            codeBlockStart = -1;
          }
          continue;
        }

        // Header folding
        const headerMatch = line.match(/^(#{1,6})\s/);
        if (headerMatch) {
          const level = headerMatch[1].length;

          // Close all headers of same or higher level
          while (headerStack.length > 0 && headerStack[headerStack.length - 1].level >= level) {
            const prev = headerStack.pop();
            if (prev && lineNumber - 1 > prev.line) {
              ranges.push({
                start: prev.line,
                end: lineNumber - 1,
                kind: monaco.languages.FoldingRangeKind.Region,
              });
            }
          }

          headerStack.push({ level, line: lineNumber });
        }
      }

      // Close remaining headers
      const lastLine = lines.length;
      while (headerStack.length > 0) {
        const prev = headerStack.pop();
        if (prev && lastLine > prev.line) {
          ranges.push({
            start: prev.line,
            end: lastLine,
            kind: monaco.languages.FoldingRangeKind.Region,
          });
        }
      }

      return ranges;
    },
  });
}

/**
 * Initialize all markdown language features
 */
export function initializeMarkdownLanguage(): void {
  registerMarkdownLanguage();
  registerMarkdownFoldingProvider();
}
