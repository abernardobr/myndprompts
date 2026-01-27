<script setup lang="ts">
/**
 * ChatArtifactRenderer Component
 *
 * Renders message content by detecting the type (markdown, code blocks,
 * SVG, HTML, mermaid) and applying appropriate rendering. Uses `marked`
 * for markdown and `highlight.js` for syntax highlighting.
 */

import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import hljs from 'highlight.js';

const props = defineProps<{
  content: string;
}>();
const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();

// Configure marked with highlight.js
marked.setOptions({
  breaks: true,
  gfm: true,
});

type ContentType = 'svg' | 'html' | 'markdown';

const contentType = computed<ContentType>(() => {
  const trimmed = props.content.trim();
  if (trimmed.startsWith('<svg')) return 'svg';
  if (trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE')) return 'html';
  return 'markdown';
});

const renderedMarkdown = computed(() => {
  if (contentType.value !== 'markdown') return '';

  // Custom renderer for code blocks with highlight.js
  const renderer = new marked.Renderer();

  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : undefined;
    const highlighted = language
      ? hljs.highlight(text, { language }).value
      : hljs.highlightAuto(text).value;

    const langLabel = language ?? 'code';
    const escapedText = text.replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    return `<div class="chat-artifact__code-block">
      <div class="chat-artifact__code-header">
        <span class="chat-artifact__code-lang">${langLabel}</span>
        <button class="chat-artifact__copy-btn" data-copy-text="${escapedText}" onclick="this.dispatchEvent(new CustomEvent('copy-code', { bubbles: true, detail: this.dataset.copyText }))">
          <span class="chat-artifact__copy-label">Copy</span>
        </button>
      </div>
      <pre class="chat-artifact__code"><code class="hljs">${highlighted}</code></pre>
    </div>`;
  };

  const raw = marked.parse(props.content, { renderer }) as string;
  return raw;
});

const htmlSrcDoc = computed(() => {
  if (contentType.value !== 'html') return '';
  return props.content;
});

function onContentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const copyBtn = target.closest('.chat-artifact__copy-btn');
  if (copyBtn) {
    const text = (copyBtn as HTMLElement).dataset['copyText'] ?? '';
    void navigator.clipboard.writeText(text).then(() => {
      $q.notify({ type: 'positive', message: t('chat.copied'), timeout: 1500 });
    });
  }
}
</script>

<template>
  <div
    class="chat-artifact"
    @click="onContentClick"
  >
    <!-- SVG content -->
    <div
      v-if="contentType === 'svg'"
      class="chat-artifact__svg"
      v-html="props.content"
    />

    <!-- HTML content (sandboxed iframe) -->
    <iframe
      v-else-if="contentType === 'html'"
      class="chat-artifact__iframe"
      :srcdoc="htmlSrcDoc"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
    />

    <!-- Markdown content (default) -->
    <div
      v-else
      class="chat-artifact__markdown"
      v-html="renderedMarkdown"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/markdown-body' as md;

.chat-artifact {
  line-height: 1.6;
  word-break: break-word;

  &__svg {
    display: flex;
    justify-content: center;
    padding: 8px;

    :deep(svg) {
      max-width: 100%;
      height: auto;
    }
  }

  &__iframe {
    width: 100%;
    min-height: 200px;
    border: 1px solid var(--md-border-color, #3c3c3c);
    border-radius: 6px;
    background: #ffffff;
  }

  &__markdown {
    @include md.markdown-body-styles;

    // Chat-specific: code blocks with header + copy button
    :deep(.chat-artifact__code-block) {
      margin: 8px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--md-border-color, #3c3c3c);
    }

    :deep(.chat-artifact__code-header) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      background-color: var(--chat-code-header-bg, #1e1e2e);
      font-size: 12px;
    }

    :deep(.chat-artifact__code-lang) {
      color: var(--md-muted-color, #888888);
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 600;
    }

    :deep(.chat-artifact__copy-btn) {
      display: flex;
      align-items: center;
      gap: 4px;
      border: none;
      background: none;
      color: var(--md-muted-color, #888888);
      cursor: pointer;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 4px;

      &:hover {
        background-color: var(--chat-copy-hover-bg, rgba(255, 255, 255, 0.1));
        color: var(--chat-copy-hover-color, #cccccc);
      }
    }

    :deep(.chat-artifact__code) {
      margin: 0;
      padding: 12px 16px;
      overflow-x: auto;
      background-color: var(--md-code-block-bg, #1a1a2e);
      font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.5;
      border: none;
      border-radius: 0;

      code {
        background: none;
        padding: 0;
      }
    }
  }
}

// Light theme
.body--light .chat-artifact {
  @include md.markdown-body-light-vars;
  --chat-code-header-bg: #f0f0f0;
  --chat-copy-hover-bg: rgba(0, 0, 0, 0.06);
  --chat-copy-hover-color: #333333;
}

// Dark theme
.body--dark .chat-artifact {
  @include md.markdown-body-dark-vars;
  --chat-code-header-bg: #1e1e2e;
  --chat-copy-hover-bg: rgba(255, 255, 255, 0.1);
  --chat-copy-hover-color: #cccccc;
}
</style>
