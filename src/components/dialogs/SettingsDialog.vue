<script setup lang="ts">
/**
 * SettingsDialog Component
 *
 * Full settings dialog similar to WebStorm/VSCode.
 * Features:
 * - Left sidebar with category navigation (tree structure)
 * - Right content area showing selected category settings
 * - Search functionality
 * - Cancel, Apply, OK buttons
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useUIStore, type Theme, FileCategory } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePluginStore } from '@/stores/pluginStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { useI18n } from 'vue-i18n';
import CategoryListEditor from '@/components/settings/CategoryListEditor.vue';
import FileSyncSection from '@/components/settings/FileSyncSection.vue';
import PluginsSection from '@/components/settings/PluginsSection.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t, locale: i18nLocale } = useI18n({ useScope: 'global' });
const uiStore = useUIStore();
const settingsStore = useSettingsStore();
const pluginStore = usePluginStore();
const snippetStore = useSnippetStore();

// Dialog visibility
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// Search query
const searchQuery = ref('');

// Currently selected category
const selectedCategory = ref('appearance');

// Track if settings have changed
const hasChanges = ref(false);

// Theme and locale
const currentTheme = computed(() => uiStore.theme);
const currentLocale = computed(() => uiStore.locale);

// Language options
const languageOptions = computed(() => [
  { value: 'en-US', label: t('languages.en-US'), icon: '🇺🇸' },
  { value: 'en-GB', label: t('languages.en-GB'), icon: '🇬🇧' },
  { value: 'en-IE', label: t('languages.en-IE'), icon: '🇮🇪' },
  { value: 'pt-BR', label: t('languages.pt-BR'), icon: '🇧🇷' },
  { value: 'pt-PT', label: t('languages.pt-PT'), icon: '🇵🇹' },
  { value: 'es-ES', label: t('languages.es-ES'), icon: '🇪🇸' },
  { value: 'fr-FR', label: t('languages.fr-FR'), icon: '🇫🇷' },
  { value: 'de-DE', label: t('languages.de-DE'), icon: '🇩🇪' },
  { value: 'it-IT', label: t('languages.it-IT'), icon: '🇮🇹' },
  { value: 'ar-SA', label: t('languages.ar-SA'), icon: '🇸🇦' },
]);

// Theme options
const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'system', label: 'System', icon: 'settings_brightness' },
];

// Category tree structure
interface ICategory {
  id: string;
  label: string;
  icon: string;
  children?: ICategory[];
}

const categories = computed<ICategory[]>(() => [
  {
    id: 'appearance',
    label: t('settingsPanel.appearance'),
    icon: 'palette',
    children: [
      { id: 'theme', label: t('settingsPanel.theme'), icon: 'dark_mode' },
      { id: 'language', label: t('settingsPanel.language'), icon: 'translate' },
    ],
  },
  {
    id: 'editor',
    label: t('settingsPanel.editor'),
    icon: 'edit',
  },
  {
    id: 'categories',
    label: t('settingsPanel.promptCategories'),
    icon: 'category',
  },
  {
    id: 'fileSync',
    label: t('fileSync.title'),
    icon: 'sync',
  },
  {
    id: 'plugins',
    label: t('plugins.title') || 'Plugins',
    icon: 'mdi-puzzle-outline',
  },
  {
    id: 'storage',
    label: t('settingsPanel.storage'),
    icon: 'folder',
  },
]);

// Expanded categories in tree
const expandedCategories = ref<Set<string>>(new Set(['appearance']));

function toggleCategory(categoryId: string): void {
  if (expandedCategories.value.has(categoryId)) {
    expandedCategories.value.delete(categoryId);
  } else {
    expandedCategories.value.add(categoryId);
  }
}

function selectCategory(categoryId: string): void {
  selectedCategory.value = categoryId;
}

function setTheme(theme: Theme): void {
  uiStore.setTheme(theme);
  hasChanges.value = true;
}

function setLocale(newLocale: string): void {
  uiStore.setLocale(newLocale);
  i18nLocale.value = newLocale;
  hasChanges.value = true;
}

function handleCancel(): void {
  // TODO: Revert changes if needed
  isOpen.value = false;
}

function handleApply(): void {
  // Settings are already applied in real-time
  hasChanges.value = false;
}

function handleOk(): void {
  handleApply();
  isOpen.value = false;
}

/**
 * Handle opening a snippet from the plugins section.
 * Finds the snippet by title, closes the dialog, and opens it in the editor.
 */
