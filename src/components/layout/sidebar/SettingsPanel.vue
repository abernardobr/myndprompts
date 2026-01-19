<script setup lang="ts">
/**
 * SettingsPanel Component
 *
 * Quick access to application settings.
 * Full settings will be in a dedicated settings page.
 */

import { computed, ref, onMounted } from 'vue';
import { useUIStore, type Theme } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useI18n } from 'vue-i18n';
import CategoryListEditor from '@/components/settings/CategoryListEditor.vue';
import FileSyncSection from '@/components/settings/FileSyncSection.vue';

const { t, locale: i18nLocale } = useI18n({ useScope: 'global' });
const uiStore = useUIStore();
const settingsStore = useSettingsStore();

// Expanded sections state
const expandedSections = ref<Set<string>>(new Set(['appearance', 'categories']));

const currentTheme = computed(() => uiStore.theme);
const currentLocale = computed(() => uiStore.locale);

// Available languages with their native names and icons/flags
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

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'system', label: 'System', icon: 'settings_brightness' },
];

function setTheme(theme: Theme): void {
  uiStore.setTheme(theme);
}

function setLocale(newLocale: string): void {
  uiStore.setLocale(newLocale);
  // Update vue-i18n locale
  i18nLocale.value = newLocale;
}

function toggleSection(sectionId: string): void {
  if (expandedSections.value.has(sectionId)) {
    expandedSections.value.delete(sectionId);
  } else {
    expandedSections.value.add(sectionId);
  }
}

function isSectionExpanded(sectionId: string): boolean {
  return expandedSections.value.has(sectionId);
}

// Settings item types
interface ISettingsItem {
  id: string;
  label: string;
  type?: string;
  value?: string;
}

interface ISettingsSection {
  id: string;
  label: string;
  icon: string;
  type?: string;
  items?: ISettingsItem[];
}

const settingsSections = computed<ISettingsSection[]>(() => [
  {
    id: 'appearance',
    label: t('settingsPanel.appearance'),
    icon: 'palette',
    items: [
      { id: 'theme', label: t('settingsPanel.theme'), type: 'theme' },
      { id: 'language', label: t('settingsPanel.language'), type: 'language' },
    ],
  },
  {
    id: 'categories',
    label: t('settingsPanel.promptCategories'),
    icon: 'category',
    type: 'categories',
  },
  {
    id: 'fileSync',
    label: t('fileSync.title'),
    icon: 'sync',
    type: 'fileSync',
  },
  {
    id: 'editor',
    label: t('settingsPanel.editor'),
    icon: 'edit',
    items: [
      { id: 'font-size', label: t('settingsPanel.fontSize'), value: '14px' },
      { id: 'word-wrap', label: t('settingsPanel.wordWrap'), value: t('settingsPanel.on') },
    ],
  },
  {
    id: 'storage',
    label: t('settingsPanel.storage'),
    icon: 'folder',
    items: [{ id: 'location', label: t('settingsPanel.storageLocation'), value: '~/MyndPrompts' }],
  },
]);

// Initialize settings store on mount
onMounted(async () => {
  if (!settingsStore.isInitialized) {
    await settingsStore.initialize();
  }
});
</script>

