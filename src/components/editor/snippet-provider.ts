/**
 * Snippet Provider for Monaco Editor
 *
 * Provides custom autocomplete suggestions for prompt templates,
 * including frontmatter snippets, markdown structures, template variables,
 * and user-defined snippets with trigger characters (@, #, $, !).
 */

import * as monaco from 'monaco-editor';
import type { ISnippetFile } from '@/services/file-system/types';
import { useFileSyncStore } from '@/stores/fileSyncStore';

/**
 * Snippet definition interface
 */
export interface Snippet {
  label: string;
  insertText: string;
  documentation?: string;
  detail?: string;
  kind?: monaco.languages.CompletionItemKind;
  triggerCharacters?: string[];
}

/**
 * User snippets provider interface for dynamic snippet loading
 */
export interface UserSnippetsProvider {
  getAll: () => ISnippetFile[];
  getByType: (type: string) => ISnippetFile[];
}

/**
 * User snippets provider instance
 */
let userSnippetsProvider: UserSnippetsProvider | null = null;

/**
 * Set the user snippets provider (called from snippet store)
 */
export function setUserSnippetsProvider(provider: UserSnippetsProvider): void {
  userSnippetsProvider = provider;
}

/**
 * Get user snippets for completion
 */
function getUserSnippets(): ISnippetFile[] {
  return userSnippetsProvider?.getAll() ?? [];
}

/**
 * Built-in snippet templates for prompts
 */