async function handleOpenSnippet(itemTitle: string): Promise<void> {
  try {
    // Find the snippet by its name/title
    const allSnippets = snippetStore.allSnippets;
    const matchingSnippet = allSnippets.find((snippet) => snippet.metadata.name === itemTitle);

    if (matchingSnippet) {
      // Load the snippet to get full data
      const loadedSnippet = await snippetStore.loadSnippet(matchingSnippet.filePath);

      // Open a tab for the snippet
      uiStore.openTab({
        filePath: loadedSnippet.filePath,
        fileName: loadedSnippet.fileName,
        title: loadedSnippet.metadata.name,
        isDirty: false,
        isPinned: false,
        fileCategory: FileCategory.MARKDOWN,
      });

      // Close the settings dialog
      isOpen.value = false;
    } else {
      console.warn(`[SettingsDialog] Snippet "${itemTitle}" not found`);
    }
  } catch (error) {
    console.error('[SettingsDialog] Failed to open snippet:', error);
  }
}

// Get breadcrumb path for selected category
const breadcrumb = computed(() => {
  for (const cat of categories.value) {
    if (cat.id === selectedCategory.value) {
      return [cat.label];
    }
    if (cat.children) {
      for (const child of cat.children) {
        if (child.id === selectedCategory.value) {
          return [cat.label, child.label];
        }
      }
    }
  }
  return [];
});

// Initialize settings store
onMounted(async () => {
  if (!settingsStore.isInitialized) {
    await settingsStore.initialize();
  }
});

// Reset selection when dialog opens
watch(isOpen, (open) => {
  if (open) {
    selectedCategory.value = 'appearance';
    searchQuery.value = '';
    hasChanges.value = false;
  }
});
</script>