<template>
  <div
    class="settings-panel"
    data-testid="settings-panel"
  >
    <div class="settings-panel__content">
      <div
        v-for="section in settingsSections"
        :key="section.id"
        class="settings-panel__section"
        :data-testid="`${section.id}-section`"
      >
        <div
          class="settings-panel__section-header"
          :class="{
            'settings-panel__section-header--clickable':
              section.type === 'categories' || section.type === 'fileSync',
          }"
          data-testid="settings-header"
          @click="
            section.type === 'categories' || section.type === 'fileSync'
              ? toggleSection(section.id)
              : undefined
          "
        >
          <q-icon
            :name="section.icon"
            size="18px"
          />
          <span>{{ section.label }}</span>
          <q-space />
          <q-icon
            v-if="section.type === 'categories' || section.type === 'fileSync'"
            :name="isSectionExpanded(section.id) ? 'expand_less' : 'expand_more'"
            size="18px"
            class="settings-panel__section-toggle"
          />
        </div>

        <!-- Categories section -->
        <div
          v-if="section.type === 'categories'"
          v-show="isSectionExpanded(section.id)"
          class="settings-panel__categories"
          data-testid="category-editor"
        >
          <CategoryListEditor />
        </div>

        <!-- File Sync section -->
        <div
          v-else-if="section.type === 'fileSync'"
          v-show="isSectionExpanded(section.id)"
          class="settings-panel__file-sync"
        >
          <FileSyncSection />
        </div>

        <!-- Regular items -->
        <div
          v-else-if="section.items"
          class="settings-panel__items"
        >
          <div
            v-for="item in section.items"
            :key="item.id"
            class="settings-panel__item"
          >
            <span class="settings-panel__item-label">{{ item.label }}</span>

            <!-- Theme selector -->
            <div
              v-if="item.type === 'theme'"
              class="settings-panel__theme-selector"
              data-testid="theme-selector"
            >
              <q-btn-toggle
                :model-value="currentTheme"
                toggle-color="primary"
                size="sm"
                :options="themeOptions.map((opt) => ({ value: opt.value, slot: opt.value }))"
                @update:model-value="setTheme"
              >
                <template
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  #[opt.value]
                >
                  <q-icon
                    :name="opt.icon"
                    size="16px"
                  />
                  <q-tooltip>{{ opt.label }}</q-tooltip>
                </template>
              </q-btn-toggle>
            </div>

            <!-- Language selector -->
            <div
              v-else-if="item.type === 'language'"
              class="settings-panel__language-selector"
              data-testid="language-selector"
            >
              <q-select
                :model-value="currentLocale"
                :options="languageOptions"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                dense
                outlined
                class="settings-panel__language-select"
                @update:model-value="setLocale"
              >
                <template #selected-item="{ opt }">
                  <span class="settings-panel__language-option">
                    <span class="settings-panel__language-flag">{{ opt.icon }}</span>
                    <span>{{ opt.label }}</span>
                  </span>
                </template>
                <template #option="{ itemProps, opt }">
                  <q-item v-bind="itemProps">
                    <q-item-section>
                      <span class="settings-panel__language-option">
                        <span class="settings-panel__language-flag">{{ opt.icon }}</span>
                        <span>{{ opt.label }}</span>
                      </span>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- Static value display -->
            <span
              v-else
              class="settings-panel__item-value"
            >
              {{ item.value }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  &__section {
    margin-bottom: 16px;
  }

  &__section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--section-header-color, #bbbbbb);

    &--clickable {
      cursor: pointer;
      border-radius: 4px;
      margin: 0 8px;
      padding: 8px;

      &:hover {
        background-color: var(--item-hover-bg, #2a2d2e);
      }
    }
  }

  &__section-toggle {
    opacity: 0.7;
  }

  &__categories {
    padding: 0 16px 8px;
  }

  &__file-sync {
    padding: 0 8px;
  }

  &__items {
    padding: 0 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background-color: var(--item-hover-bg, #2a2d2e);
    }
  }

  &__item-label {
    font-size: 13px;
    color: var(--item-label-color, #cccccc);
  }

  &__item-value {
    font-size: 12px;
    color: var(--item-value-color, #858585);
  }

  &__theme-selector {
    :deep(.q-btn-toggle) {
      border: 1px solid var(--toggle-border, #3c3c3c);
      border-radius: 4px;
    }
  }

  &__language-selector {
    flex-shrink: 0;
    min-width: 160px;
  }

  &__language-select {
    :deep(.q-field__control) {
      min-height: 32px;
      padding: 0 8px;
    }

    :deep(.q-field__native) {
      padding: 0;
    }

    :deep(.q-field__marginal) {
      height: 32px;
    }
  }

  &__language-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  &__language-flag {
    font-size: 16px;
    line-height: 1;
  }
}

// Light theme
.body--light .settings-panel {
  --section-header-color: #6f6f6f;
  --item-hover-bg: #e8e8e8;
  --item-label-color: #3b3b3b;
  --item-value-color: #6f6f6f;
  --toggle-border: #e7e7e7;
  --border-color: #e7e7e7;
}

// Dark theme
.body--dark .settings-panel {
  --section-header-color: #bbbbbb;
  --item-hover-bg: #2a2d2e;
  --item-label-color: #cccccc;
  --item-value-color: #858585;
  --toggle-border: #3c3c3c;
  --border-color: #3c3c3c;
}
</style>
