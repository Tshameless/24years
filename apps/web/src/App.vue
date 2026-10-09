<script setup lang="ts">
import { provide } from 'vue';
import AppShell from '@/components/AppShell.vue';
import { createFamilyStore, familyKey } from '@/composables/useFamily';

provide(familyKey, createFamilyStore());
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