<template>
  <Teleport to="body">
    <q-dialog
      v-model="isOpen"
      persistent
      maximized
      transition-show="fade"
      transition-hide="fade"
      class="settings-dialog-wrapper"
    >
      <q-card class="settings-dialog">
        <!-- Header -->
        <q-card-section class="settings-dialog__header">
          <div class="settings-dialog__title">{{ t('settingsPanel.title') || 'Settings' }}</div>
          <q-btn
            flat
            dense
            round
            icon="close"
            class="settings-dialog__close"
            @click="handleCancel"
          />
        </q-card-section>

        <q-separator />

        <!-- Main content -->
        <q-card-section class="settings-dialog__main">
          <!-- Left sidebar -->
          <div class="settings-dialog__sidebar">
            <!-- Search -->
            <div class="settings-dialog__search">
              <q-input
                v-model="searchQuery"
                dense
                outlined
                placeholder="Search settings..."
                class="settings-dialog__search-input"
              >
                <template #prepend>
                  <q-icon
                    name="search"
                    size="18px"
                  />
                </template>
              </q-input>
            </div>

            <!-- Category tree -->
            <div class="settings-dialog__tree">
              <template
                v-for="category in categories"
                :key="category.id"
              >
                <!-- Parent category -->
                <div
                  :class="[
                    'settings-dialog__tree-item',
                    {
                      'settings-dialog__tree-item--selected': selectedCategory === category.id,
                      'settings-dialog__tree-item--parent': category.children,
                    },
                  ]"
                  @click="
                    category.children ? toggleCategory(category.id) : selectCategory(category.id)
                  "
                >
                  <q-icon
                    v-if="category.children"
                    :name="expandedCategories.has(category.id) ? 'expand_more' : 'chevron_right'"
                    size="18px"
                    class="settings-dialog__tree-arrow"
                  />
                  <q-icon
                    :name="category.icon"
                    size="18px"
                    class="settings-dialog__tree-icon"
                  />
                  <span class="settings-dialog__tree-label">{{ category.label }}</span>
                </div>

                <!-- Children -->
                <template v-if="category.children && expandedCategories.has(category.id)">
                  <div
                    v-for="child in category.children"
                    :key="child.id"
                    :class="[
                      'settings-dialog__tree-item',
                      'settings-dialog__tree-item--child',
                      { 'settings-dialog__tree-item--selected': selectedCategory === child.id },
                    ]"
                    @click="selectCategory(child.id)"
                  >
                    <q-icon
                      :name="child.icon"
                      size="18px"
                      class="settings-dialog__tree-icon"
                    />
                    <span class="settings-dialog__tree-label">{{ child.label }}</span>
                  </div>
                </template>
              </template>
            </div>
          </div>

          <!-- Right content -->
          <div class="settings-dialog__content">
            <!-- Breadcrumb -->
            <div class="settings-dialog__breadcrumb">
              <div class="settings-dialog__breadcrumb-path">
                <span
                  v-for="(crumb, index) in breadcrumb"
                  :key="index"
                >
                  <span>{{ crumb }}</span>
                  <q-icon
                    v-if="index < breadcrumb.length - 1"
                    name="chevron_right"
                    size="16px"
                    class="settings-dialog__breadcrumb-separator"
                  />
                </span>
              </div>
              <!-- Refresh button for Plugins section -->
              <q-btn
                v-if="selectedCategory === 'plugins' && pluginStore.isInitialized"
                flat
                dense
                round
                icon="mdi-refresh"
                size="sm"
                color="grey"
                :loading="pluginStore.isLoading"
                @click="pluginStore.refreshMarketplace(true)"
              >
                <q-tooltip>{{ t('common.refresh') || 'Refresh' }}</q-tooltip>
              </q-btn>
            </div>

            <!-- Settings content -->
            <div class="settings-dialog__settings">
              <!-- Appearance / Theme -->
              <template v-if="selectedCategory === 'appearance' || selectedCategory === 'theme'">
                <div class="settings-dialog__section">
                  <div class="settings-dialog__section-title">{{ t('settingsPanel.theme') }}</div>
                  <div class="settings-dialog__setting">
                    <span class="settings-dialog__setting-label">Theme:</span>
                    <q-select
                      :model-value="currentTheme"
                      :options="themeOptions"
                      option-value="value"
                      option-label="label"
                      emit-value
                      map-options
                      dense
                      outlined
                      class="settings-dialog__select"
                      @update:model-value="setTheme"
                    >
                      <template #selected-item="{ opt }">
                        <q-icon
                          :name="opt.icon"
                          size="18px"
                          class="q-mr-sm"
                        />
                        {{ opt.label }}
                      </template>
                      <template #option="{ itemProps, opt }">
                        <q-item v-bind="itemProps">
                          <q-item-section avatar>
                            <q-icon
                              :name="opt.icon"
                              size="18px"
                            />
                          </q-item-section>
                          <q-item-section>{{ opt.label }}</q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>
                </div>
              </template>

              <!-- Language -->
              <template v-if="selectedCategory === 'appearance' || selectedCategory === 'language'">
                <div class="settings-dialog__section">
                  <div class="settings-dialog__section-title">
                    {{ t('settingsPanel.language') }}
                  </div>
                  <div class="settings-dialog__setting">
                    <span class="settings-dialog__setting-label">Language:</span>
                    <q-select
                      :model-value="currentLocale"
                      :options="languageOptions"
                      option-value="value"
                      option-label="label"
                      emit-value
                      map-options
                      dense
                      outlined
                      class="settings-dialog__select"
                      @update:model-value="setLocale"
                    >
                      <template #selected-item="{ opt }">
                        <span class="settings-dialog__language-option">
                          <span class="settings-dialog__language-flag">{{ opt.icon }}</span>
                          <span>{{ opt.label }}</span>
                        </span>
                      </template>
                      <template #option="{ itemProps, opt }">
                        <q-item v-bind="itemProps">
                          <q-item-section>
                            <span class="settings-dialog__language-option">
                              <span class="settings-dialog__language-flag">{{ opt.icon }}</span>
                              <span>{{ opt.label }}</span>
                            </span>
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>
                </div>
              </template>

              <!-- Editor settings -->
              <template v-if="selectedCategory === 'editor'">
                <div class="settings-dialog__section">
                  <div class="settings-dialog__section-title">{{ t('settingsPanel.editor') }}</div>
                  <div class="settings-dialog__setting">
                    <span class="settings-dialog__setting-label"
                      >{{ t('settingsPanel.fontSize') }}:</span
                    >
                    <span class="settings-dialog__setting-value">14px</span>
                  </div>
                  <div class="settings-dialog__setting">
                    <span class="settings-dialog__setting-label"
                      >{{ t('settingsPanel.wordWrap') }}:</span
                    >
                    <span class="settings-dialog__setting-value">{{ t('settingsPanel.on') }}</span>
                  </div>
                </div>
              </template>

              <!-- Categories -->
              <template v-if="selectedCategory === 'categories'">
                <div class="settings-dialog__section">
                  <div class="settings-dialog__section-title">
                    {{ t('settingsPanel.promptCategories') }}
                  </div>
                  <CategoryListEditor />
                </div>
              </template>

              <!-- File Sync -->
              <template v-if="selectedCategory === 'fileSync'">
                <div class="settings-dialog__section">
                  <div class="settings-dialog__section-title">{{ t('fileSync.title') }}</div>
                  <FileSyncSection />
                </div>
              </template>

              <!-- Plugins -->
              <template v-if="selectedCategory === 'plugins'">
                <PluginsSection @open-snippet="handleOpenSnippet" />
              </template>

              <!-- Storage -->
              <template v-if="selectedCategory === 'storage'">
                <div class="settings-dialog__section">
                  <div class="settings-dialog__section-title">{{ t('settingsPanel.storage') }}</div>
                  <div class="settings-dialog__setting">
                    <span class="settings-dialog__setting-label"
                      >{{ t('settingsPanel.storageLocation') }}:</span
                    >
                    <span class="settings-dialog__setting-value">~/.myndprompt</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <!-- Footer with buttons -->
        <q-card-actions
          align="right"
          class="settings-dialog__footer"
        >
          <q-btn
            flat
            :label="t('common.cancel')"
            @click="handleCancel"
          />
          <q-btn
            flat
            :label="t('common.apply') || 'Apply'"
            :disable="!hasChanges"
            @click="handleApply"
          />
          <q-btn
            color="primary"
            :label="t('common.ok') || 'OK'"
            @click="handleOk"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </Teleport>
