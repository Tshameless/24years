<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { roleLabels, type FamilyMode } from '@/domain/collaboration';
import { emptyFamily } from '@/domain/family';

const { cloud, uploadLocal } = useFamily();
const { state, busy, role, invitation, expired } = cloud;
const family = computed(() => state.value.family);
const mode = shallowRef<FamilyMode>('single');
const copyLocal = shallowRef(true);
const code = shallowRef(new URLSearchParams(window.location.search).get('invite') ?? '');
const copied = shallowRef('');
const inviteLink = computed(() =>
  invitation.value ? `${window.location.origin}/family?invite=${invitation.value.code}` : '',
);

async function create() {
  if (copyLocal.value) {
    await uploadLocal(mode.value);
  } else {
    await cloud.create(mode.value, emptyFamily());
  }
}

async function join() {
  if (
    window.confirm('加入后将与对方共享家庭档案、计划和完整账本；本机记录不会自动合并。确认加入？')
  ) {
    if (await cloud.join(code.value.trim())) {
      window.history.replaceState({}, '', window.location.pathname);
      code.value = '';
    }
  }
}

function disconnect(userId?: string) {
  if (
    window.confirm(
      '解除配对后，对方将无法继续访问这个家庭。历史记录留在原家庭，不会删除。确认继续？',
    )
  ) {
    void cloud.manage(userId ? 'remove' : 'leave', userId ? { userId } : {});
  }
}

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
  <section
    v-if="state.user && !expired"
    class="panel pairing-panel"
  >
    <div class="panel-heading">
      <h2>{{ family ? '一起照顾这个家' : '选择你的陪伴方式' }}</h2>
      <span class="tag">{{ family ? `${family.members.length} / 2 位成员` : '第一步' }}</span>
    </div>
    <template v-if="!family">
      <form
        class="form-grid"
        @submit.prevent="create"
      >
        <label class="field">
          家庭模式
          <select v-model="mode">
            <option value="single">单人模式 · 独立记录</option>
            <option value="couple">双人模式 · 邀请伴侣</option>
          </select>
        </label>
        <label class="upload-option">
          <input
            v-model="copyLocal"
            type="checkbox"
          />
          将本机档案、计划和账本上传到这个账号
        </label>
        <p class="muted">本机原始记录会保留；也可以取消勾选，从空白家庭开始。</p>
        <button
          class="button button-primary"
          :disabled="busy"
        >
          创建同步家庭
        </button>
      </form>
      <form
        class="form-grid join-form"
        @submit.prevent="join"
      >
        <h3>已经收到邀请？</h3>
        <label class="field">
          伴侣邀请码
          <input
            v-model="code"
            required
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength="6"
            placeholder="输入 6 位邀请码"
          />
        </label>
        <button
          class="button button-secondary"
          :disabled="busy"
        >
          加入伴侣家庭
        </button>
      </form>
    </template>
    <template v-else>
      <p class="mode-description">
        {{
          family.mode === 'single'
            ? '单人模式 · 按自己的节奏记录'
            : family.members.length === 2
              ? '双人模式 · 每一天，一起参与'
              : '双人模式 · 等待另一位成员'
        }}
      </p>
      <div
        v-if="role === 'owner'"
        class="mode-actions"
      >
        <button
          class="button button-secondary"
          :aria-pressed="family.mode === 'single'"
          :disabled="busy || family.mode === 'single' || family.members.length > 1"
          @click="cloud.manage('mode', { mode: 'single' })"
        >
          单人模式
        </button>
        <button
          class="button button-secondary"
          :aria-pressed="family.mode === 'couple'"
          :disabled="busy || family.mode === 'couple'"
          @click="cloud.manage('mode', { mode: 'couple' })"
        >
          双人模式
        </button>
      </div>
      <ul class="member-list">
        <li
          v-for="member in family.members"
          :key="member.id"
        >
          <span class="member-avatar">{{ member.nickname.slice(0, 1) }}</span>
          <div class="member-detail">
            <strong>{{ member.nickname }}{{ member.id === state.user.id ? '（我）' : '' }}</strong>
            <small>{{ roleLabels[member.role] }}</small>
            <template v-if="role === 'owner' && member.role !== 'owner'">
              <select
                :value="member.role"
                :aria-label="`${member.nickname}的权限`"
                :disabled="busy"
                @change="
                  cloud.manage('role', {
                    userId: member.id,
                    role: ($event.target as HTMLSelectElement).value,
                  })
                "
              >
                <option value="editor">共同编辑</option>
                <option value="viewer">仅查看</option>
              </select>
              <button
                class="text-button"
                :disabled="busy"
                @click="disconnect(member.id)"
              >
                解除配对
              </button>
            </template>
          </div>
        </li>
      </ul>
      <p class="muted">
        管理员管理档案、邀请和权限。共同编辑成员可添加、编辑、删除计划与账目；仅查看成员可查看全部共享记录，但不能修改。
      </p>
      <div
        v-if="role === 'owner' && family.mode === 'couple' && family.members.length === 1"
        class="invite-card"
      >
        <h3>为另一位，留一个位置</h3>
        <p class="muted">邀请码 24 小时内有效，仅能使用一次。请只交给你的伴侣。</p>
        <template v-if="invitation && family.inviteExpiresAt">
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
          v-else-if="family.inviteExpiresAt"
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
            {{ family.inviteExpiresAt ? '重新生成邀请码' : '生成邀请码' }}
          </button>
          <button
            v-if="family.inviteExpiresAt"
            class="text-button"
            :disabled="busy"
            @click="cloud.manage('revoke')"
          >
            撤销邀请
          </button>
        </div>
      </div>
      <button
        v-if="role !== 'owner'"
        class="text-button"
        :disabled="busy"
        @click="disconnect()"
      >
        退出这个家庭
      </button>
    </template>
  </section>
</template>

<style scoped>
.pairing-panel .muted {
  font-size: 12px;
  line-height: 1.8;
}

.upload-option {
  display: flex;
  align-items: start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.8;
}

.upload-option input {
  margin-top: 5px;
  accent-color: var(--green);
}

.join-form {
  border-top: 1px dashed var(--border);
  padding-top: 20px;
  margin-top: 24px;
}

.mode-description {
  color: var(--green);
  font-size: 13px;
}

.mode-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.member-list {
  list-style: none;
  padding: 0;
  margin: 24px 0;
}

.member-list li {
  display: flex;
  gap: 12px;
  align-items: start;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.member-avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: var(--pink-light);
  border-radius: 50%;
  color: var(--primary-ink);
}

.member-detail {
  min-width: 0;
  overflow-wrap: anywhere;
}

.member-detail strong,
.member-detail small {
  display: block;
  line-height: 1.8;
}

.member-detail small {
  color: var(--text-secondary);
}

.member-detail select {
  margin: 10px 12px 0 0;
  min-height: 44px;
  padding: 6px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.invite-card {
  background: var(--green-light);
  padding: 20px;
  border-radius: 12px;
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
</style>
