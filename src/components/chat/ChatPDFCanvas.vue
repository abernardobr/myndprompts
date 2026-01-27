<script setup lang="ts">
/**
 * ChatPDFCanvas Component
 *
 * Side panel PDF viewer for the chat feature. Renders PDF documents
 * using pdfjs-dist on an HTML5 canvas. Provides page navigation
 * (prev/next/input), zoom controls (+/-/fit-width), and a close button.
 */

import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

const props = defineProps<{
  filePath: string;
  documentName?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const { t } = useI18n({ useScope: 'global' });

// State
const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const currentPage = ref(1);
const totalPages = ref(0);
const scale = ref(1.0);
const isLoading = ref(false);
const errorMessage = ref('');
const pageInput = ref('1');

let pdfDoc: PDFDocumentProxy | null = null;
let currentRenderTask: { cancel: () => void } | null = null;

const displayName = computed(() => {
  if (props.documentName) return props.documentName;
  const parts = props.filePath.split('/');
  return parts[parts.length - 1] ?? 'Document';
});

const canGoPrev = computed(() => currentPage.value > 1);
const canGoNext = computed(() => currentPage.value < totalPages.value);

// Load PDF from file path
async function loadPDF(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const dataUrl = await window.fileSystemAPI.readFileAsDataUrl(props.filePath, 'application/pdf');
    // Convert data URL to Uint8Array
    const base64 = dataUrl.split(',')[1];
    if (!base64) throw new Error('Invalid data URL');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    totalPages.value = pdfDoc.numPages;
    currentPage.value = 1;
    pageInput.value = '1';

    await nextTick();
    await renderPage();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to load PDF';
    console.error('[ChatPDFCanvas] Load error:', err);
  } finally {
    isLoading.value = false;
  }
}

async function renderPage(): Promise<void> {
  if (!pdfDoc || !canvasRef.value) return;

  // Cancel any in-progress render
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }

  try {
    const page: PDFPageProxy = await pdfDoc.getPage(currentPage.value);
    const viewport = page.getViewport({ scale: scale.value });

    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions for crisp rendering (account for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.scale(dpr, dpr);

    const renderTask = page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    });
    currentRenderTask = renderTask;

    await renderTask.promise;
    currentRenderTask = null;
  } catch (err) {
    // Ignore cancellation errors
    if (err instanceof Error && err.message.includes('cancelled')) return;
    console.error('[ChatPDFCanvas] Render error:', err);
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    pageInput.value = String(currentPage.value);
    void renderPage();
  }
}

function prevPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--;
    pageInput.value = String(currentPage.value);
    void renderPage();
  }
}

function goToPage(): void {
  const num = parseInt(pageInput.value, 10);
  if (isNaN(num) || num < 1 || num > totalPages.value) {
    pageInput.value = String(currentPage.value);
    return;
  }
  currentPage.value = num;
  void renderPage();
}

function zoomIn(): void {
  scale.value = Math.min(scale.value + 0.25, 4.0);
  void renderPage();
}

function zoomOut(): void {
  scale.value = Math.max(scale.value - 0.25, 0.25);
  void renderPage();
}

function fitWidth(): void {
  if (!pdfDoc || !containerRef.value) return;
  void (async () => {
    const page = await pdfDoc.getPage(currentPage.value);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const container = containerRef.value;
    if (!container) return;
    const containerWidth = container.clientWidth - 32; // account for padding
    scale.value = containerWidth / unscaledViewport.width;
    void renderPage();
  })();
}

function zoomPercentage(): string {
  return `${Math.round(scale.value * 100)}%`;
}

// Watch for file path changes
watch(
  () => props.filePath,
  () => {
    void loadPDF();
  }
);

onMounted(() => {
  void loadPDF();
});

onUnmounted(() => {
  if (currentRenderTask) {
    currentRenderTask.cancel();
  }
  if (pdfDoc) {
    void pdfDoc.destroy();
    pdfDoc = null;
  }
});
</script>

