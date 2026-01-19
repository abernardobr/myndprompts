<script setup lang="ts">
// 404 Error page
</script>

<template>
  <q-page
    class="flex flex-center"
    data-testid="error-not-found-page"
  >
    <div class="text-center q-pa-md">
      <div class="text-h2 text-weight-bold text-grey-8">404</div>
      <div class="text-h6 text-grey">Oops. Nothing here...</div>
      <q-btn
        class="q-mt-lg"
        color="primary"
        to="/"
        label="Go Home"
        no-caps
      />
    </div>
  </q-page>
</template>
