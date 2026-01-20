<template>
  <div class="file-viewer">
    <component
      :is="viewerComponent"
      v-if="viewerComponent"
      :file-path="filePath"
      :file-name="fileName"
      :mime-type="mimeType"
    />
    <div
      v-else
      class="file-viewer__unsupported"
    >
      <q-icon
        name="error_outline"
        size="64px"
        color="grey-6"
      />
      <p class="file-viewer__unsupported-text">Unable to display this file type</p>
      <p class="file-viewer__unsupported-filename">{{ fileName }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue';
import { FileCategory } from '@services/file-system/file-types';

/**
 * FileViewer - Router component that renders the appropriate viewer
 * based on the file's category.
 */

interface Props {
  /** Full path to the file */
  filePath: string;
  /** Display name of the file */
  fileName: string;
  /** Category of the file (determines which viewer to use) */
  fileCategory: FileCategory;
  /** Optional MIME type for media files */
  mimeType?: string;
}

const props = defineProps<Props>();

/**
 * Lazy-loaded viewer components
 * Using defineAsyncComponent for code splitting
 */
const ImageViewer = defineAsyncComponent(() => import('@/components/viewers/ImageViewer.vue'));

const VideoPlayer = defineAsyncComponent(() => import('@/components/viewers/VideoPlayer.vue'));

const AudioPlayer = defineAsyncComponent(() => import('@/components/viewers/AudioPlayer.vue'));

const DocumentViewer = defineAsyncComponent(
  () => import('@/components/viewers/DocumentViewer.vue')
);

const SpreadsheetViewer = defineAsyncComponent(
  () => import('@/components/viewers/SpreadsheetViewer.vue')
);

const FallbackViewer = defineAsyncComponent(
  () => import('@/components/viewers/FallbackViewer.vue')
);

/**
 * Maps FileCategory to the appropriate viewer component
 * MARKDOWN returns null because it uses MonacoEditor in EditorPane
 */
const categoryComponentMap: Record<FileCategory, Component | null> = {
  [FileCategory.MARKDOWN]: null,
  [FileCategory.CODE]: null, // CODE files use MonacoEditor in EditorPane
  [FileCategory.IMAGE]: ImageViewer,
  [FileCategory.VIDEO]: VideoPlayer,
  [FileCategory.AUDIO]: AudioPlayer,
  [FileCategory.DOCUMENT]: DocumentViewer,
  [FileCategory.SPREADSHEET]: SpreadsheetViewer,
  [FileCategory.UNKNOWN]: FallbackViewer,
};

/**
 * The viewer component to render based on fileCategory
 */
const viewerComponent = computed<Component | null>(() => {
  return categoryComponentMap[props.fileCategory] ?? FallbackViewer;
});
</script>

<style lang="scss" scoped>
.file-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--q-dark-page, #121212);

  .body--light & {
    background-color: var(--q-light-page, #f5f5f5);
  }
}

.file-viewer__unsupported {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
}

.file-viewer__unsupported-text {
  margin: 0;
  font-size: 1.1rem;
  color: var(--q-grey-6, #757575);
}

.file-viewer__unsupported-filename {
  margin: 0;
  font-size: 0.9rem;
  color: var(--q-grey-7, #616161);
  font-family: monospace;
  word-break: break-all;
  max-width: 80%;
}
</style>