</template>

<style lang="scss" scoped>
.settings-dialog {
  display: flex;
  flex-direction: column;
  width: 900px;
  max-width: 90vw;
  height: 700px;
  max-height: 85vh;
  margin: auto;
  background-color: var(--dialog-bg, #252526);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: var(--header-bg, #1e1e1e);
  }

  &__title {
    font-size: 16px;
    font-weight: 500;
    color: var(--title-color, #cccccc);
  }

  &__close {
    color: var(--close-color, #858585);

    &:hover {
      color: var(--close-hover-color, #ffffff);
    }
  }

  &__main {
    display: flex;
    flex: 1;
    min-height: 0;
    padding: 0;
  }

  &__sidebar {
    display: flex;
    flex-direction: column;
    width: 260px;
    min-width: 260px;
    border-right: 1px solid var(--border-color, #3c3c3c);
    background-color: var(--sidebar-bg, #1e1e1e);
  }

  &__search {
    padding: 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__search-input {
    :deep(.q-field__control) {
      background-color: var(--input-bg, #3c3c3c);
    }
  }

  &__tree {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  &__tree-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    color: var(--tree-color, #cccccc);

    &:hover {
      background-color: var(--tree-hover-bg, #2a2d2e);
    }

    &--selected {
      background-color: var(--tree-selected-bg, #094771);
      color: var(--tree-selected-color, #ffffff);
    }

    &--parent {
      font-weight: 500;
    }

    &--child {
      padding-left: 40px;
    }
  }

  &__tree-arrow {
    margin-left: -4px;
    opacity: 0.7;
  }

  &__tree-icon {
    opacity: 0.8;
  }

  &__tree-label {
    flex: 1;
    font-size: 13px;
  }

  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  &__breadcrumb {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--breadcrumb-color, #858585);
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__breadcrumb-path {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__breadcrumb-separator {
    margin: 0 4px;
    opacity: 0.5;
  }

  &__settings {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  &__section {
    margin-bottom: 24px;
  }

  &__section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--section-title-color, #cccccc);
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__setting {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 0;
  }

  &__setting-label {
    font-size: 13px;
    color: var(--label-color, #cccccc);
    min-width: 120px;
  }

  &__setting-value {
    font-size: 13px;
    color: var(--value-color, #858585);
  }

  &__select {
    min-width: 200px;
  }

  &__language-option {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__language-flag {
    font-size: 16px;
  }

  &__footer {
    padding: 12px 16px;
    background-color: var(--footer-bg, #1e1e1e);
  }
}

// Light theme
.body--light .settings-dialog {
  --dialog-bg: #f3f3f3;
  --header-bg: #e8e8e8;
  --title-color: #333333;
  --close-color: #6f6f6f;
  --close-hover-color: #333333;
  --border-color: #d4d4d4;
  --sidebar-bg: #f3f3f3;
  --input-bg: #ffffff;
  --tree-color: #333333;
  --tree-hover-bg: #e8e8e8;
  --tree-selected-bg: #0078d4;
  --tree-selected-color: #ffffff;
  --breadcrumb-color: #6f6f6f;
  --section-title-color: #333333;
  --label-color: #333333;
  --value-color: #6f6f6f;
  --footer-bg: #e8e8e8;
}

// Dark theme
.body--dark .settings-dialog {
  --dialog-bg: #252526;
  --header-bg: #1e1e1e;
  --title-color: #cccccc;
  --close-color: #858585;
  --close-hover-color: #ffffff;
  --border-color: #3c3c3c;
  --sidebar-bg: #1e1e1e;
  --input-bg: #3c3c3c;
  --tree-color: #cccccc;
  --tree-hover-bg: #2a2d2e;
  --tree-selected-bg: #094771;
  --tree-selected-color: #ffffff;
  --breadcrumb-color: #858585;
  --section-title-color: #cccccc;
  --label-color: #cccccc;
  --value-color: #858585;
  --footer-bg: #1e1e1e;
}
</style>

<style lang="scss">
// Global styles for dialog wrapper (must be non-scoped to affect Quasar's dialog container)
.settings-dialog-wrapper {
  z-index: 9999 !important;

  .q-dialog__backdrop {
    z-index: 9998 !important;
  }

  .q-dialog__inner {
    z-index: 9999 !important;
  }
}
</style>
