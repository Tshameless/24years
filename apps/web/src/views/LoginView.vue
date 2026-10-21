<script setup lang="ts">
import AccountPanel from '@/components/family/AccountPanel.vue';
import { useFamily } from '@/composables/useFamily';

const { cloud } = useFamily();
const { active } = cloud;
</script>

<template>
  <div class="login-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">YOUR RECORDS, YOUR CHOICE</p>
        <h1>选择你的记录方式</h1>
        <p>登录不是必须的，你可以随时开启同步。</p>
      </div>
    </header>
    <AccountPanel initial-mode="login" />
    <section class="panel login-help">
      <template v-if="!active">
        <h2>不登录，在本机记录</h2>
        <p class="muted">
          数据仅保存在当前设备的当前浏览器，不会自动上传或跨设备同步。清除浏览器数据、使用无痕模式可能导致记录丢失。
        </p>
        <p class="muted">请定期导出 JSON 备份。换设备后也能导入恢复，无需注册或登录。</p>
        <RouterLink
          to="/family"
          class="button button-secondary"
        >
          暂不登录，使用本机记录
        </RouterLink>
      </template>
      <template v-else>
        <h2>继续管理家庭</h2>
        <p class="muted">
          本机记录与账号记录分开保存，不会因登录而自动上传或覆盖。可在我的家庭上传本机档案或建立同步家庭；注册后请保存恢复密钥。
        </p>
        <RouterLink
          to="/family"
          class="button button-primary"
        >
          前往我的家庭
        </RouterLink>
      </template>
      <RouterLink
        to="/backup"
        class="text-button backup-link"
      >
        导入 / 导出备份
      </RouterLink>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  max-width: 700px;
  margin: auto;
}

.login-help {
  margin-top: 22px;
}

.login-help p {
  margin-top: 16px;
  line-height: 1.9;
  font-size: 14px;
}

.backup-link {
  display: block;
  margin-top: 20px;
}
</style>