<template>
  <div class="chat-pdf-canvas">
    <!-- Header -->
    <div class="chat-pdf-canvas__header">
      <div class="chat-pdf-canvas__title-row">
        <q-icon
          name="picture_as_pdf"
          size="18px"
          class="chat-pdf-canvas__icon"
        />
        <span
          class="chat-pdf-canvas__name"
          :title="displayName"
        >
          {{ displayName }}
        </span>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="close"
          class="chat-pdf-canvas__close-btn"
          @click="emit('close')"
        />
      </div>

      <!-- Controls -->
      <div
        v-if="totalPages > 0"
        class="chat-pdf-canvas__controls"
      >
        <!-- Page navigation -->
        <div class="chat-pdf-canvas__nav">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="chevron_left"
            :disable="!canGoPrev"
            @click="prevPage"
          />
          <q-input
            v-model="pageInput"
            dense
            outlined
            class="chat-pdf-canvas__page-input"
            @keydown.enter="goToPage"
            @blur="goToPage"
          />
          <span class="chat-pdf-canvas__page-total">/ {{ totalPages }}</span>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="chevron_right"
            :disable="!canGoNext"
            @click="nextPage"
          />
        </div>

        <!-- Zoom controls -->
        <div class="chat-pdf-canvas__zoom">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="remove"
            @click="zoomOut"
          />
          <span class="chat-pdf-canvas__zoom-label">{{ zoomPercentage() }}</span>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="add"
            @click="zoomIn"
          />
          <q-btn
            flat
            dense
            size="sm"
            icon="fit_screen"
            :title="t('chat.pdf.fitWidth')"
            @click="fitWidth"
          />
        </div>
      </div>
    </div>

    <!-- Canvas area -->
    <div
      ref="containerRef"
      class="chat-pdf-canvas__viewport"
    >
      <!-- Loading -->
      <div
        v-if="isLoading"
        class="chat-pdf-canvas__loading"
      >
        <q-spinner size="32px" />
        <span>{{ t('chat.pdf.loading') }}</span>
      </div>

      <!-- Error -->
      <div
        v-else-if="errorMessage"
        class="chat-pdf-canvas__error"
      >
        <q-icon
          name="error_outline"
          size="32px"
          color="negative"
        />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- PDF page -->
      <canvas
        v-show="!isLoading && !errorMessage"
        ref="canvasRef"
        class="chat-pdf-canvas__canvas"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-pdf-canvas {
  display: flex;
  flex-direction: column;
  width: 40%;
  min-width: 280px;
  max-width: 600px;
  border-left: 1px solid var(--border-color, #3c3c3c);
  background-color: var(--panel-bg, #1e1e1e);
  flex-shrink: 0;

  @media (max-width: 768px) {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    z-index: 10;
  }

  &__header {
    flex-shrink: 0;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  &__icon {
    color: var(--icon-color, #cc4444);
    flex-shrink: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 500;
    color: var(--title-color, #cccccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  &__close-btn {
    color: var(--close-color, #888888);
    flex-shrink: 0;
  }

  &__controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__page-input {
    width: 44px;

    :deep(.q-field__control) {
      min-height: 28px;
      height: 28px;
    }

    :deep(input) {
      text-align: center;
      font-size: 12px;
      padding: 0 4px;
    }
  }

  &__page-total {
    font-size: 12px;
    color: var(--page-color, #999999);
  }

  &__zoom {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__zoom-label {
    font-size: 12px;
    color: var(--zoom-color, #999999);
    min-width: 40px;
    text-align: center;
  }

  &__viewport {
    flex: 1;
    overflow: auto;
    display: flex;
    justify-content: center;
    padding: 16px;
    min-height: 0;
  }

  &__canvas {
    display: block;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  &__loading,
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    font-size: 13px;
    color: var(--msg-color, #999999);
  }
}

.body--light .chat-pdf-canvas {
  --border-color: #d4d4d4;
  --panel-bg: #f8f8f8;
  --icon-color: #cc4444;
  --title-color: #333333;
  --close-color: #666666;
  --page-color: #666666;
  --zoom-color: #666666;
  --msg-color: #666666;
}

.body--dark .chat-pdf-canvas {
  --border-color: #3c3c3c;
  --panel-bg: #1e1e1e;
  --icon-color: #cc4444;
  --title-color: #cccccc;
  --close-color: #888888;
  --page-color: #999999;
  --zoom-color: #999999;
  --msg-color: #999999;
}
</style>
