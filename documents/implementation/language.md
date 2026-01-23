# Language Filtering Implementation for MyndPrompts

## 1. Architecture Overview

### 1.1 Current State Analysis

#### Data Layer

| Component            | Location                                         | Language Support                          |
| -------------------- | ------------------------------------------------ | ----------------------------------------- |
| `IPluginItem`        | `src/services/storage/entities.ts:167-174`       | `language?: string` field EXISTS          |
| `ISnippetMetadata`   | `src/services/file-system/types.ts:45-54`        | NO language field - needs addition        |
| `IMarketplacePlugin` | `src/services/plugins/types.ts:6-14`             | No direct field, items have language      |
| Language Constants   | `src/services/file-system/file-types.ts:734-785` | 40+ languages in `LANGUAGE_DISPLAY_NAMES` |

#### UI Components

| Component                 | Location                         | Current Filters        | Language Display          |
| ------------------------- | -------------------------------- | ---------------------- | ------------------------- |
| `SnippetsPanel.vue`       | `src/components/layout/sidebar/` | search, category, tags | None                      |
| `PluginsMarketplace.vue`  | `src/components/settings/`       | search, type, tags     | None                      |
| `PluginCard.vue`          | `src/components/settings/`       | N/A                    | None                      |
| `PluginContentViewer.vue` | `src/components/settings/`       | N/A                    | YES - shows item language |
| `NewSnippetDialog.vue`    | `src/components/dialogs/`        | N/A                    | None                      |

#### State Management

| Store             | Location      | Language Support         |
| ----------------- | ------------- | ------------------------ |
| `pluginStore.ts`  | `src/stores/` | No language filter state |
| `snippetStore.ts` | `src/stores/` | No language filter state |

### 1.2 Filtering Patterns

**Current Filter Logic Pattern (pluginStore.ts:86-118):**

```typescript
const filteredMarketplace = computed(() => {
  let result = availablePlugins.value;

  // 1. Search filter (diacritics-insensitive)
  if (searchQuery.value) {
    result = result.filter(/* name, types, tags, id */);
  }

  // 2. Type filter (OR logic - plugin has ANY selected type)
  if (selectedTypes.value.length > 0) {
    result = result.filter(/* check plugin-level and item-level types */);
  }

  // 3. Tags filter (OR logic - plugin has ANY selected tag)
  if (selectedTags.value.length > 0) {
    result = result.filter(/* check plugin-level and item-level tags */);
  }

  return result;
});
```

**Language Filter Strategy:** Single-select (one language at a time) following patterns for Type filter UI but simpler logic.

### 1.3 i18n Structure

- 10 locales: `en-US`, `en-GB`, `en-IE`, `fr-FR`, `es-ES`, `pt-BR`, `pt-PT`, `it-IT`, `de-DE`, `ar-SA`
- Pattern: `t('plugins.filterByType')` / `t('snippetsPanel.filterByTags')`
- Location: `src/i18n/{locale}/index.ts`

### 1.4 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LIBRARY PANE                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Search [________________]  [+]                               ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ [Personas] [Text] [Code] [Templates]  ← Category chips      ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Tags: [Select tags...              ▼]                       ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Language: [All languages           ▼]  ← NEW                ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ┌─ Snippet Item ──────────────────────────────────────────┐ ││
│  │ │ [icon] Title                                            │ ││
│  │ │        @shortcut                                        │ ││
│  │ │        [Tag1] [Tag2]  [JavaScript]  ← Language badge    │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      LIBRARY DIALOG                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Search [________________]                                    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Type: [Code Snippets] [Persona] [Templates] [Text Snippets] ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Tags: [Select tags...              ▼]                       ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Language: [All languages           ▼]  ← NEW                ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ┌─ Plugin Card ───────────────────────────────────────────┐ ││
│  │ │ [icon] Plugin Name  v1.0.0        [View] [Install]      │ ││
│  │ │        Description text...                              │ ││
│  │ │        [Type] 12 items  [JavaScript] [Python]  ← Langs  │ ││
│  │ │        [Tag1] [Tag2]                                    │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementation Todos

### Task Checklist

- [x] **Task 1:** Add language field to ISnippetMetadata type
- [x] **Task 2:** Create language constants and helper functions
- [x] **Task 3:** Add i18n translations for language filter labels
- [x] **Task 4:** Add language filter to pluginStore.ts
- [x] **Task 5:** Add language filter UI to PluginsMarketplace.vue
- [x] **Task 6:** Display languages in PluginCard.vue
- [x] **Task 7:** Add language filter to SnippetsPanel.vue
- [x] **Task 8:** Add language field to NewSnippetDialog.vue
- [x] **Task 9:** Display language in snippet list items
- [x] **Task 10:** Update snippet file parsing/saving for language field

