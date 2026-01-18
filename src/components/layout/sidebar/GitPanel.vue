<script setup lang="ts">
/**
 * GitPanel Component
 *
 * Displays source control status and history.
 * This is a placeholder - Git integration is optional for MVP.
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n();

const _isGitInitialized = ref(false);
</script>

<template>
  <div class="git-panel">
    <div class="git-panel__empty">
      <q-icon
        name="git"
        size="48px"
        class="text-grey-6 q-mb-md"
      />
      <h6 class="text-grey-5 q-mb-sm">Source Control</h6>
      <p class="text-grey-6 text-caption q-mb-md">
        Git integration is planned for future versions.
      </p>
      <p class="text-grey-7 text-caption">
        Track changes to your prompts and snippets with version control.
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.git-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    text-align: center;

    h6 {
      font-size: 14px;
      font-weight: 500;
      margin: 0;
    }

    p {
      margin: 0;
      max-width: 200px;
    }
  }
}
</style>
