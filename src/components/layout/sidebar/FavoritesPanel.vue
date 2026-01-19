<script setup lang="ts">
/**
 * FavoritesPanel Component
 *
 * Displays and manages favorite prompts.
 * Allows browsing, searching, opening, and managing favorites.
 */

import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePromptStore } from '@/stores/promptStore';
import { useUIStore } from '@/stores/uiStore';
import type { IPromptFile } from '@/services/file-system/types';

const { t } = useI18n({ useScope: 'global' });

const promptStore = usePromptStore();
const uiStore = useUIStore();

// Check if running in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!window.fileSystemAPI);

// Search query
const searchQuery = ref('');

// Selected category filter
const selectedCategory = ref<string | null>(null);

// Get unique categories from favorites
const favoriteCategories = computed(() => {
  const categories = new Set<string>();
  for (const prompt of promptStore.favoritePrompts) {
    if (prompt.metadata.category) {
      categories.add(prompt.metadata.category);
    }
  }
  return Array.from(categories).sort();
});

// Filtered favorites based on category and search
const filteredFavorites = computed(() => {
  let favorites = promptStore.favoritePrompts;

  // Filter by category
  if (selectedCategory.value !== null) {
    favorites = favorites.filter((p) => p.metadata.category === selectedCategory.value);
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    favorites = favorites.filter(
      (p) =>
        p.metadata.title.toLowerCase().includes(query) ||
        (p.metadata.description?.toLowerCase().includes(query) ?? false) ||
        p.metadata.tags.some((t) => t.toLowerCase().includes(query))
    );
  }

  return favorites;
});

// Total favorites count
const totalFavorites = computed(() => promptStore.favoritePrompts.length);

// Select/deselect category
function selectCategory(category: string): void {
  selectedCategory.value = selectedCategory.value === category ? null : category;
}

// Clear category filter
function clearCategoryFilter(): void {
  selectedCategory.value = null;
}

// Open prompt in editor
async function openPrompt(prompt: IPromptFile): Promise<void> {
  try {
    // Load the prompt if not already cached
    await promptStore.loadPrompt(prompt.filePath);

    // Open tab in UI
    uiStore.openTab({
      filePath: prompt.filePath,
      fileName: prompt.fileName,
      title: prompt.metadata.title,
      isDirty: false,
      isPinned: false,
    });
  } catch (err) {
    console.error('Failed to open prompt:', err);
  }
}

// Remove from favorites
async function removeFromFavorites(prompt: IPromptFile): Promise<void> {
  try {
    await promptStore.updatePromptMetadata(prompt.filePath, {
      isFavorite: false,
    });
    // Refresh the prompts list
    await promptStore.refreshAllPrompts();
  } catch (err) {
    console.error('Failed to remove from favorites:', err);
  }
}

// Copy prompt content to clipboard
async function copyContent(prompt: IPromptFile): Promise<void> {
  try {
    await navigator.clipboard.writeText(prompt.content);
  } catch (err) {
    console.error('Failed to copy content:', err);
  }
}

// Format date for display
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// Initialize
onMounted(async () => {
  if (!isElectron.value) return;

  try {
    if (!promptStore.isInitialized) {
      await promptStore.initialize();
    }
    // Refresh prompts to get latest favorites
    await promptStore.refreshAllPrompts();
  } catch (err) {
    console.warn('Failed to initialize favorites:', err);
  }
});
</script>