---

## 3. Task Details

---

### Task 1: Add Language Field to ISnippetMetadata Type

**Purpose:** Extend the snippet metadata interface to support an optional language field for categorizing snippets by programming language.

**Objective:** Add `language?: string` to the `ISnippetMetadata` interface so snippets can store and filter by language.

**Architecture Description:**

- File: `src/services/file-system/types.ts`
- Interface: `ISnippetMetadata` (lines 45-54)
- Change: Add optional `language` field after `tags` field
- Impact: All snippet-related components will have access to language metadata

**Files to Modify:**

- `src/services/file-system/types.ts`

**Full Prompt:**

````
# Task: Add Language Field to ISnippetMetadata

## Context
You are modifying the MyndPrompts application to support language filtering for snippets.

## Objective
Add an optional `language` field to the `ISnippetMetadata` interface.

## File to Modify
`src/services/file-system/types.ts`

## Current Interface (lines 45-54)
```typescript
export interface ISnippetMetadata {
  id: string;
  name: string;
  type: 'persona' | 'code' | 'text' | 'template';
  shortcut: string;
  description?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}
````

## Required Change

Add `language?: string;` field after `tags: string[];`

## Expected Result

```typescript
export interface ISnippetMetadata {
  id: string;
  name: string;
  type: 'persona' | 'code' | 'text' | 'template';
  shortcut: string;
  description?: string;
  tags: string[];
  language?: string; // NEW: Optional programming language
  createdAt?: string;
  updatedAt?: string;
}
```

## Verification

- No TypeScript errors after change
- Field is optional so existing snippets without language still work

```

---

### Task 2: Create Language Constants and Helper Functions

**Purpose:** Centralize language definitions and provide utility functions for language display and filtering.

**Objective:** Create a constants file with supported languages list and helper functions to get language options for dropdowns.

**Architecture Description:**
- New file: `src/constants/languages.ts`
- Export: `SNIPPET_LANGUAGES` - array of language options with value/label
- Export: `getLanguageLabel(value)` - returns display name for language code
- Reuse: Leverage existing `LANGUAGE_DISPLAY_NAMES` from `file-types.ts`

**Files to Create:**
- `src/constants/languages.ts`

**Full Prompt:**
```

# Task: Create Language Constants File

## Context

You are adding language filtering to MyndPrompts. A constants file is needed for language options.

## Objective

Create a new constants file with language definitions for use in dropdowns and filtering.

## File to Create

`src/constants/languages.ts`

## Reference

The file `src/services/file-system/file-types.ts` already has `LANGUAGE_DISPLAY_NAMES` (lines 734-785) with 40+ languages.

## Required Implementation

```typescript
/**
 * Language constants for snippet and plugin filtering
 */

// Subset of languages commonly used for code snippets and prompts
export const SNIPPET_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'scala', label: 'Scala' },
  { value: 'r', label: 'R' },
  { value: 'shell', label: 'Shell/Bash' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'vue', label: 'Vue' },
  { value: 'react', label: 'React/JSX' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
] as const;

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number]['value'];

/**
 * Get display label for a language value
 */
export function getLanguageLabel(value: string): string {
  const lang = SNIPPET_LANGUAGES.find((l) => l.value === value);
  return lang?.label ?? value;
}

/**
 * Get language options for select dropdowns (sorted alphabetically)
 */
export function getLanguageOptions(): { value: string; label: string }[] {
  return [...SNIPPET_LANGUAGES].sort((a, b) => a.label.localeCompare(b.label));
}
```

## Verification

- File exports SNIPPET_LANGUAGES array
- File exports getLanguageLabel function
- File exports getLanguageOptions function
- TypeScript compiles without errors

```

---

### Task 3: Add i18n Translations for Language Filter Labels

**Purpose:** Add localized strings for the language filter UI across all supported locales.

**Objective:** Add translation keys for language filter labels, placeholders, and related text.

**Architecture Description:**
- Files: All 10 locale files in `src/i18n/{locale}/index.ts`
- Add keys under `plugins` and `snippetsPanel` sections
- Keys: `filterByLanguage`, `selectLanguage`, `allLanguages`, `noLanguagesFound`

