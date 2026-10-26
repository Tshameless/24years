<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';

const { cloud } = useFamily();
const { state, busy } = cloud;
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
</template>

<style scoped>
.deletion-area {
  border-top: 1px solid var(--border);
  margin-top: 20px;
  padding-top: 20px;
}

.security-form {
  margin-top: 16px;
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

.security-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
</style>
