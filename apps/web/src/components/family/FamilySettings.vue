<script setup lang="ts">
import AccountPanel from './AccountPanel.vue';
import FamilyPairing from './FamilyPairing.vue';
import DataBackupPanel from './DataBackupPanel.vue';
import ProfileForm from './ProfileForm.vue';
</script>

<template>
  <div class="settings-grid">
    <ProfileForm />
    <aside class="settings-aside">
      <details
        class="secondary-settings"
        open
      >
        <summary class="secondary-heading">
          <span class="eyebrow">OPTIONAL FOR LATER</span>
          <strong>账号、协作与备份</strong>
          <span class="muted">
            先完成家庭档案就可以开始记录；需要跨设备、邀请家人或迁移数据时，再从这里处理。
          </span>
        </summary>
        <div class="secondary-settings-content">
          <AccountPanel />
          <FamilyPairing />
          <DataBackupPanel />
        </div>
      </details>
    </aside>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr);
  gap: 26px;
  align-items: start;
}

.settings-aside {
  display: grid;
}

.secondary-heading:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 3px;
}

.secondary-heading {
  cursor: pointer;
  list-style-position: inside;
  padding: 20px 22px;
}

.secondary-settings {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.secondary-settings[open] .secondary-heading {
  border-bottom: 1px solid var(--border);
}

.secondary-heading .eyebrow {
  display: block;
  margin-bottom: 7px;
}

.secondary-heading strong {
  display: block;
  font-size: 16px;
  margin-bottom: 7px;
}

.secondary-heading .muted {
  display: block;
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
}

.secondary-settings-content {
  display: grid;
  gap: 20px;
  padding: 20px;
}

@media (max-width: 1000px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .secondary-heading {
    padding: 17px;
  }

  .secondary-settings-content {
    padding: 14px;
  }
}
</style>