**Files to Modify:**
- `src/i18n/en-US/index.ts`
- `src/i18n/en-GB/index.ts`
- `src/i18n/en-IE/index.ts`
- `src/i18n/fr-FR/index.ts`
- `src/i18n/es-ES/index.ts`
- `src/i18n/pt-BR/index.ts`
- `src/i18n/pt-PT/index.ts`
- `src/i18n/it-IT/index.ts`
- `src/i18n/de-DE/index.ts`
- `src/i18n/ar-SA/index.ts`

**Full Prompt:**
```

# Task: Add i18n Translations for Language Filter

## Context

You are adding language filtering to MyndPrompts. Translation strings are needed.

## Objective

Add translation keys for language filter UI in all 10 locale files.

## Files to Modify

All files in `src/i18n/{locale}/index.ts`

## Keys to Add

### In `plugins` section:

```typescript
plugins: {
  // ... existing keys ...
  filterByLanguage: 'Language',
  selectLanguage: 'Select language...',
  allLanguages: 'All languages',
  noLanguagesFound: 'No languages found',
}
```

### In `snippetsPanel` section:

```typescript
snippetsPanel: {
  // ... existing keys ...
  filterByLanguage: 'Language',
  selectLanguage: 'Select language...',
  allLanguages: 'All languages',
}
```

## Translations by Locale

### en-US, en-GB, en-IE (English)

- filterByLanguage: 'Language'
- selectLanguage: 'Select language...'
- allLanguages: 'All languages'
- noLanguagesFound: 'No languages found'

### fr-FR (French)

- filterByLanguage: 'Langage'
- selectLanguage: 'Sélectionner un langage...'
- allLanguages: 'Tous les langages'
- noLanguagesFound: 'Aucun langage trouvé'

### es-ES (Spanish)

- filterByLanguage: 'Lenguaje'
- selectLanguage: 'Seleccionar lenguaje...'
- allLanguages: 'Todos los lenguajes'
- noLanguagesFound: 'No se encontraron lenguajes'

### pt-BR, pt-PT (Portuguese)

- filterByLanguage: 'Linguagem'
- selectLanguage: 'Selecionar linguagem...'
- allLanguages: 'Todas as linguagens'
- noLanguagesFound: 'Nenhuma linguagem encontrada'

### it-IT (Italian)

- filterByLanguage: 'Linguaggio'
- selectLanguage: 'Seleziona linguaggio...'
- allLanguages: 'Tutti i linguaggi'
- noLanguagesFound: 'Nessun linguaggio trovato'

### de-DE (German)

- filterByLanguage: 'Sprache'
- selectLanguage: 'Sprache auswählen...'
- allLanguages: 'Alle Sprachen'
- noLanguagesFound: 'Keine Sprachen gefunden'

### ar-SA (Arabic)

- filterByLanguage: 'اللغة'
- selectLanguage: 'اختر لغة...'
- allLanguages: 'جميع اللغات'
- noLanguagesFound: 'لم يتم العثور على لغات'

## Verification

- All 10 locale files updated
- Keys added to both `plugins` and `snippetsPanel` sections
- No TypeScript errors

```

---

### Task 4: Add Language Filter to pluginStore.ts

**Purpose:** Add state management for language filtering in the plugin marketplace.

**Objective:** Add `selectedLanguage` ref, update `filteredMarketplace` computed, add `allLanguages` computed, and add setter/clear methods.

**Architecture Description:**
- File: `src/stores/pluginStore.ts`
- Add: `selectedLanguage` ref (single string, not array)
- Add: `allLanguages` computed (unique languages from all plugins)
- Update: `filteredMarketplace` to filter by language
- Add: `setSelectedLanguage()` and update `clearFilters()`
- Filter logic: Check plugin items for language match (OR - any item matches)

**Files to Modify:**
- `src/stores/pluginStore.ts`

**Full Prompt:**
```

# Task: Add Language Filter to pluginStore

## Context

You are adding language filtering to the MyndPrompts plugin marketplace.

## Objective

Add language filtering state and logic to pluginStore.ts.

## File to Modify

`src/stores/pluginStore.ts`

## Changes Required

### 1. Add State (near line 37, after selectedTags)

```typescript
const selectedLanguage = ref<string | null>(null);
```

### 2. Add Helper Function (near getPluginTags function)

```typescript
/**
 * Get all unique languages from a plugin's items
 */
