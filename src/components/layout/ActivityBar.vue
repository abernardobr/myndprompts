<script setup lang="ts">
/**
 * ActivityBar Component
 *
 * VSCode-like activity bar on the left side of the application.
 * Contains icons for switching between different views.
 */

import { computed } from 'vue';
import { useUIStore, type ActivityView } from '@/stores/uiStore';

const uiStore = useUIStore();

interface ActivityItem {
  id: ActivityView;
  icon: string;
  label: string;
  shortcut?: string;
}

const activities: ActivityItem[] = [
  { id: 'explorer', icon: 'folder', label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
  { id: 'search', icon: 'search', label: 'Search', shortcut: 'Ctrl+Shift+F' },
  { id: 'snippets', icon: 'code', label: 'Snippets', shortcut: 'Ctrl+Shift+S' },
  { id: 'favorites', icon: 'star', label: 'Favorites', shortcut: 'Ctrl+Shift+D' },
  { id: 'git', icon: 'git', label: 'Source Control', shortcut: 'Ctrl+Shift+G' },
];

const bottomActivities: ActivityItem[] = [
  { id: 'settings', icon: 'settings', label: 'Settings', shortcut: 'Ctrl+,' },
];

const activeActivity = computed(() => uiStore.activeActivity);

function handleActivityClick(activity: ActivityView): void {
  uiStore.setActiveActivity(activity);
}

function isActive(activity: ActivityView): boolean {
  return activeActivity.value === activity && !uiStore.sidebarCollapsed;
}
</script>

<template>
  <div class="activity-bar">
    <!-- Logo -->
    <div class="activity-bar__logo">
      <img
        src="@/assets/images/logo-icon.png"
        alt="MyndPrompts"
        class="activity-bar__logo-img"
      />
      <q-tooltip
        anchor="center right"
        self="center left"
        :offset="[10, 0]"
      >
        MyndPrompts
      </q-tooltip>
    </div>

    <div class="activity-bar__top">
      <q-btn
        v-for="item in activities"
        :key="item.id"
        flat
        dense
        square
        :icon="item.icon"
        :class="['activity-bar__item', { 'activity-bar__item--active': isActive(item.id) }]"
        @click="handleActivityClick(item.id)"
      >
        <q-tooltip
          anchor="center right"
          self="center left"
          :offset="[10, 0]"
        >
          {{ item.label }}
          <span
            v-if="item.shortcut"
            class="text-grey-5 q-ml-sm"
            >{{ item.shortcut }}</span
          >
        </q-tooltip>
      </q-btn>
    </div>

    <div class="activity-bar__bottom">
      <q-btn
        v-for="item in bottomActivities"
        :key="item.id"
        flat
        dense
        square
        :icon="item.icon"
        :class="['activity-bar__item', { 'activity-bar__item--active': isActive(item.id) }]"
        @click="handleActivityClick(item.id)"
      >
        <q-tooltip
          anchor="center right"
          self="center left"
          :offset="[10, 0]"
        >
          {{ item.label }}
          <span
            v-if="item.shortcut"
            class="text-grey-5 q-ml-sm"
            >{{ item.shortcut }}</span
          >
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.activity-bar {
  display: flex;
  flex-direction: column;
  width: 48px;
  height: 100%;
  min-height: 0; // Allow shrinking in flex/grid contexts
  background-color: var(--activity-bar-bg, #333333);
  border-right: 1px solid var(--border-color, #252526);
  overflow: hidden; // Prevent content from overflowing

  &__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    cursor: pointer;
    flex-shrink: 0;

    &-img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }
  }

  &__top {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-height: 0; // Allow shrinking
    overflow-y: auto; // Allow scrolling if needed
    overflow-x: hidden;

    // Hide scrollbar but keep functionality
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0; // Never shrink the bottom section
  }

  &__item {
    width: 48px;
    height: 48px;
    color: var(--activity-bar-icon, #858585);
    border-left: 2px solid transparent;
    border-radius: 0;

    &:hover {
      color: var(--activity-bar-icon-hover, #ffffff);
    }

    &--active {
      color: var(--activity-bar-icon-active, #ffffff);
      border-left-color: var(--activity-bar-indicator, #007acc);
    }
  }
}

// Light theme overrides
.body--light .activity-bar {
  --activity-bar-bg: #2c2c2c;
  --activity-bar-icon: #858585;
  --activity-bar-icon-hover: #ffffff;
  --activity-bar-icon-active: #ffffff;
  --activity-bar-indicator: #007acc;
  --border-color: #252526;
}

// Dark theme overrides
.body--dark .activity-bar {
  --activity-bar-bg: #333333;
  --activity-bar-icon: #858585;
  --activity-bar-icon-hover: #ffffff;
  --activity-bar-icon-active: #ffffff;
  --activity-bar-indicator: #007acc;
  --border-color: #252526;
}
</style>
