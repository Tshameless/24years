<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { downloadBackup } from '@/domain/backup';
import AccountDeletion from './AccountDeletion.vue';

const { cloud } = useFamily();
const { state, busy, recoveryKey } = cloud;
const recoveryPassword = shallowRef('');
const passwordForm = reactive({ current: '', next: '', repeat: '' });
const passwordError = shallowRef('');

async function rotate() {
  if (await cloud.rotateRecovery(recoveryPassword.value)) {
    recoveryPassword.value = '';
  }
}

async function changePassword() {
  passwordError.value = '';

  if (passwordForm.next !== passwordForm.repeat) {
    passwordError.value = '两次输入的新密码不一致。';

    return;
  }

  if (await cloud.changePassword(passwordForm.current, passwordForm.next)) {
    Object.assign(passwordForm, { current: '', next: '', repeat: '' });
  }
}

function downloadKey() {
  downloadBackup(
    JSON.stringify(
      { username: state.value.user?.username, recoveryKey: recoveryKey.value },
      null,
      2,
    ),
    '24years-account-recovery.json',
  );
}
</script>

<template>
  <div class="account-security">
    <div
      v-if="recoveryKey"
      class="recovery-card"
    >
      <strong>请保存你的恢复密钥</strong>
      <p class="muted">
        密钥只在本次操作后显示。忘记密码时可凭它恢复账号，请与密码分开保管，不要发给他人。
      </p>
      <label class="field">
        本次恢复密钥
        <textarea
          :value="recoveryKey"
          readonly
          rows="2"
          spellcheck="false"
        />
      </label>
      <div class="security-actions">
        <button
          type="button"
          class="button button-secondary"
          @click="downloadKey"
        >
          下载恢复密钥
        </button>
        <button
          type="button"
          class="text-button"
          @click="cloud.dismissRecoveryKey"
        >
          已保存，隐藏密钥
        </button>
      </div>
    </div>
    <details class="security-details">
      <summary>账号安全与注销</summary>
      <form
        class="form-grid security-form"
        @submit.prevent="rotate"
      >
        <p class="muted">
          旧账号或密钥遗失时，可以验证当前密码生成新密钥。生成后旧密钥立即失效；使用密钥重置密码时也会自动轮换，请及时保存新密钥。
        </p>
        <label class="field">
          验证当前密码
          <input
            v-model="recoveryPassword"
            type="password"
            required
            minlength="10"
            maxlength="128"
            autocomplete="current-password"
          />
        </label>
        <button
          class="button button-secondary"
          :disabled="busy"
        >
          生成新的恢复密钥
        </button>
      </form>
      <form
        class="form-grid security-form"
        @submit.prevent="changePassword"
      >
        <p class="muted">修改密码后，其他设备上的登录会话将被撤销；当前设备保持登录。</p>
        <p
          v-if="passwordError"
          class="form-error"
        >
          {{ passwordError }}
        </p>
        <label class="field">
          当前密码
          <input
            v-model="passwordForm.current"
            type="password"
            required
            minlength="10"
            maxlength="128"
            autocomplete="current-password"
          />
        </label>
        <label class="field">
          新密码
          <input
            v-model="passwordForm.next"
            type="password"
            required
            minlength="10"
            maxlength="128"
            autocomplete="new-password"
          />
        </label>
        <label class="field">
          重复新密码
          <input
            v-model="passwordForm.repeat"
            type="password"
            required
            minlength="10"
            maxlength="128"
            autocomplete="new-password"
          />
        </label>
        <button
          class="button button-secondary"
          :disabled="busy"
        >
          修改密码
        </button>
      </form>
      <AccountDeletion />
    </details>
  </div>
</template>

<style scoped>
.account-security {
  margin-top: 22px;
}

.recovery-card {
  background: var(--green-light);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.recovery-card .muted {
  margin: 12px 0;
}

.recovery-card textarea {
  width: 100%;
  resize: vertical;
  overflow-wrap: anywhere;
  font: 13px/1.6 monospace;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  background: var(--canvas);
}

.security-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.security-details {
  border-top: 1px solid var(--border);
  padding-top: 18px;
}

.security-details summary {
  cursor: pointer;
  font-size: 14px;
}

.security-form {
  margin-top: 16px;
}
</style>