function getPluginLanguages(plugin: IMarketplacePlugin | IPlugin): string[] {
  const languages = new Set<string>();
  plugin.items.forEach((item) => {
    if (item.language) {
      languages.add(item.language);
    }
  });
  return Array.from(languages);
}
```

### 3. Add allLanguages Computed (after allTags computed)

```typescript
/**
 * All unique languages from marketplace and installed plugins
 */
const allLanguages = computed(() => {
  const languages = new Set<string>();
  [...marketplace.value, ...installed.value].forEach((p) => {
    getPluginLanguages(p).forEach((lang) => languages.add(lang));
  });
  return Array.from(languages).sort((a, b) => a.localeCompare(b));
});
```

### 4. Update filteredMarketplace Computed (after tags filter, before return)

```typescript
// Filter by language (check item-level languages)
if (selectedLanguage.value) {
  result = result.filter((p) => {
    const pluginLanguages = getPluginLanguages(p);
    return pluginLanguages.includes(selectedLanguage.value!);
  });
}
```

### 5. Add Setter Function (near setSelectedTags)

```typescript
/**
 * Set selected language filter
 */
function setSelectedLanguage(language: string | null): void {
  selectedLanguage.value = language;
}
```

### 6. Update clearFilters Function

```typescript
function clearFilters(): void {
  searchQuery.value = '';
  selectedTypes.value = [];
  selectedTags.value = [];
  selectedLanguage.value = null; // ADD THIS LINE
}
```

### 7. Export in Return Statement

Add to the return object:

```typescript
return {
  // ... existing exports ...
  selectedLanguage,
  allLanguages,
  setSelectedLanguage,
};
```

## Verification

- No TypeScript errors
- Language filter state is reactive
- Filtering works with OR logic (any item language matches)
- Clear filters resets language selection

```

---

### Task 5: Add Language Filter UI to PluginsMarketplace.vue

**Purpose:** Add the language filter dropdown to the marketplace filter section.

**Objective:** Add a single-select q-select for language filtering, positioned after the tags filter.

**Architecture Description:**
- File: `src/components/settings/PluginsMarketplace.vue`
- Location: After tags filter div (around line 291)
- Component: q-select with single selection
- Features: Searchable, clearable, shows "All languages" when empty
- Binds to: `pluginStore.selectedLanguage` via `pluginStore.setSelectedLanguage()`

**Files to Modify:**
- `src/components/settings/PluginsMarketplace.vue`

**Full Prompt:**
```

# Task: Add Language Filter UI to PluginsMarketplace

## Context

You are adding a language filter dropdown to the plugin marketplace.

## Objective

Add a single-select language filter after the tags filter in PluginsMarketplace.vue.

## File to Modify

`src/components/settings/PluginsMarketplace.vue`

## Changes Required

### 1. Add Local State for Filter Input (after tagsFilterText ref)

```typescript
const languageFilterText = ref('');
```

### 2. Add Filter Function for Language Select (after filterTags function)

```typescript
// Filter languages function for q-select
function filterLanguages(val: string, update: (fn: () => void) => void): void {
  update(() => {
    languageFilterText.value = val;
  });
}

// Computed filtered language options
const filteredLanguageOptions = computed(() => {
  if (!languageFilterText.value) {
    return pluginStore.allLanguages;
  }
  const needle = normalizeForSearch(languageFilterText.value);
  return pluginStore.allLanguages.filter((lang) => normalizeForSearch(lang).includes(needle));
});
```

### 3. Add Handler Function

```typescript
// Update language filter
function onLanguageChange(value: string | null): void {
  pluginStore.setSelectedLanguage(value);
}
```

### 4. Update hasActiveFilters Computed

```typescript
const hasActiveFilters = computed(() => {
  return (
    pluginStore.searchQuery !== '' ||
    pluginStore.selectedTypes.length > 0 ||
    pluginStore.selectedTags.length > 0 ||
    pluginStore.selectedLanguage !== null // ADD THIS
  );
});
```

### 5. Add Template (after tags filter div, before clear filters)

```vue
<!-- Language Filter -->
<div
  v-if="pluginStore.allLanguages.length > 0"
  class="plugins-marketplace__filter-group plugins-marketplace__filter-group--language"
>
  <span class="plugins-marketplace__filter-label">
    {{ t('plugins.filterByLanguage') || 'Language' }}:
  </span>
  <q-select
    :model-value="pluginStore.selectedLanguage"
    :options="filteredLanguageOptions"
    dense
    outlined
    clearable
    use-input
    input-debounce="0"
    dropdown-icon="mdi-chevron-down"
    :placeholder="t('plugins.selectLanguage') || 'Select language...'"
    class="plugins-marketplace__language-select"
    popup-content-class="plugins-marketplace__language-dropdown"
    @update:model-value="onLanguageChange"
    @filter="filterLanguages"
  >
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey">
          {{ t('plugins.noLanguagesFound') || 'No languages found' }}
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</div>
```

### 6. Add CSS (in scoped styles section)

```scss
&__filter-group--language {
  align-items: center;
}

