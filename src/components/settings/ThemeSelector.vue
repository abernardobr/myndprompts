<script setup lang="ts">
/**
 * Theme Selector Component
 *
 * Provides UI for selecting between light, dark, and system themes.
 * Can be rendered as a button toggle group or a dropdown menu.
 */

import { computed } from 'vue';
import { useTheme, type ThemeMode } from '@/composables/useTheme';

interface Props {
  /**
   * Display variant: 'toggle' for button group, 'menu' for dropdown, 'icon' for icon-only
   */
  variant?: 'toggle' | 'menu' | 'icon';
  /**
   * Size of the component
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Show labels (for toggle and menu variants)
   */
  showLabels?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'toggle',
  size: 'md',
  showLabels: true,
});

const { themeMode, isDark, setTheme, toggleTheme, cycleTheme: _cycleTheme } = useTheme();

const themeOptions = [
  {
    value: 'light' as ThemeMode,
    label: 'Light',
    icon: 'mdi-white-balance-sunny',
  },
  {
    value: 'dark' as ThemeMode,
    label: 'Dark',
    icon: 'mdi-moon-waning-crescent',
  },
  {
    value: 'system' as ThemeMode,
    label: 'System',
    icon: 'mdi-laptop',
  },
];

const currentThemeOption = computed(() => {
  return themeOptions.find((opt) => opt.value === themeMode.value) ?? themeOptions[2];
});

const toggleSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'sm';
    case 'lg':
      return 'lg';
    default:
      return 'md';
  }
});

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return '18px';
    case 'lg':
      return '28px';
    default:
      return '22px';
  }
});

function handleToggleChange(value: ThemeMode): void {
  setTheme(value);
}
</script>

<template>
  <!-- Toggle Button Group -->
  <q-btn-toggle
    v-if="variant === 'toggle'"
    :model-value="themeMode"
    :options="
      themeOptions.map((opt) => ({
        value: opt.value,
        label: showLabels ? opt.label : undefined,
        icon: opt.icon,
        'aria-label': opt.label,
      }))
    "
    toggle-color="primary"
    flat
    spread
    no-caps
    :size="toggleSize"
    class="theme-toggle"
    @update:model-value="handleToggleChange"
  />

  <!-- Dropdown Menu -->
  <q-btn-dropdown
    v-else-if="variant === 'menu'"
    flat
    no-caps
    :size="toggleSize"
    class="theme-menu"
  >
    <template #label>
      <q-icon
        :name="currentThemeOption.icon"
        :size="iconSize"
        class="q-mr-sm"
      />
      <span v-if="showLabels">{{ currentThemeOption.label }}</span>
    </template>

    <q-list>
      <q-item
        v-for="option in themeOptions"
        :key="option.value"
        v-close-popup
        clickable
        :active="themeMode === option.value"
        @click="setTheme(option.value)"
      >
        <q-item-section avatar>
          <q-icon :name="option.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ option.label }}</q-item-label>
        </q-item-section>
        <q-item-section
          v-if="themeMode === option.value"
          side
        >
          <q-icon
            name="mdi-check"
            color="primary"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>

  <!-- Icon Only (cycles through themes on click) -->
  <q-btn
    v-else-if="variant === 'icon'"
    flat
    round
    :size="toggleSize"
    :icon="isDark ? 'mdi-moon-waning-crescent' : 'mdi-white-balance-sunny'"
    :aria-label="`Current theme: ${currentThemeOption.label}. Click to toggle.`"
    @click="toggleTheme"
  >
    <q-tooltip>
      Theme: {{ currentThemeOption.label }}
      <br />
      <span class="text-caption">Ctrl+Shift+T to toggle</span>
    </q-tooltip>
  </q-btn>
</template>

<style lang="scss" scoped>
.theme-toggle {
  border: 1px solid var(--mp-border-color);
  border-radius: 6px;
  overflow: hidden;

  :deep(.q-btn) {
    border-radius: 0;

    &.q-btn--active {
      background-color: var(--mp-accent-subtle);
    }
  }
}

.theme-menu {
  :deep(.q-btn__content) {
    gap: 4px;
  }
}
</style>
