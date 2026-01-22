<script setup lang="ts">
/**
 * SearchPanel Component
 *
 * Provides search functionality across prompts and snippets.
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePromptStore } from '@/stores/promptStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';

const { t } = useI18n({ useScope: 'global' });

const promptStore = usePromptStore();
const snippetStore = useSnippetStore();
const uiStore = useUIStore();
const settingsStore = useSettingsStore();

// Search state
const searchQuery = ref('');
const matchCase = ref(false);
const wholeWord = ref(false);
const useRegex = ref(false);
const hasSearched = ref(false);
const categoryFilter = ref<string[]>([]);

// Result interface
interface ISearchResult {
  id: string;
  title: string;
  type: 'prompt' | 'snippet';
  filePath: string;
  fileName: string;
  category?: string;
  snippetType?: string;
  matchLocation?: 'title' | 'content' | 'category' | 'filename' | 'shortcut';
  contentPreview?: string;
}

// Get category label from value
function getCategoryLabel(categoryValue: string | undefined): string | undefined {
  if (!categoryValue) return undefined;
  const category = settingsStore.getCategoryByValue(categoryValue);
  return category?.label ?? categoryValue;
}

// Normalize string for diacritics-insensitive search
function normalizeForSearch(text: string): string {
  // NFD decomposition separates base characters from diacritical marks
  // Then we remove the diacritical marks (Unicode range \u0300-\u036f)
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Check if text matches the search pattern (with diacritics normalization)
function matchesSearch(text: string, pattern: RegExp): boolean {
  const normalizedText = normalizeForSearch(text);
  pattern.lastIndex = 0;
  return pattern.test(normalizedText);
}

// Get content preview around match
function getContentPreview(content: string, pattern: RegExp): string | undefined {
  const normalizedContent = normalizeForSearch(content);
  pattern.lastIndex = 0;
  const match = pattern.exec(normalizedContent);
  if (!match) return undefined;

  const matchIndex = match.index;
  const contextLength = 50;
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(content.length, matchIndex + match[0].length + contextLength);

  let preview = content.slice(start, end).trim();
  if (start > 0) preview = '...' + preview;
  if (end < content.length) preview = preview + '...';

  // Replace newlines with spaces for display
  preview = preview.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

  return preview;
}

// Build search pattern based on options (with diacritics normalization on query)
function buildSearchPattern(query: string): RegExp | null {
  if (!query.trim()) return null;

  try {
    // Normalize the query for diacritics-insensitive search
    let pattern = normalizeForSearch(query);

    if (!useRegex.value) {
      // Escape regex special characters if not using regex mode
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (wholeWord.value) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = matchCase.value ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  } catch {
    // Invalid regex, return null
    return null;
  }
}

// Search results computed
const searchResults = computed<ISearchResult[]>(() => {
  const query = searchQuery.value.trim();
  if (!query) return [];

  const pattern = buildSearchPattern(query);
  if (!pattern) return [];

  const results: ISearchResult[] = [];
  const selectedCategories = categoryFilter.value;
  const hasCategyFilter = selectedCategories.length > 0;

  // Search prompts
  for (const prompt of promptStore.allPrompts) {
    // Apply category filter first
    if (hasCategyFilter && !selectedCategories.includes(prompt.metadata.category ?? '')) {
      continue;
    }

    const titleMatch = matchesSearch(prompt.metadata.title, pattern);
    const fileNameMatch = matchesSearch(prompt.fileName, pattern);
    const categoryLabel = getCategoryLabel(prompt.metadata.category);
    const categoryMatch = categoryLabel ? matchesSearch(categoryLabel, pattern) : false;
    const contentMatch = matchesSearch(prompt.content, pattern);

    if (titleMatch || fileNameMatch || categoryMatch || contentMatch) {
      // Determine primary match location for display
      let matchLocation: ISearchResult['matchLocation'] = 'title';
      let contentPreview: string | undefined;

      if (titleMatch) {
        matchLocation = 'title';
      } else if (categoryMatch) {
        matchLocation = 'category';
      } else if (fileNameMatch) {
        matchLocation = 'filename';
      } else if (contentMatch) {
        matchLocation = 'content';
        contentPreview = getContentPreview(prompt.content, pattern);
      }

      results.push({
        id: prompt.filePath,
        title: prompt.metadata.title || prompt.fileName.replace('.md', ''),
        type: 'prompt',
        filePath: prompt.filePath,
        fileName: prompt.fileName,
        category: prompt.metadata.category,
        matchLocation,
        contentPreview,
      });
    }
  }

  // Search snippets (including content) - only if no category filter (snippets don't have categories)
  if (!hasCategyFilter) {
    for (const snippet of snippetStore.allSnippets) {
      const nameMatch = matchesSearch(snippet.metadata.name, pattern);
      const shortcutMatch = matchesSearch(snippet.metadata.shortcut, pattern);
      const contentMatch = matchesSearch(snippet.content, pattern);

      if (nameMatch || shortcutMatch || contentMatch) {
        let matchLocation: ISearchResult['matchLocation'] = 'title';
        let contentPreview: string | undefined;

        if (nameMatch) {
          matchLocation = 'title';
        } else if (shortcutMatch) {
          matchLocation = 'shortcut';
        } else if (contentMatch) {
          matchLocation = 'content';
          contentPreview = getContentPreview(snippet.content, pattern);
        }

        results.push({
          id: snippet.filePath,
          title: snippet.metadata.name,
          type: 'snippet',
          filePath: snippet.filePath,
          fileName: snippet.fileName,
          snippetType: snippet.metadata.type,
          matchLocation,
          contentPreview,
        });
      }
    }
  }

  return results;
});

// Track when user has searched
watch(searchQuery, (newValue) => {
  if (newValue.trim()) {
    hasSearched.value = true;
  }
});

// Open result in editor
async function openResult(result: ISearchResult): Promise<void> {
  try {
    if (result.type === 'prompt') {
      const prompt = await promptStore.loadPrompt(result.filePath);
      uiStore.openTab({
        filePath: prompt.filePath,
        fileName: prompt.fileName,
        title: prompt.metadata.title || prompt.fileName.replace('.md', ''),
        isDirty: false,
        isPinned: false,
      });
    } else {
      const snippet = await snippetStore.loadSnippet(result.filePath);
      uiStore.openTab({
        filePath: snippet.filePath,
        fileName: snippet.fileName,
        title: snippet.metadata.name,
        isDirty: false,
        isPinned: false,
      });
    }
  } catch (err) {
    console.error('Failed to open file:', err);
  }
}

// Get icon for result
function getResultIcon(result: ISearchResult): string {
  if (result.type === 'prompt') {
    return 'description';
  }
  // Snippet icons based on type
  switch (result.snippetType) {
    case 'persona':
      return 'person';
    case 'code':
      return 'code';
    case 'template':
      return 'dashboard';
    default:
      return 'text_snippet';
  }
}

// Clear search
function clearSearch(): void {
  searchQuery.value = '';
  hasSearched.value = false;
}
</script>

<template>
  <div
    class="search-panel"
    data-testid="search-panel"
  >
    <div class="search-panel__input-container">
      <q-input
        v-model="searchQuery"
        dense
        outlined
        :placeholder="t('searchPanel.placeholder')"
        class="search-panel__input"
        data-testid="search-input"
      >
        <template #prepend>
          <q-icon
            name="search"
            size="18px"
          />
        </template>
        <template #append>
          <q-icon
            v-if="searchQuery"
            name="close"
            size="18px"
            class="cursor-pointer"
            data-testid="clear-search"
            @click="clearSearch"
          />
        </template>
      </q-input>
    </div>

    <div class="search-panel__options">
      <q-checkbox
        v-model="matchCase"
        dense
        size="sm"
        :label="t('searchPanel.matchCase')"
        class="search-panel__option"
        data-testid="match-case"
      />
      <q-checkbox
        v-model="wholeWord"
        dense
        size="sm"
        :label="t('searchPanel.matchWholeWord')"
        class="search-panel__option"
        data-testid="whole-word"
      />
      <q-checkbox
        v-model="useRegex"
        dense
        size="sm"
        :label="t('searchPanel.useRegex')"
        class="search-panel__option"
        data-testid="use-regex"
      />
    </div>

    <div class="search-panel__filter">
      <q-select
        v-model="categoryFilter"
        :options="settingsStore.categories"
        :label="t('searchPanel.filterByCategories')"
        dense
        outlined
        emit-value
        map-options
        multiple
        use-chips
        clearable
        class="search-panel__category-select"
        data-testid="category-filter"
      >
        <template #prepend>
          <q-icon
            name="filter_alt"
            size="18px"
          />
        </template>
      </q-select>
    </div>

    <div
      class="search-panel__results"
      data-testid="search-results"
    >
      <!-- No search yet -->
      <div
        v-if="!hasSearched || !searchQuery.trim()"
        class="search-panel__empty"
      >
        <q-icon
          name="search"
          size="32px"
          class="text-grey-6 q-mb-sm"
        />
        <p class="text-grey-6 text-caption">{{ t('searchPanel.enterSearchTerm') }}</p>
      </div>

      <!-- No results -->
      <div
        v-else-if="searchResults.length === 0"
        class="search-panel__empty"
        data-testid="no-results"
      >
        <q-icon
          name="search_off"
          size="32px"
          class="text-grey-6 q-mb-sm"
        />
        <p class="text-grey-6 text-caption">
          {{ t('searchPanel.noResultsFor', { query: searchQuery }) }}
        </p>
      </div>

      <!-- Results list -->
      <template v-else>
        <div
          class="search-panel__results-header"
          data-testid="result-count"
        >
          {{ t('searchPanel.resultCount', { count: searchResults.length }) }}
        </div>
        <div
          v-for="result in searchResults"
          :key="result.id"
          class="search-panel__result"
          data-testid="search-result-item"
          @click="openResult(result)"
        >
          <q-icon
            :name="getResultIcon(result)"
            size="16px"
            class="search-panel__result-icon"
          />
          <div class="search-panel__result-info">
            <div class="search-panel__result-header">
              <span class="search-panel__result-title">{{ result.title }}</span>
              <q-badge
                :label="
                  result.type === 'prompt' ? t('searchPanel.prompt') : t('searchPanel.snippet')
                "
                :color="result.type === 'prompt' ? 'primary' : 'secondary'"
                text-color="white"
                class="search-panel__result-type"
              />
            </div>
            <div
              v-if="result.contentPreview"
              class="search-panel__result-preview"
              data-testid="result-preview"
            >
              {{ result.contentPreview }}
            </div>
            <div
              v-else-if="result.matchLocation === 'filename'"
              class="search-panel__result-match-info"
            >
              {{ t('searchPanel.matchInFilename', { filename: result.fileName }) }}
            </div>
            <div class="search-panel__result-footer">
              <q-badge
                v-if="result.type === 'prompt'"
                :label="
                  result.category
                    ? getCategoryLabel(result.category)
                    : t('searchPanel.uncategorized')
                "
                :color="result.category ? 'grey-7' : 'grey-5'"
                text-color="white"
                class="search-panel__result-category"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;

  &__input-container {
    padding: 8px 12px;
  }

  &__input {
    :deep(.q-field__control) {
      background-color: var(--search-input-bg, #3c3c3c);
    }

    :deep(.q-field__native) {
      color: var(--search-input-text, #cccccc);
      font-size: 13px;
    }
  }

  &__options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 12px 8px;
  }

  &__option {
    :deep(.q-checkbox__label) {
      font-size: 12px;
      color: var(--search-option-text, #cccccc);
    }
  }

  &__filter {
    padding: 0 12px 8px;
  }

  &__category-select {
    :deep(.q-field__control) {
      background-color: var(--search-input-bg, #3c3c3c);
    }

    :deep(.q-field__native) {
      color: var(--search-input-text, #cccccc);
      font-size: 13px;
    }

    :deep(.q-field__label) {
      color: var(--search-option-text, #cccccc);
    }
  }

  &__results {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  &__results-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--results-header-color, #888);
    padding: 8px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    margin-bottom: 4px;
  }

  &__result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    color: var(--search-result-text, #cccccc);

    &:hover {
      background-color: var(--search-result-hover, #2a2d2e);
    }
  }

  &__result-icon {
    flex-shrink: 0;
    opacity: 0.7;
    align-self: flex-start;
    margin-top: 2px;
  }

  &__result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__result-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__result-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__result-preview {
    font-size: 11px;
    color: var(--preview-text-color, #888);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  &__result-match-info {
    font-size: 11px;
    color: var(--preview-text-color, #888);
    font-style: italic;
  }

  &__result-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__result-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  &__result-category {
    font-size: 9px;
    padding: 1px 5px;
  }

  &__result-type {
    font-size: 9px;
    padding: 1px 5px;
    margin-left: auto;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
  }
}

// Light theme
.body--light .search-panel {
  --search-input-bg: #ffffff;
  --search-input-text: #3b3b3b;
  --search-option-text: #3b3b3b;
  --search-result-text: #3b3b3b;
  --search-result-hover: #e8e8e8;
  --results-header-color: #666;
  --border-color: #e7e7e7;
  --preview-text-color: #666;
}

// Dark theme
.body--dark .search-panel {
  --search-input-bg: #3c3c3c;
  --search-input-text: #cccccc;
  --search-option-text: #cccccc;
  --search-result-text: #cccccc;
  --search-result-hover: #2a2d2e;
  --results-header-color: #888;
  --border-color: #3c3c3c;
  --preview-text-color: #888;
}
</style>
