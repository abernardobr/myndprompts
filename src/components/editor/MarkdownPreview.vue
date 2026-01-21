<script setup lang="ts">
/**
 * MarkdownPreview Component
 *
 * Renders markdown content with support for:
 * - Full markdown syntax (headings, lists, code blocks, etc.)
 * - Local and remote images
 * - Syntax highlighting for code blocks
 * - Interactive task list checkboxes
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';

interface Props {
  content: string;
  filePath: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:content', value: string): void;
}>();

// Rendered HTML content
const renderedContent = ref('');

// Reference to the preview container for event delegation
const previewRef = ref<HTMLElement | null>(null);

// Track checkbox positions in the original markdown
let checkboxPositions: number[] = [];

// Image cache to avoid re-fetching
const imageCache = new Map<string, string>();

// Get the directory of the current file for resolving relative paths
const fileDirectory = computed(() => {
  const lastSlash = props.filePath.lastIndexOf('/');
  return lastSlash > 0 ? props.filePath.substring(0, lastSlash) : '';
});

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Custom renderer to handle images
const renderer = new marked.Renderer();

// Override image rendering to handle local paths
renderer.image = function (token: { href: string; title: string | null; text: string }) {
  const { href, title, text } = token;

  // Create a placeholder that will be replaced with actual image
  const placeholder = `__IMAGE_PLACEHOLDER_${btoa(href)}__`;

  // Return placeholder HTML that will be processed later
  const altText = text ?? '';
  const titleText = title ?? '';
  return `<img data-src="${href}" alt="${altText}" title="${titleText}" class="markdown-image markdown-image--loading" data-placeholder="${placeholder}" />`;
};

// Override list item rendering to handle task list checkboxes
renderer.listitem = function (token: { text: string; task: boolean; checked?: boolean }) {
  const { text, task, checked } = token;

  if (task) {
    // This is a task list item - render with interactive checkbox
    // Use a placeholder that will be replaced with proper index
    const isChecked = checked === true;
    const checkboxHtml = `<input type="checkbox" class="markdown-checkbox" data-checkbox-index="__CHECKBOX_INDEX__" ${isChecked ? 'checked' : ''} />`;
    // Remove the default checkbox that marked adds ([ ] or [x])
    const cleanText = text.replace(/^<input[^>]*>\s*/, '');
    return `<li class="task-list-item">${checkboxHtml}<span class="task-list-item__text">${cleanText}</span></li>\n`;
  }

  return `<li>${text}</li>\n`;
};

// Process images in the rendered HTML
async function processImages(html: string): Promise<string> {
  const imgRegex = /<img\s+data-src="([^"]+)"/g;
  const matches = [...html.matchAll(imgRegex)];

  for (const match of matches) {
    const originalSrc = match[1];
    let finalSrc = originalSrc;

    // Check if it's a local path (not http/https/data)
    if (
      !originalSrc.startsWith('http://') &&
      !originalSrc.startsWith('https://') &&
      !originalSrc.startsWith('data:')
    ) {
      // Check cache first
      const cachedSrc = imageCache.get(originalSrc);
      if (cachedSrc !== undefined) {
        finalSrc = cachedSrc;
      } else {
        try {
          // Remove angle brackets if present (from markdown <path> syntax)
          let cleanSrc = originalSrc;
          if (cleanSrc.startsWith('<') && cleanSrc.endsWith('>')) {
            cleanSrc = cleanSrc.slice(1, -1);
          }

          // Decode URL-encoded path (handles spaces, parentheses, etc.)
          const decodedSrc = decodeURIComponent(cleanSrc);

          // Resolve relative path
          let imagePath = decodedSrc;
          if (!decodedSrc.startsWith('/')) {
            // Relative path - resolve from file directory
            imagePath = await window.fileSystemAPI.joinPath(fileDirectory.value, decodedSrc);
          }

          // Check if file exists
          const exists = await window.fileSystemAPI.fileExists(imagePath);
          if (exists) {
            const mimeType = getMimeType(imagePath);

            // Read as data URL
            finalSrc = await window.fileSystemAPI.readFileAsDataUrl(imagePath, mimeType);
            imageCache.set(originalSrc, finalSrc);
          } else {
            console.warn(`Image not found: ${imagePath}`);
          }
        } catch (error) {
          console.error(`Failed to load image: ${originalSrc}`, error);
        }
      }
    }

    // Replace data-src with src and remove loading class
    html = html.replace(`data-src="${originalSrc}"`, `src="${finalSrc}"`);
  }

  // Remove loading class from all images
  html = html.replace(/markdown-image--loading/g, 'markdown-image--loaded');

  return html;
}

// Find all checkbox positions in the original markdown content
function findCheckboxPositions(content: string): number[] {
  const positions: number[] = [];
  const regex = /\[[ xX]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const beforeMatch = content.substring(Math.max(0, match.index - 10), match.index);
    // Check if this is a task list checkbox:
    // 1. Preceded by list marker (- or *) and space
    // 2. At the start of a line (possibly with leading whitespace)
    const isListItem = /[-*]\s*$/.test(beforeMatch);
    const isLineStart = /(?:^|\n)\s*$/.test(beforeMatch);

    if (isListItem || isLineStart) {
      positions.push(match.index);
    }
  }

  return positions;
}

