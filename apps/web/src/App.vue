<script setup lang="ts">
import { provide, watch } from 'vue';
import { clearFormDrafts } from '@/composables/useFormDraft';
import AppShell from '@/components/AppShell.vue';
import ReminderCenter from '@/components/tasks/ReminderCenter.vue';
import AppUpdateNotice from '@/components/AppUpdateNotice.vue';
import { createFamilyStore, familyKey } from '@/composables/useFamily';

const family = createFamilyStore();
const { identity, cloud } = family;
let previousScope: string | undefined;
watch(
  () => [family.cloud.ready.value, identity.value, family.cloud.role.value] as const,
  ([ready, current, role]) => {
    if (!ready) {
      return;
    }

    if ((previousScope !== undefined && previousScope !== current) || role === 'viewer') {
      clearFormDrafts();
    }

    previousScope = current;
  },
  { immediate: true, flush: 'sync' },
);

provide(familyKey, family);
</script>

<template>
  <AppShell>
    <AppUpdateNotice />
    <ReminderCenter />
    <RouterView
      v-if="cloud.ready.value"
      :key="`${identity}:${cloud.role.value ?? 'local'}`"
    />
    <p
      v-else
      class="muted"
      role="status"
    >
      正在确认账号与家庭，请稍候…
    </p>
  </AppShell>
</template>
