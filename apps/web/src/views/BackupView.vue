<script setup lang="ts">
import DataBackupPanel from '@/components/family/DataBackupPanel.vue';
</script>

<template>
  <div>
    <header class="page-heading">
      <div>
        <p class="eyebrow">KEEP YOUR MEMORIES SAFE</p>
        <h1>数据备份与恢复</h1>
        <p>不登录也能导出和导入。在其他设备打开本页，选择备份文件即可恢复。</p>
      </div>
    </header>
    <DataBackupPanel />
  </div>
</template>
