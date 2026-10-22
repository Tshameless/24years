<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { downloadBackup } from '@/domain/backup';

const { cloud } = useFamily();
const { state, busy, recoveryKey } = cloud;
const recoveryPassword = shallowRef('');
const deletion = shallowRef<{
  familyId: string | null;
  revision: number | null;
  message: string;
} | null>(null);
const form = reactive({ password: '', confirmation: '', agreed: false });
const stale = computed(
  () =>
    deletion.value &&
    (deletion.value.familyId !== (state.value.family?.id ?? null) ||
      deletion.value.revision !== (state.value.family?.revision ?? null)),
);

async function rotate() {
  if (await cloud.rotateRecovery(recoveryPassword.value)) {
    recoveryPassword.value = '';
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

function beginDelete() {
  const family = state.value.family;
  const other = family?.members.find((member) => member.id !== state.value.user?.id);
  const ownRole = family?.members.find((member) => member.id === state.value.user?.id)?.role;
  deletion.value = {
    familyId: family?.id ?? null,
    revision: family?.revision ?? null,
    message: !family
      ? '账号及登录会话将被删除。'
      : !other
        ? '你是家庭唯一成员，账号及服务端的整个家庭档案、计划、账目和导入前副本都会删除。'
        : `共享家庭及已有记录将保留给 ${other.nickname}。${ownRole === 'owner' ? '对方会成为管理员。' : ''}你将失去访问权限。`,
  };
  Object.assign(form, { password: '', confirmation: '', agreed: false });
  cloud.clearError();
}

async function remove() {
  if (!deletion.value || !form.agreed || stale.value) {
    return;
  }

  if (
    await cloud.deleteAccount(
      form.password,
      form.confirmation,
      deletion.value.familyId,
      deletion.value.revision,
    )
  ) {
    Object.assign(form, { password: '', confirmation: '', agreed: false });
    deletion.value = null;
  }
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
      <div class="deletion-area">
        <button
          type="button"
          class="text-button danger-action"
          :disabled="busy"
          @click="beginDelete"
        >
          注销账号
        </button>
        <form
          v-if="deletion"
          class="form-grid security-form"
          @submit.prevent="remove"
        >
          <p class="deletion-message">{{ deletion.message }}</p>
          <p class="muted">
            本机记录、已下载文件和运维备份不会自动清除。注销后无法通过登录恢复，请先导出需要的记录。
          </p>
          <p
            v-if="stale"
            class="form-error"
          >
            家庭已有更新，请重新点击“注销账号”核对影响。
          </p>
          <label class="field">
            注销验证密码
            <input
              v-model="form.password"
              type="password"
              required
              minlength="10"
              maxlength="128"
              autocomplete="current-password"
            />
          </label>
          <label class="field">
            输入账号确认注销
            <input
              v-model="form.confirmation"
              required
              :placeholder="state.user?.username"
              maxlength="32"
              autocomplete="off"
            />
          </label>
          <label class="confirm-option">
            <input
              v-model="form.agreed"
              type="checkbox"
              required
            />
            我已了解上述数据处理方式，确认注销
          </label>
          <div class="security-actions">
            <button
              class="button button-secondary danger-action"
              :disabled="busy || !form.agreed || !!stale"
            >
              永久注销账号
            </button>
            <button
              type="button"
              class="text-button"
              :disabled="busy"
              @click="
                deletion = null;
                form.password = '';
              "
            >
              取消注销
            </button>
          </div>
        </form>
      </div>
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

.deletion-area {
  border-top: 1px solid var(--border);
  margin-top: 20px;
  padding-top: 20px;
}

.deletion-message {
  font-size: 13px;
  line-height: 1.8;
}

.danger-action {
  color: var(--primary-ink);
}

.confirm-option {
  display: flex;
  gap: 8px;
  align-items: start;
  font-size: 13px;
  line-height: 1.7;
}

.confirm-option input {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}
</style>