// Process checkbox placeholders with actual indices
function processCheckboxes(html: string): string {
  let index = 0;
  return html.replace(/__CHECKBOX_INDEX__/g, () => String(index++));
}

// Handle checkbox click
function handleCheckboxClick(event: Event): void {
  const target = event.target as HTMLInputElement;

  if (!target.classList.contains('markdown-checkbox')) {
    return;
  }

  const indexStr = target.getAttribute('data-checkbox-index');
  if (indexStr === null) return;

  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 0 || index >= checkboxPositions.length) return;

  const position = checkboxPositions[index];
  const content = props.content;

  // Find the checkbox in the content and toggle it
  const before = content.substring(0, position);
  const checkbox = content.substring(position, position + 3);
  const after = content.substring(position + 3);

  let newCheckbox: string;
  if (checkbox === '[ ]') {
    newCheckbox = '[x]';
  } else if (checkbox.toLowerCase() === '[x]') {
    newCheckbox = '[ ]';
  } else {
    return; // Not a valid checkbox
  }

  const newContent = before + newCheckbox + after;
  emit('update:content', newContent);
}

// Get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() ?? '';
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
  };
  return mimeTypes[ext] ?? 'image/png';
}

// Pre-process image paths with special characters (spaces, parentheses, etc.)
// Converts ![alt](path with spaces.png) to ![alt](<path with spaces.png>)
// Uses angle bracket syntax which allows any characters in the URL
function preprocessImagePaths(content: string): string {
  // Process line by line to handle image patterns
  const lines = content.split('\n');
  const processedLines = lines.map((line) => {
    // Find all image patterns in the line
    let result = '';
    let i = 0;

    while (i < line.length) {
      // Look for image start: ![
      if (line[i] === '!' && line[i + 1] === '[') {
        const imgStart = i;

        // Find the closing ] for alt text
        let j = i + 2;
        let bracketDepth = 1;
        while (j < line.length && bracketDepth > 0) {
          if (line[j] === '[') bracketDepth++;
          else if (line[j] === ']') bracketDepth--;
          j++;
        }

        if (bracketDepth === 0 && line[j] === '(') {
          // Found ![alt]( - now find the matching )
          const altText = line.substring(imgStart + 2, j - 1);
          const urlStart = j + 1;

          // Find the closing ) by tracking parenthesis depth
          let k = urlStart;
          let parenDepth = 1;
          while (k < line.length && parenDepth > 0) {
            if (line[k] === '(') parenDepth++;
            else if (line[k] === ')') parenDepth--;
            k++;
          }

          if (parenDepth === 0) {
            // Found complete image syntax
            const url = line.substring(urlStart, k - 1);

            // Check if URL needs encoding
            const isRemote =
              url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
            const isAlreadyBracketed = url.startsWith('<') && url.endsWith('>');
            const hasSpecialChars = /[\s()]/.test(url);

            if (!isRemote && !isAlreadyBracketed && hasSpecialChars) {
              // Use angle bracket syntax to handle special characters
              result += `![${altText}](<${url}>)`;
            } else {
              result += line.substring(imgStart, k);
            }

            i = k;
            continue;
          }
        }
      }

      result += line[i];
      i++;
    }

    return result;
  });

  return processedLines.join('\n');
}

// Pre-process content to convert standalone checkboxes to task list items
// Lines starting with [ ] or [x] (without list marker) become - [ ] or - [x]
function preprocessContent(content: string): string {
  // First, fix image paths with special characters
  const processed = preprocessImagePaths(content);

  const lines = processed.split('\n');
  const processedLines = lines.map((line) => {
    // Check if line starts with [ ] or [x] or [X] (with optional leading whitespace)
    const match = line.match(/^(\s*)\[([xX ])\]\s/);
    if (match) {
      const indent = match[1];
      const checkState = match[2];
      const rest = line.substring(match[0].length);
      return `${indent}- [${checkState}] ${rest}`;
    }
    return line;
  });
  return processedLines.join('\n');
}

