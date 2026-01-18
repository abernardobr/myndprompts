<script setup lang="ts">
/**
 * SettingsPanel Component
 *
 * Quick access to application settings.
 * Full settings will be in a dedicated settings page.
 */

import { computed } from 'vue';
import { useUIStore, type Theme } from '@/stores/uiStore';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n();
const uiStore = useUIStore();

const currentTheme = computed(() => uiStore.theme);

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'system', label: 'System', icon: 'settings_brightness' },
];

function setTheme(theme: Theme): void {
  uiStore.setTheme(theme);
}

const settingsSections = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'palette',
    items: [{ id: 'theme', label: 'Theme', type: 'theme' }],
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: 'edit',
    items: [
      { id: 'font-size', label: 'Font Size', value: '14px' },
      { id: 'word-wrap', label: 'Word Wrap', value: 'On' },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'folder',
    items: [{ id: 'location', label: 'Storage Location', value: '~/MyndPrompts' }],
  },
];
</script>

<template>
  <div class="settings-panel">
    <div class="settings-panel__content">
      <div
        v-for="section in settingsSections"
        :key="section.id"
        class="settings-panel__section"
      >
        <div class="settings-panel__section-header">
          <q-icon
            :name="section.icon"
            size="18px"
          />
          <span>{{ section.label }}</span>
        </div>

        <div class="settings-panel__items">
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

    <div class="settings-panel__footer">
      <q-btn
        flat
        dense
        no-caps
        label="Open Full Settings"
        icon="settings"
        class="full-width"
      >
        <q-tooltip>Open settings page</q-tooltip>
      </q-btn>
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

  &__footer {
    padding: 12px;
    border-top: 1px solid var(--border-color, #3c3c3c);
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
