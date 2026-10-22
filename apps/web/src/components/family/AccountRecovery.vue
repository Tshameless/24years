<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { downloadBackup } from '@/domain/backup';

const emit = defineEmits<{ cancel: []; recovered: [] }>();
const { cloud } = useFamily();
const { busy, recoveryKey, recoveryUsername } = cloud;
const form = reactive({ username: '', recoveryKey: '', password: '', repeatPassword: '' });
const error = shallowRef('');

async function submit() {
  error.value = '';

  if (form.password !== form.repeatPassword) {
    error.value = '两次输入的新密码不一致。';

    return;
  }

  if (
    await cloud.recover({
      username: form.username.trim(),
      recoveryKey: form.recoveryKey.trim(),
      password: form.password,
    })
  ) {
    Object.assign(form, { username: '', recoveryKey: '', password: '', repeatPassword: '' });
  }
}

function downloadKey() {
  downloadBackup(
    JSON.stringify({ username: recoveryUsername.value, recoveryKey: recoveryKey.value }, null, 2),
    '24years-account-recovery.json',
  );
}
</script>

<template>
  <div v-if="recoveryKey" class="form-grid">
    <p role="status">密码已重置，旧密钥已失效。请保存新的恢复密钥，只在本次操作后显示。</p>
    <label class="field">
      新恢复密钥
      <textarea :value="recoveryKey" readonly rows="3" spellcheck="false" />
    </label>
    <button type="button" class="button button-secondary" @click="downloadKey">下载新恢复密钥</button>
    <button type="button" class="text-button" @click="cloud.dismissRecoveryKey(); emit('recovered')">已保存，返回登录</button>
  </div>
  <form
    v-else
    class="form-grid"
    @submit.prevent="submit"
  >
    <p class="muted">
      使用注册时保存的恢复密钥设置新密码。成功后，旧密钥和所有设备的登录会话都会失效。没有密钥时，无法通过此方式找回账号。
    </p>
    <label class="field">
      要找回的账号
      <input
        v-model="form.username"
        required
        pattern="[a-zA-Z0-9_]{3,32}"
        maxlength="32"
        autocomplete="username"
      />
    </label>
    <label class="field">
      恢复密钥
      <input
        v-model="form.recoveryKey"
        type="password"
        required
        maxlength="100"
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <label class="field">
      新密码
      <input
        v-model="form.password"
        type="password"
        required
        minlength="10"
        maxlength="128"
        autocomplete="new-password"
      />
    </label>
    <label class="field">
      再次输入新密码
      <input
        v-model="form.repeatPassword"
        type="password"
        required
        minlength="10"
        maxlength="128"
        autocomplete="new-password"
      />
    </label>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button button-primary"
      :disabled="busy"
    >
      重置密码
    </button>
    <button
      type="button"
      class="text-button"
      :disabled="busy"
      @click="emit('cancel')"
    >
      返回登录
    </button>
  </form>
</template>