// Render markdown content
async function renderMarkdown(): Promise<void> {
  if (!props.content) {
    renderedContent.value = '';
    checkboxPositions = [];
    return;
  }

  try {
    // Find checkbox positions before rendering (in original content)
    checkboxPositions = findCheckboxPositions(props.content);

    // Pre-process content to handle standalone checkboxes
    const processedContent = preprocessContent(props.content);

    // Parse markdown with custom renderer
    let html = await marked.parse(processedContent, { renderer });

    // Process checkbox placeholders with actual indices
    html = processCheckboxes(html);

    // Process images (load local images)
    html = await processImages(html);

    renderedContent.value = html;
  } catch (error) {
    console.error('Failed to render markdown:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderedContent.value = `<p class="text-negative">Failed to render markdown: ${errorMessage}</p>`;
  }
}

// Watch for content changes
watch(
  () => props.content,
  () => {
    void renderMarkdown();
  },
  { immediate: true }
);

// Also re-render when file path changes (different file might have different relative paths)
watch(
  () => props.filePath,
  () => {
    imageCache.clear();
    void renderMarkdown();
  }
);

// Setup click event listener for checkboxes
onMounted(() => {
  previewRef.value?.addEventListener('click', handleCheckboxClick);
});

onUnmounted(() => {
  previewRef.value?.removeEventListener('click', handleCheckboxClick);
});
</script>

<template>
  <div
    ref="previewRef"
    class="markdown-preview"
  >
    <div
      class="markdown-preview__content markdown-body"
      v-html="renderedContent"
    />
  </div>
</template>

<style lang="scss" scoped>
.markdown-preview {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  background-color: var(--preview-bg, #1e1e1e);

  &__content {
    max-width: 900px;
    margin: 0 auto;
  }
}

// Markdown body styles
.markdown-body {
  color: var(--text-color, #d4d4d4);
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;

  // Headings
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--heading-color, #ffffff);
  }

  h1 {
    font-size: 2em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  h2 {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  h3 {
    font-size: 1.25em;
  }
  h4 {
    font-size: 1em;
  }
  h5 {
    font-size: 0.875em;
  }
  h6 {
    font-size: 0.85em;
    color: var(--muted-color, #858585);
  }

  // Paragraphs
  p {
    margin-top: 0;
    margin-bottom: 16px;
  }

  // Links
  a {
    color: var(--link-color, #4fc3f7);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  // Lists
  ul,
  ol {
    margin-top: 0;
    margin-bottom: 16px;
    padding-left: 2em;
  }

  li {
    margin-bottom: 4px;
  }

  li + li {
    margin-top: 4px;
  }

  // Code
  code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: var(--code-bg, #2d2d2d);
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  }

  pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: var(--code-block-bg, #1e1e1e);
    border-radius: 6px;
    border: 1px solid var(--border-color, #3c3c3c);

    code {
      padding: 0;
      background-color: transparent;
      border-radius: 0;
      font-size: 100%;
    }
  }

  // Blockquotes
  blockquote {
    margin: 0 0 16px 0;
    padding: 0 1em;
    color: var(--muted-color, #858585);
    border-left: 4px solid var(--border-color, #3c3c3c);
  }

  // Horizontal rule
  hr {
    height: 1px;
    margin: 24px 0;
    background-color: var(--border-color, #3c3c3c);
    border: none;
  }

  // Tables
  table {
    display: block;
    width: 100%;
    overflow: auto;
    margin-bottom: 16px;
    border-collapse: collapse;

    th,
    td {
      padding: 8px 16px;
      border: 1px solid var(--border-color, #3c3c3c);
    }

    th {
      font-weight: 600;
      background-color: var(--table-header-bg, #2d2d2d);
    }

    tr:nth-child(even) {
      background-color: var(--table-row-bg, #252526);
    }
  }

  // Images
  :deep(.markdown-image) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 8px 0;
  }

  :deep(.markdown-image--loading) {
    min-height: 100px;
    background-color: var(--image-loading-bg, #2d2d2d);
  }

  :deep(.markdown-image--loaded) {
    animation: fadeIn 0.3s ease;
  }

  // Task lists
  :deep(.task-list-item) {
    list-style-type: none;
    margin-left: -1.5em;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding-left: 0;
    margin-bottom: 8px;
  }

  :deep(.task-list-item__text) {
    flex: 1;
    line-height: 1.5;
    padding-top: 1px;
  }

  :deep(.markdown-checkbox) {
    cursor: pointer;
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    margin-top: 2px;
    accent-color: var(--checkbox-color, #4fc3f7);
    flex-shrink: 0;
  }

  :deep(.markdown-checkbox:hover) {
    transform: scale(1.1);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// Light theme
.body--light .markdown-preview {
  --preview-bg: #ffffff;
  --text-color: #24292e;
  --heading-color: #24292e;
  --border-color: #e1e4e8;
  --muted-color: #6a737d;
  --link-color: #0366d6;
  --code-bg: #f6f8fa;
  --code-block-bg: #f6f8fa;
  --table-header-bg: #f6f8fa;
  --table-row-bg: #fafbfc;
  --image-loading-bg: #f6f8fa;
}

// Dark theme
.body--dark .markdown-preview {
  --preview-bg: #1e1e1e;
  --text-color: #d4d4d4;
  --heading-color: #ffffff;
  --border-color: #3c3c3c;
  --muted-color: #858585;
  --link-color: #4fc3f7;
  --code-bg: #2d2d2d;
  --code-block-bg: #1e1e1e;
  --table-header-bg: #2d2d2d;
  --table-row-bg: #252526;
  --image-loading-bg: #2d2d2d;
}
</style>