&__language-select {
  flex: 1;
  min-width: 150px;
  max-width: 250px;

  :deep(.q-field__control) {
    min-height: 32px;
    background-color: var(--input-bg, rgba(0, 0, 0, 0.05));
  }

  :deep(.q-field__native) {
    min-height: 28px;
    padding: 2px 8px;
  }
}
```

### 7. Add Global Style (in unscoped style block)

```scss
.plugins-marketplace__language-dropdown {
  z-index: 9999 !important;
}
```

## Verification

- Language filter dropdown appears after tags
- Single selection works
- Filtering updates marketplace list
- Clear filters button clears language selection
- Searchable dropdown for languages

```

---

### Task 6: Display Languages in PluginCard.vue

**Purpose:** Show the programming languages available in a plugin on its card.

**Objective:** Add language badges/chips to the PluginCard component showing unique languages from items.

**Architecture Description:**
- File: `src/components/settings/PluginCard.vue`
- Location: After the items count, before tags
- Display: Chips with outline style, max 3 visible + "+N more" if more
- Data: Extract unique languages from `plugin.items`

**Files to Modify:**
- `src/components/settings/PluginCard.vue`

**Full Prompt:**
```

# Task: Display Languages in PluginCard

## Context

You are adding language display to plugin cards in the marketplace.

## Objective

Show unique languages from plugin items as chips on the card.

## File to Modify

`src/components/settings/PluginCard.vue`

## Changes Required

### 1. Add Computed for Plugin Languages (in script section)

```typescript
// Get unique languages from plugin items
const pluginLanguages = computed(() => {
  const languages = new Set<string>();
  props.plugin.items.forEach((item) => {
    if (item.language) {
      languages.add(item.language);
    }
  });
  return Array.from(languages).sort((a, b) => a.localeCompare(b));
});

// Visible languages (max 3)
const visibleLanguages = computed(() => pluginLanguages.value.slice(0, 3));
const hiddenLanguagesCount = computed(() => Math.max(0, pluginLanguages.value.length - 3));
```

### 2. Add Template (after items count badge, before tags)

Position this after the type badge and items count, before tags section:

```vue
<!-- Languages -->
<div v-if="pluginLanguages.length > 0" class="plugin-card__languages">
  <q-chip
    v-for="lang in visibleLanguages"
    :key="lang"
    dense
    size="sm"
    outline
    color="grey"
    class="plugin-card__language"
  >
    {{ lang }}
  </q-chip>
  <q-chip
    v-if="hiddenLanguagesCount > 0"
    dense
    size="sm"
    outline
    color="grey"
    class="plugin-card__language plugin-card__language--more"
  >
    +{{ hiddenLanguagesCount }}
    <q-tooltip>
      {{ pluginLanguages.slice(3).join(', ') }}
    </q-tooltip>
  </q-chip>
