<script setup lang="ts">
/**
 * SearchPanel Component
 *
 * Provides search functionality across prompts and snippets.
 * This is a placeholder that will be fully implemented in Task 7.
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n();

const searchQuery = ref('');
const _searchResults = ref<{ id: string; title: string; type: string }[]>([]);

function _handleSearch(): void {
  // Placeholder - will be implemented later
  // console.log('Searching for:', searchQuery.value);
}
</script>

<template>
  <div class="search-panel">
    <div class="search-panel__input-container">
      <q-input
        v-model="searchQuery"
        dense
        outlined
        placeholder="Search prompts and snippets..."
        class="search-panel__input"
        @keyup.enter="handleSearch"
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
            @click="searchQuery = ''"
          />
        </template>
      </q-input>
    </div>

    <div class="search-panel__options">
      <q-checkbox
        dense
        size="sm"
        label="Match case"
        class="search-panel__option"
      />
      <q-checkbox
        dense
        size="sm"
        label="Whole word"
        class="search-panel__option"
      />
      <q-checkbox
        dense
        size="sm"
        label="Use regex"
        class="search-panel__option"
      />
    </div>

    <div class="search-panel__results">
      <div
        v-if="searchResults.length === 0"
        class="search-panel__empty"
      >
        <q-icon
          name="search"
          size="32px"
          class="text-grey-6 q-mb-sm"
        />
        <p class="text-grey-6 text-caption">Enter a search term to find prompts and snippets</p>
      </div>

      <div
        v-for="result in searchResults"
        :key="result.id"
        class="search-panel__result"
      >
        <q-icon
          :name="result.type === 'prompt' ? 'description' : 'code'"
          size="16px"
        />
        <span>{{ result.title }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
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

  &__results {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  &__result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    color: var(--search-result-text, #cccccc);

    &:hover {
      background-color: var(--search-result-hover, #2a2d2e);
    }
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
}

// Dark theme
.body--dark .search-panel {
  --search-input-bg: #3c3c3c;
  --search-input-text: #cccccc;
  --search-option-text: #cccccc;
  --search-result-text: #cccccc;
  --search-result-hover: #2a2d2e;
}
</style>
