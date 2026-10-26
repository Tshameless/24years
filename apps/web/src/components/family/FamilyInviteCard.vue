<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';

const { cloud } = useFamily();
const { state, busy, invitation } = cloud;
const family = computed(() => state.value.family);
const copied = shallowRef('');
const inviteLink = computed(() =>
  invitation.value ? `${window.location.origin}/family?invite=${invitation.value.code}` : '',
);

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copied.value = '邀请链接已复制';
  } catch {
    copied.value = '请选中下方链接并手动复制';
  }
}
</script>

<template>
  <div class="invite-card">
    <h3>为另一位，留一个位置</h3>
    <p class="muted">邀请码 24 小时内有效，仅能使用一次。请只交给你的伴侣。</p>
    <template v-if="invitation && family?.inviteExpiresAt">
      <p
        class="invite-code"
        data-testid="invite-code"
      >
        {{ invitation.code }}
      </p>
      <p class="muted">有效至 {{ new Date(invitation.expiresAt).toLocaleString('zh-CN') }}</p>
      <label class="field">
        配对链接
        <input
          :value="inviteLink"
          readonly
          @focus="($event.target as HTMLInputElement).select()"
        />
      </label>
      <button
        class="button button-secondary"
        @click="copyLink"
      >
        复制邀请链接
      </button>
      <p
        v-if="copied"
        class="success-message"
      >
        {{ copied }}
      </p>
    </template>
    <p
      v-else-if="family?.inviteExpiresAt"
      class="muted"
    >
      已有有效邀请。为了保护邀请信息，刷新后请重新生成再分享，旧码将失效。
    </p>
    <div class="mode-actions">
      <button
        class="button button-primary"
        :disabled="busy"
        @click="cloud.manage('invite')"
      >
        {{ family?.inviteExpiresAt ? '重新生成邀请码' : '生成邀请码' }}
      </button>
      <button
        v-if="family?.inviteExpiresAt"
        class="text-button"
        :disabled="busy"
        @click="cloud.manage('revoke')"
      >
        撤销邀请
      </button>
    </div>
  </div>
</template>

<style scoped>
.invite-card {
  background: var(--green-light);
  padding: 20px;
  border-radius: 12px;
}

.invite-card .muted {
  font-size: 12px;
  line-height: 1.8;
}

.invite-code {
  font-size: 32px;
  letter-spacing: 7px;
  color: var(--green);
  margin: 20px 0;
}

.invite-card .field {
  margin-bottom: 16px;
}

.mode-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
</style>