</div>
```

### 3. Add CSS

```scss
&__languages {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

&__language {
  font-size: 10px;
  height: 20px;

  :deep(.q-chip__content) {
    padding: 0 6px;
  }
}

&__language--more {
  cursor: help;
}
```

## Verification

- Languages appear on plugin cards
- Max 3 languages shown with "+N" for overflow
- Tooltip shows hidden languages
- Outline style matches design

```

---

### Task 7: Add Language Filter to SnippetsPanel.vue

**Purpose:** Add language filtering capability to the Library pane's snippet list.

**Objective:** Add a single-select language filter dropdown and update the filtering logic.

**Architecture Description:**
- File: `src/components/layout/sidebar/SnippetsPanel.vue`
- Location: After tags filter (around line 559)
- State: Local `selectedLanguage` ref
- Filter: Update `filteredSnippets` computed to check `snippet.metadata.language`
- Compute: `allSnippetLanguages` from all snippets

**Files to Modify:**
- `src/components/layout/sidebar/SnippetsPanel.vue`

**Full Prompt:**
```

# Task: Add Language Filter to SnippetsPanel

## Context

You are adding language filtering to the Library pane (SnippetsPanel).

## Objective

Add a language filter dropdown that filters snippets by their language metadata.

## File to Modify

`src/components/layout/sidebar/SnippetsPanel.vue`

## Changes Required

### 1. Add State (after selectedTags ref)

```typescript
// Selected language for filtering
const selectedLanguage = ref<string | null>(null);
```

### 2. Add Computed for All Languages (after allTags computed)

```typescript
// All unique languages from all snippets, sorted alphabetically
const allSnippetLanguages = computed(() => {
  const langSet = new Set<string>();
  for (const snippet of snippetStore.allSnippets) {
    if (snippet.metadata.language) {
      langSet.add(snippet.metadata.language);
    }
  }
  return Array.from(langSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
});
```

### 3. Add Filter State and Function (after filterTags function)

```typescript
// Filtered language options based on search input
const filteredLanguageOptions = ref<string[]>([]);

// Filter function for language select
function filterLanguages(val: string, update: (fn: () => void) => void): void {
  update(() => {
    if (val === '') {
      filteredLanguageOptions.value = allSnippetLanguages.value;
    } else {
      const needle = val.toLowerCase();
      filteredLanguageOptions.value = allSnippetLanguages.value.filter((lang) =>
        lang.toLowerCase().includes(needle)
      );
    }
  });
}

// Clear selected language
function clearLanguage(): void {
  selectedLanguage.value = null;
}
```

### 4. Update filteredSnippets Computed (after tags filter, before search filter)

Add this block after the tags filter and before the search filter:

```typescript
// Filter by language
if (selectedLanguage.value) {
  snippets = snippets.filter(
    (s) => s.metadata.language?.toLowerCase() === selectedLanguage.value?.toLowerCase()
  );
}
```

### 5. Add Template (after tag filter div)

```vue
<!-- Language filter -->
<div v-if="allSnippetLanguages.length > 0" class="snippets-panel__language-filter">
  <q-select
    v-model="selectedLanguage"
    :options="filteredLanguageOptions"
    clearable
    dense
    outlined
    use-input
    input-debounce="0"
    :placeholder="t('snippetsPanel.selectLanguage') || 'Select language...'"
    class="snippets-panel__language-select"
    popup-content-class="snippets-panel__language-popup"
    @filter="filterLanguages"
    @clear="clearLanguage"
  >
    <template #prepend>
      <q-icon
        name="code"
        size="18px"
      />
    </template>
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey">
          {{ t('snippetsPanel.noLanguagesFound') || 'No languages found' }}
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</div>
```

### 6. Add CSS (in scoped styles)

```scss
&__language-filter {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
  flex-shrink: 0;
}

&__language-select {
  :deep(.q-field__native) {
    font-size: 12px;
    min-height: 24px;
  }

  :deep(.q-field__control) {
    min-height: 32px;
  }

  :deep(.q-field__prepend) {
    padding-right: 8px;
  }
}
```

## Verification

- Language filter appears after tags filter
- Single selection filters snippet list
- Clear button resets filter
- Filter is searchable
- Only shows if snippets have languages

```

---

### Task 8: Add Language Field to NewSnippetDialog.vue

**Purpose:** Allow users to specify a language when creating new snippets.

**Objective:** Add a language dropdown field to the new snippet creation form.

**Architecture Description:**
- File: `src/components/dialogs/NewSnippetDialog.vue`
- Location: After tags field in the form
- Type: Single-select optional dropdown
- Import: Use SNIPPET_LANGUAGES from constants
- Emit: Include language in create event payload

**Files to Modify:**
- `src/components/dialogs/NewSnippetDialog.vue`

**Full Prompt:**
```

# Task: Add Language Field to NewSnippetDialog

## Context

You are adding language selection to the new snippet creation dialog.

## Objective

Add an optional language dropdown that allows selecting a programming language for the snippet.

## File to Modify

`src/components/dialogs/NewSnippetDialog.vue`

## Changes Required

### 1. Add Import

```typescript
import { getLanguageOptions } from '@/constants/languages';
```

### 2. Add State (after tags ref)

```typescript
const language = ref<string | null>(null);
```

### 3. Add Computed for Language Options

```typescript
// Language options for dropdown
const languageOptions = computed(() => getLanguageOptions());

// Filtered language options for search
const filteredLanguageOptions = ref<{ value: string; label: string }[]>([]);

// Filter function for language select
function filterLanguages(val: string, update: (fn: () => void) => void): void {
  update(() => {
    if (val === '') {
      filteredLanguageOptions.value = languageOptions.value;
    } else {
      const needle = val.toLowerCase();
      filteredLanguageOptions.value = languageOptions.value.filter((opt) =>
        opt.label.toLowerCase().includes(needle)
      );
    }
  });
}
```

### 4. Update Reset Function

```typescript
function resetForm(): void {
  snippetType.value = 'text';
  snippetName.value = '';
  snippetDescription.value = '';
  tags.value = [];
  language.value = null; // ADD THIS
}
```

### 5. Update Create Handler (emit payload)

```typescript
function createSnippet(): void {
  if (!snippetName.value.trim()) return;

  emit('create', {
    name: snippetName.value.trim(),
    type: snippetType.value,
    description: snippetDescription.value.trim(),
    tags: tags.value,
    language: language.value, // ADD THIS
  });

  resetForm();
  isOpen.value = false;
}
```

### 6. Update Emit Type Definition

```typescript
const emit = defineEmits<{
  (
    e: 'create',
    data: {
      name: string;
      type: ISnippetMetadata['type'];
      description: string;
      tags: string[];
      language: string | null; // ADD THIS
    }
  ): void;
}>();
```

### 7. Add Template (after tags field)

```vue
<!-- Language -->
<q-select
  v-model="language"
  :options="filteredLanguageOptions"
  option-value="value"
  option-label="label"
  emit-value
  map-options
  clearable
  dense
  outlined
  use-input
  input-debounce="0"
  :label="t('snippetsPanel.filterByLanguage') || 'Language'"
  class="q-mb-md"
  @filter="filterLanguages"
>
  <template #prepend>
    <q-icon name="code" />
  </template>
  <template #no-option>
    <q-item>
      <q-item-section class="text-grey">
        {{ t('snippetsPanel.noLanguagesFound') || 'No languages found' }}
      </q-item-section>
    </q-item>
  </template>
</q-select>
```

## Verification

- Language dropdown appears in create dialog
- Optional field (can be left empty)
- Searchable dropdown
- Language included in create event
- Form resets language on close

```

---

### Task 9: Display Language in Snippet List Items

**Purpose:** Show the language badge on snippet items in the Library pane.

**Objective:** Add a language chip/badge to each snippet item that has a language set.

**Architecture Description:**
- File: `src/components/layout/sidebar/SnippetsPanel.vue`
- Location: In snippet item, after tags display
- Style: Outline chip, matches tag styling
- Conditional: Only show if `snippet.metadata.language` exists

**Files to Modify:**
- `src/components/layout/sidebar/SnippetsPanel.vue`

**Full Prompt:**
```

# Task: Display Language in Snippet List Items

## Context

You are adding language display to snippet items in the Library pane.

## Objective

Show a language badge on snippets that have a language assigned.

## File to Modify

`src/components/layout/sidebar/SnippetsPanel.vue`

## Changes Required

### 1. Import Language Helper (at top of script)

```typescript
import { getLanguageLabel } from '@/constants/languages';
```

### 2. Add Template (after tags div, inside item-content)

Find the snippet item template (around line 661-676) and add after the tags div:

```vue
<!-- Language badge -->
<q-chip
  v-if="snippet.metadata.language"
  dense
  size="xs"
  outline
  color="primary"
  class="snippets-panel__item-language"
>
  {{ getLanguageLabel(snippet.metadata.language) }}
</q-chip>
```

### 3. Update Existing Tags/Language Container

Wrap both tags and language in a flex container:

```vue
<div class="snippets-panel__item-meta">
  <div
    v-if="snippet.metadata.tags.length > 0"
    class="snippets-panel__item-tags"
  >
    <q-chip
      v-for="tag in snippet.metadata.tags"
      :key="tag"
      dense
      size="xs"
      outline
      class="snippets-panel__item-tag"
    >
      {{ tag }}
    </q-chip>
  </div>
  <!-- Language badge -->
  <q-chip
    v-if="snippet.metadata.language"
    dense
    size="xs"
    outline
    color="primary"
    class="snippets-panel__item-language"
  >
    {{ getLanguageLabel(snippet.metadata.language) }}
  </q-chip>
</div>
```

### 4. Add/Update CSS

```scss
&__item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
}

&__item-language {
  font-size: 9px !important;
  height: 16px !important;
  min-height: 16px !important;
  padding: 0 6px !important;

  :deep(.q-chip__content) {
    font-size: 9px;
  }
}
```

## Verification

- Language badge appears for snippets with language
- Badge has primary outline color to distinguish from tags
- Displays readable label (e.g., "JavaScript" not "javascript")
- Does not show if no language set

```

---

### Task 10: Update Snippet File Parsing/Saving for Language Field

**Purpose:** Ensure the language field is properly read from and written to snippet files.

**Objective:** Update snippet parsing and saving logic to handle the language metadata field.

**Architecture Description:**
- Files: Snippet service files that handle reading/writing
- Frontmatter: Add `language` field to YAML frontmatter
- Parse: Extract language when loading snippets
- Save: Include language when saving snippets

**Files to Modify:**
- `src/services/file-system/prompt-file.service.ts` (if handles snippets)
- `src/stores/snippetStore.ts` (createSnippet, updateSnippetMetadata methods)

**Full Prompt:**
```

# Task: Update Snippet Parsing/Saving for Language

## Context

You are ensuring the language field is persisted in snippet files.

## Objective

Update snippet creation and metadata update to include the language field.

## Files to Investigate and Modify

1. `src/stores/snippetStore.ts`
2. Any snippet file service that handles frontmatter parsing

## Changes Required

### 1. Update snippetStore.ts - createSnippet Method

Find the createSnippet method and update to include language:

```typescript
async function createSnippet(
  name: string,
  type: ISnippetMetadata['type'],
  content: string = '',
  tags: string[] = [],
  language?: string // ADD PARAMETER
): Promise<ISnippetFile> {
  // ... existing validation ...

  const metadata: ISnippetMetadata = {
    id: generateId(),
    name,
    type,
    shortcut: generateShortcut(name, type),
    description: '',
    tags,
    language, // ADD THIS
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ... rest of method ...
}
```

### 2. Update Caller in SnippetsPanel.vue

Update handleCreateSnippet to pass language:

```typescript
async function handleCreateSnippet(data: {
  name: string;
  type: ISnippetMetadata['type'];
  description: string;
  tags: string[];
  language: string | null;
}): Promise<void> {
  try {
    await snippetStore.createSnippet(
      data.name,
      data.type,
      '',
      data.tags,
      data.language ?? undefined // ADD THIS
    );
  } catch (err) {
    console.error('Failed to create snippet:', err);
  }
}
```

### 3. Verify Frontmatter Generation

Check the snippet file service generates proper frontmatter:

```yaml
---
id: abc123
name: My Snippet
type: code
shortcut: @my-snippet
description: A code snippet
tags:
  - javascript
  - utility
language: javascript
createdAt: 2024-01-01T00:00:00.000Z
updatedAt: 2024-01-01T00:00:00.000Z
---

Content here...
```

### 4. Verify Frontmatter Parsing

Ensure the snippet parser extracts the language field when reading files.

## Verification

- New snippets include language in frontmatter when set
- Existing snippets without language still work
- Language field is loaded when opening snippet files
- Language field is preserved when updating snippet metadata

```

---

## 4. Implementation Order

### Recommended Sequence

1. **Task 1** - Add type field (foundation)
2. **Task 2** - Create constants (needed by other tasks)
3. **Task 3** - Add i18n strings (needed by UI)
4. **Task 10** - Update file handling (before UI touches data)
5. **Task 4** - Add pluginStore filter logic
6. **Task 5** - Add marketplace UI filter
7. **Task 6** - Display in plugin cards
8. **Task 7** - Add snippets panel filter
9. **Task 8** - Add to new snippet dialog
10. **Task 9** - Display in snippet items

### Dependencies

```

Task 1 ──┬──► Task 10 ──► Task 7 ──► Task 9
│ │
│ └──► Task 8
│
Task 2 ──┼──► Task 8
│
Task 3 ──┼──► Task 5
│ Task 6
│ Task 7
│ Task 8
│
Task 4 ──┴──► Task 5 ──► Task 6

```

---

## 5. Testing Checklist

### Library Dialog (Marketplace)
- [ ] Language filter dropdown appears
- [ ] Selecting language filters plugin list
- [ ] Plugins with items matching language are shown
- [ ] Clear filter shows all plugins
- [ ] Plugin cards display languages
- [ ] Plugin viewer shows item languages

### Library Pane (Snippets)
- [ ] Language filter dropdown appears (if snippets have languages)
- [ ] Selecting language filters snippet list
- [ ] Snippet items display language badge
- [ ] New snippet dialog has language field
- [ ] Created snippets save language
- [ ] Existing snippets without language still work

### Cross-cutting
- [ ] All i18n strings display correctly
- [ ] Filter clear buttons reset language
- [ ] No TypeScript errors
- [ ] No console errors
```