<template>
  <div
    class="favorites-panel"
    data-testid="favorites-panel"
  >
    <!-- Header with search -->
    <div class="favorites-panel__header">
      <q-input
        v-model="searchQuery"
        :placeholder="t('favoritesPanel.searchPlaceholder')"
        outlined
        dense
        clearable
        class="favorites-panel__search"
        data-testid="favorites-search"
      />
    </div>

    <!-- Category filters (only show if there are categories) -->
    <div
      v-if="favoriteCategories.length > 0"
      class="favorites-panel__categories"
      data-testid="favorites-category-filter"
    >
      <div class="favorites-panel__categories-header">
        <span class="favorites-panel__categories-title">{{ t('favoritesPanel.categories') }}</span>
        <q-btn
          v-if="selectedCategory"
          flat
          dense
          round
          size="xs"
          icon="close"
          @click="clearCategoryFilter"
        >
          <q-tooltip>{{ t('favoritesPanel.clearFilter') }}</q-tooltip>
        </q-btn>
      </div>
      <div class="favorites-panel__categories-list">
        <q-chip
          v-for="category in favoriteCategories"
          :key="category"
          :outline="selectedCategory !== category"
          :color="selectedCategory === category ? 'primary' : undefined"
          clickable
          size="sm"
          @click="selectCategory(category)"
        >
          {{ category }}
        </q-chip>
      </div>
    </div>

    <!-- Favorites list -->
    <div class="favorites-panel__content">
      <q-scroll-area class="favorites-panel__scroll">
        <!-- Browser mode message -->
        <div
          v-if="!isElectron"
          class="favorites-panel__browser-mode"
        >
          <q-icon
            name="info"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p class="text-grey-6 text-caption text-center">
            {{ t('favoritesPanel.browserMode') }}
          </p>
          <p class="text-grey-7 text-caption text-center q-mt-sm">
            {{ t('favoritesPanel.browserModeHint') }}
          </p>
        </div>

        <!-- Loading state -->
        <div
          v-else-if="promptStore.isLoading"
          class="favorites-panel__loading"
        >
          <q-spinner-dots
            color="primary"
            size="32px"
          />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="filteredFavorites.length === 0"
          class="favorites-panel__empty"
        >
          <q-icon
            name="star_border"
            size="48px"
            class="text-grey-6 q-mb-sm"
          />
          <p
            v-if="totalFavorites === 0"
            class="text-grey-6 text-caption"
          >
            {{ t('favoritesPanel.noFavorites') }}
          </p>
          <p
            v-else-if="searchQuery"
            class="text-grey-6 text-caption"
          >
            {{ t('favoritesPanel.noMatchingFavorites') }}
          </p>
          <p
            v-else
            class="text-grey-6 text-caption"
          >
            {{ t('favoritesPanel.noCategoryFavorites') }}
          </p>
          <p
            v-if="totalFavorites === 0"
            class="text-grey-7 text-caption q-mt-sm"
          >
            {{ t('favoritesPanel.addHint') }}
          </p>
        </div>

        <!-- Favorite items -->
        <div
          v-else
          class="favorites-panel__list"
          data-testid="favorites-list"
        >
          <div
            v-for="prompt in filteredFavorites"
            :key="prompt.filePath"
            class="favorites-panel__item"
            data-testid="favorite-item"
            @click="openPrompt(prompt)"
          >
            <div class="favorites-panel__item-icon">
              <q-icon
                name="star"
                size="18px"
                color="amber"
              />
            </div>
            <div class="favorites-panel__item-content">
              <div class="favorites-panel__item-title">{{ prompt.metadata.title }}</div>
              <div class="favorites-panel__item-meta">
                <span
                  v-if="prompt.metadata.category"
                  class="favorites-panel__item-category"
                >
                  {{ prompt.metadata.category }}
                </span>
                <span class="favorites-panel__item-date">
                  {{ formatDate(prompt.metadata.updatedAt) }}
                </span>
              </div>
            </div>
            <div class="favorites-panel__item-actions">
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="content_copy"
                @click.stop="copyContent(prompt)"
              >
                <q-tooltip>{{ t('favoritesPanel.copyContent') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="star_border"
                @click.stop="removeFromFavorites(prompt)"
              >
                <q-tooltip>{{ t('favoritesPanel.removeFromFavorites') }}</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
      </q-scroll-area>
    </div>

    <!-- Footer with count -->
    <div class="favorites-panel__footer">
      <q-icon
        name="star"
        size="16px"
        class="text-amber"
      />
      <span class="text-caption text-grey-6">
        {{ t('favoritesPanel.favoriteCount', { count: totalFavorites }) }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.favorites-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__search {
    flex: 1;

    :deep(.q-field__native) {
      font-size: 12px;
    }
  }

  &__categories {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__categories-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__categories-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--categories-title-color, #888888);
  }

  &__categories-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__content {
    flex: 1;
    overflow: hidden;
  }

  &__scroll {
    height: 100%;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
  }

  &__browser-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    padding: 20px;
    text-align: center;
  }

  &__list {
    padding: 8px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--item-hover, #2a2d2e);

      .favorites-panel__item-actions {
        opacity: 1;
      }
    }
  }

  &__item-icon {
    flex-shrink: 0;
  }

  &__item-content {
    flex: 1;
    min-width: 0;
  }

  &__item-title {
    font-size: 13px;
    color: var(--item-title-color, #cccccc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }

  &__item-category {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    background-color: var(--category-bg, #3c3c3c);
    color: var(--category-color, #9cdcfe);
  }

  &__item-date {
    font-size: 11px;
    color: var(--item-date-color, #808080);
  }

  &__item-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }
}

// Light theme
.body--light .favorites-panel {
  --border-color: #e7e7e7;
  --categories-title-color: #6f6f6f;
  --item-hover: #e8e8e8;
  --item-title-color: #3b3b3b;
  --item-date-color: #6f6f6f;
  --category-bg: #e8e8e8;
  --category-color: #0550ae;
}

// Dark theme
.body--dark .favorites-panel {
  --border-color: #3c3c3c;
  --categories-title-color: #888888;
  --item-hover: #2a2d2e;
  --item-title-color: #cccccc;
  --item-date-color: #808080;
  --category-bg: #3c3c3c;
  --category-color: #9cdcfe;
}
</style>
