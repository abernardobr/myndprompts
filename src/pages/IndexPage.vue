<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n({ useScope: 'global' });
</script>

<template>
  <q-page
    class="flex flex-center"
    padding
    data-testid="index-page"
  >
    <div class="text-center">
      <q-icon
        name="edit_note"
        size="128px"
        color="primary"
      />
      <h4 class="q-my-md">{{ t('welcome.title') }}</h4>
      <p class="text-grey">{{ t('welcome.subtitle') }}</p>
    </div>
  </q-page>
</template>