const builtInSnippets: Snippet[] = [
  // Frontmatter snippets
  {
    label: 'frontmatter',
    insertText: [
      '---',
      'title: ${1:Untitled Prompt}',
      'description: ${2:A brief description}',
      'tags:',
      '  - ${3:tag1}',
      'variables:',
      '  - name: ${4:variable_name}',
      '    description: ${5:Variable description}',
      '    default: ${6:default_value}',
      '---',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert YAML frontmatter template',
    detail: 'Frontmatter Template',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'fm-minimal',
    insertText: ['---', 'title: ${1:Untitled}', 'tags: [${2:general}]', '---', '', '${0}'].join(
      '\n'
    ),
    documentation: 'Insert minimal frontmatter',
    detail: 'Minimal Frontmatter',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'fm-full',
    insertText: [
      '---',
      'title: ${1:Prompt Title}',
      'description: ${2:Detailed description of what this prompt does}',
      'author: ${3:Your Name}',
      'version: ${4:1.0.0}',
      'created: ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}',
      'updated: ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}',
      'tags:',
      '  - ${5:category}',
      '  - ${6:use-case}',
      'model:',
      '  recommended: ${7|claude-3-opus,claude-3-sonnet,gpt-4,gpt-3.5-turbo|}',
      '  temperature: ${8:0.7}',
      '  max_tokens: ${9:2048}',
      'variables:',
      '  - name: ${10:input}',
      '    description: ${11:Main input variable}',
      '    type: ${12|string,number,boolean,array|}',
      '    required: ${13|true,false|}',
      '    default: ${14}',
      '---',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert complete frontmatter with all fields',
    detail: 'Full Frontmatter Template',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },

  // Variable snippets
  {
    label: 'var',
    insertText: '{{${1:variable_name}}}',
    documentation: 'Insert template variable',
    detail: 'Template Variable {{}}',
    kind: monaco.languages.CompletionItemKind.Variable,
  },
  {
    label: 'var-default',
    insertText: '{{${1:variable_name}|${2:default_value}}}',
    documentation: 'Insert template variable with default value',
    detail: 'Variable with Default',
    kind: monaco.languages.CompletionItemKind.Variable,
  },
  {
    label: 'var-conditional',
    insertText: '{{#if ${1:variable_name}}}${2:content}{{/if}}',
    documentation: 'Insert conditional template block',
    detail: 'Conditional Block',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'var-loop',
    insertText: '{{#each ${1:items}}}\n${2:{{this}}}\n{{/each}}',
    documentation: 'Insert loop template block',
    detail: 'Loop Block',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },

  // Prompt structure snippets
  {
    label: 'section',
    insertText: ['## ${1:Section Title}', '', '${0}'].join('\n'),
    documentation: 'Insert section header',
    detail: 'Section Header',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'instruction',
    insertText: [
      '## Instructions',
      '',
      '${1:Provide clear step-by-step instructions here.}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert instructions section',
    detail: 'Instructions Section',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'context',
    insertText: [
      '## Context',
      '',
      '${1:Provide relevant background context here.}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert context section',
    detail: 'Context Section',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'example',
    insertText: [
      '## Example',
      '',
      '**Input:**',
      '```',
      '${1:example input}',
      '```',
      '',
      '**Output:**',
      '```',
      '${2:example output}',
      '```',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert input/output example',
    detail: 'Example Section',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'constraints',
    insertText: [
      '## Constraints',
      '',
      '- ${1:Constraint 1}',
      '- ${2:Constraint 2}',
      '- ${3:Constraint 3}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert constraints list',
    detail: 'Constraints Section',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'format',
    insertText: [
      '## Output Format',
      '',
      '${1|Plain text,JSON,Markdown,Code,List|}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert output format specification',
    detail: 'Output Format Section',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },

  // Code block snippets
  {
    label: 'codeblock',
    insertText: ['```${1:language}', '${2:code}', '```', '', '${0}'].join('\n'),
    documentation: 'Insert fenced code block',
    detail: 'Code Block',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'json-example',
    insertText: ['```json', '{', '  "${1:key}": "${2:value}"', '}', '```', '', '${0}'].join('\n'),
    documentation: 'Insert JSON code block',
    detail: 'JSON Block',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },

  // Markdown formatting
  {
    label: 'bold',
    insertText: '**${1:text}**',
    documentation: 'Bold text',
    detail: 'Bold',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'italic',
    insertText: '*${1:text}*',
    documentation: 'Italic text',
    detail: 'Italic',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'link',
    insertText: '[${1:text}](${2:url})',
    documentation: 'Insert link',
    detail: 'Link',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'list',
    insertText: ['- ${1:Item 1}', '- ${2:Item 2}', '- ${3:Item 3}', '', '${0}'].join('\n'),
    documentation: 'Insert bullet list',
    detail: 'Bullet List',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'numbered-list',
    insertText: [
      '1. ${1:First item}',
      '2. ${2:Second item}',
      '3. ${3:Third item}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert numbered list',
    detail: 'Numbered List',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'task-list',
    insertText: ['- [ ] ${1:Task 1}', '- [ ] ${2:Task 2}', '- [ ] ${3:Task 3}', '', '${0}'].join(
      '\n'
    ),
    documentation: 'Insert task list',
    detail: 'Task List',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'table',
    insertText: [
      '| ${1:Header 1} | ${2:Header 2} | ${3:Header 3} |',
      '|-------------|-------------|-------------|',
      '| ${4:Cell 1}   | ${5:Cell 2}   | ${6:Cell 3}   |',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert markdown table',
    detail: 'Table',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'blockquote',
    insertText: '> ${1:Quote text}',
    documentation: 'Insert blockquote',
    detail: 'Blockquote',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },

  // Prompt-specific snippets
  {
    label: 'role-system',
    insertText: [
      '## System Prompt',
      '',
      'You are ${1:an AI assistant specialized in} ${2:specific domain or task}.',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert system role definition',
    detail: 'System Role',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'role-expert',
    insertText: [
      'You are an expert ${1:profession/role} with extensive experience in ${2:domain}.',
      'Your expertise includes:',
      '- ${3:Skill 1}',
      '- ${4:Skill 2}',
      '- ${5:Skill 3}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert expert role definition',
    detail: 'Expert Role',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'chain-of-thought',
    insertText: [
      "Let's approach this step by step:",
      '',
      '1. First, ${1:analyze the input}',
      '2. Then, ${2:process the data}',
      '3. Finally, ${3:generate the output}',
      '',
      '${0}',
    ].join('\n'),
    documentation: 'Insert chain of thought structure',
    detail: 'Chain of Thought',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
];

/**
 * Custom snippets storage (user-defined)
 */
let customSnippets: Snippet[] = [];

/**
 * Add custom snippet
 */
export function addCustomSnippet(snippet: Snippet): void {
  customSnippets.push(snippet);
}

/**
 * Remove custom snippet by label
 */
export function removeCustomSnippet(label: string): void {
  customSnippets = customSnippets.filter((s) => s.label !== label);
}

/**
 * Get all available snippets
 */
export function getAllSnippets(): Snippet[] {
  return [...builtInSnippets, ...customSnippets];
}

/**
 * Set custom snippets (replaces all custom snippets)
 */
export function setCustomSnippets(snippets: Snippet[]): void {
  customSnippets = snippets;
}

/**
 * Create completion item from snippet
 */
function createCompletionItem(
  snippet: Snippet,
  range: monaco.IRange
): monaco.languages.CompletionItem {
  return {
    label: snippet.label,
    kind: snippet.kind ?? monaco.languages.CompletionItemKind.Snippet,
    documentation: snippet.documentation,
    detail: snippet.detail,
    insertText: snippet.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range,
  };
}

/**
 * Register snippet completion provider for markdown
 */
export function registerSnippetProvider(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['/', '{', '#'],

    provideCompletionItems(
      model: monaco.editor.ITextModel,
      position: monaco.Position
    ): monaco.languages.ProviderResult<monaco.languages.CompletionList> {
      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Get line content
      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.substring(0, position.column - 1);

      // Check for trigger contexts
      const isAtLineStart = textBefore.trim() === '';
      const isAfterSlash = textBefore.endsWith('/');
      const isInFrontmatter = checkIfInFrontmatter(model, position);
      const isAfterDoubleBrace = textBefore.endsWith('{{');

      // Filter snippets based on context
      const allSnippets = getAllSnippets();
      let filteredSnippets: Snippet[] = allSnippets;

      if (isAfterSlash) {
        // Show all snippets when using / trigger
        filteredSnippets = allSnippets;
      } else if (isAfterDoubleBrace) {
        // Show only variable snippets after {{
        filteredSnippets = allSnippets.filter(
          (s) => s.kind === monaco.languages.CompletionItemKind.Variable
        );
      } else if (isInFrontmatter) {
        // Limit snippets in frontmatter
        filteredSnippets = allSnippets.filter((s) => s.label.startsWith('fm-'));
      } else if (isAtLineStart) {
        // Show structure snippets at line start
        filteredSnippets = allSnippets.filter(
          (s) =>
            s.label.startsWith('section') ||
            s.label.startsWith('instruction') ||
            s.label.startsWith('context') ||
            s.label.startsWith('example') ||
            s.label.startsWith('constraint') ||
            s.label.startsWith('format') ||
            s.label.startsWith('role') ||
            s.label === 'frontmatter' ||
            s.label === 'codeblock' ||
            s.label === 'list' ||
            s.label === 'table'
        );
      }

      const suggestions = filteredSnippets.map((snippet) => createCompletionItem(snippet, range));

      return { suggestions };
    },
  });
}

/**
 * Trigger character to snippet type mapping
 */
const TRIGGER_TYPE_MAP: Record<string, string> = {
  '@': 'persona',
  '#': 'text',
  $: 'code',
  '!': 'template',
};

/**
 * Get the trigger prefix for a snippet type
 */
export function getTriggerForType(type: string): string {
  const entry = Object.entries(TRIGGER_TYPE_MAP).find(([, t]) => t === type);
  return entry?.[0] ?? '@';
}

/**
 * Create completion item from user snippet
 */
function createUserSnippetCompletionItem(
  snippet: ISnippetFile,
  range: monaco.IRange,
  replaceTrigger: boolean = false
): monaco.languages.CompletionItem {
  // Determine the kind based on snippet type
  let kind: monaco.languages.CompletionItemKind;
  switch (snippet.metadata.type) {
    case 'persona':
      kind = monaco.languages.CompletionItemKind.User;
      break;
    case 'code':
      kind = monaco.languages.CompletionItemKind.Function;
      break;
    case 'template':
      kind = monaco.languages.CompletionItemKind.File;
      break;
    default:
      kind = monaco.languages.CompletionItemKind.Text;
  }

  // Build documentation
  const docParts: string[] = [];
  if (snippet.metadata.description) {
    docParts.push(snippet.metadata.description);
  }
  if (snippet.metadata.tags.length > 0) {
    docParts.push(`Tags: ${snippet.metadata.tags.join(', ')}`);
  }
  docParts.push(`Shortcut: ${snippet.metadata.shortcut}`);

  // For the insert text, we expand the snippet content
  const insertText = snippet.content;

  return {
    label: snippet.metadata.shortcut,
    kind,
    documentation: {
      value: docParts.join('\n\n'),
    },
    detail: `${snippet.metadata.type}: ${snippet.metadata.name}`,
    insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range: replaceTrigger
      ? {
          ...range,
          startColumn: range.startColumn - 1, // Include the trigger character
        }
      : range,
    sortText: `0${snippet.metadata.shortcut}`, // Prioritize user snippets
  };
}

/**
 * Register user snippets completion provider with trigger characters
 */
export function registerUserSnippetsProvider(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['@', '#', '$', '!'],

    async provideCompletionItems(
      model: monaco.editor.ITextModel,
      position: monaco.Position
    ): Promise<monaco.languages.CompletionList> {
      // Get line content and text before cursor
      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.substring(0, position.column - 1);

      // Check if we're in frontmatter - don't show user snippets there
      if (checkIfInFrontmatter(model, position)) {
        return { suggestions: [] };
      }

      // Find the trigger character and text after it
      const triggerMatch = textBefore.match(/[@#$!]([a-zA-Z0-9_-]*)$/);
      if (!triggerMatch) {
        return { suggestions: [] };
      }

      const triggerChar = textBefore.charAt(textBefore.length - triggerMatch[0].length);
      const searchText = triggerMatch[1].toLowerCase();

      // Get user snippets
      const userSnippets = getUserSnippets();

      // Filter snippets by type and search text
      // '@' shows ALL snippets, other triggers are type-specific
      let filteredSnippets = userSnippets;
      if (triggerChar !== '@') {
        const snippetType = TRIGGER_TYPE_MAP[triggerChar];
        if (snippetType !== undefined) {
          filteredSnippets = userSnippets.filter((s) => s.metadata.type === snippetType);
        }
      }

      if (searchText !== '') {
        filteredSnippets = filteredSnippets.filter(
          (s) =>
            s.metadata.shortcut.toLowerCase().includes(searchText) ||
            s.metadata.name.toLowerCase().includes(searchText)
        );
      }

      // Calculate range - include the trigger character and any text after it
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - triggerMatch[0].length,
        endColumn: position.column,
      };

      // Create completion items for snippets
      const suggestions: monaco.languages.CompletionItem[] = filteredSnippets.map((snippet) =>
        createUserSnippetCompletionItem(snippet, range, false)
      );

      // Add file suggestions when triggered by @
      if (triggerChar === '@') {
        try {
          const fileSyncStore = useFileSyncStore();

          // Only if initialized
          if (fileSyncStore.isInitialized) {
            const query = searchText;
            const files = await fileSyncStore.searchFiles(query);

            // Add file suggestions with sortText that puts them after snippets
            for (const file of files) {
              suggestions.push({
                label: {
                  label: file.fileName,
                  description: 'File',
                  detail: file.relativePath,
                },
                kind: monaco.languages.CompletionItemKind.File,
                insertText: file.fullPath,
                detail: file.relativePath,
                documentation: {
                  value: `**Insert file path:**\n\`${file.fullPath}\``,
                },
                range,
                // sortText starting with '2' puts files after snippets (which start with '0' or '1')
                sortText: `2_${file.normalizedName}`,
                filterText: `@${file.normalizedName}`,
              });
            }
          }
        } catch (err) {
          // Silently fail - file suggestions are optional enhancement
          console.warn('Failed to get file suggestions:', err);
        }
      }

      return { suggestions };
    },
  });
}

/**
 * Check if cursor is inside YAML frontmatter
 */
function checkIfInFrontmatter(model: monaco.editor.ITextModel, position: monaco.Position): boolean {
  let frontmatterStart = false;
  let frontmatterEnd = false;

  for (let i = 1; i <= position.lineNumber; i++) {
    const line = model.getLineContent(i);
    if (line.match(/^---\s*$/)) {
      if (!frontmatterStart) {
        frontmatterStart = true;
      } else {
        frontmatterEnd = true;
        break;
      }
    }
  }

  return frontmatterStart && !frontmatterEnd;
}

/**
 * Initialize the snippet provider
 */
export function initializeSnippetProvider(): monaco.IDisposable {
  const builtInDisposable = registerSnippetProvider();
  const userDisposable = registerUserSnippetsProvider();

  // Return a combined disposable
  return {
    dispose: () => {
      builtInDisposable.dispose();
      userDisposable.dispose();
    },
  };
}
