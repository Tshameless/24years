<script setup lang="ts">
import { provide } from 'vue';
import AppShell from '@/components/AppShell.vue';
import { createFamilyStore, familyKey } from '@/composables/useFamily';

const family = createFamilyStore();
const { identity } = family;

provide(familyKey, family);
</script>

<template>
  <AppShell>
    <RouterView :key="identity" />
  </AppShell>
</template>
