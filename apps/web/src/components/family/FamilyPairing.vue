<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { roleLabels, familyRoleLabels, type FamilyParentRole } from '@/domain/collaboration';
import FamilyInviteCard from './FamilyInviteCard.vue';
import FamilySetupChoice from './FamilySetupChoice.vue';

const { cloud, uploadLocal, localProfile } = useFamily();
const { state, busy, role, expired } = cloud;
const family = computed(() => state.value.family);
const joinMode = shallowRef<'couple'>('couple');
const joinRole = shallowRef<FamilyParentRole | ''>('');
const ownRole = shallowRef<FamilyParentRole | ''>('');
const currentMember = computed(() =>
  family.value?.members.find((member) => member.id === state.value.user?.id),
);
const code = shallowRef(new URLSearchParams(window.location.search).get('invite') ?? '');
const inviteFamilyId = shallowRef(new URLSearchParams(window.location.search).get('family') ?? '');

async function create() {
  if (localProfile.value) {
    const mode = localProfile.value.familyMode ?? 'single';
    const parentRole = localProfile.value.parentRole ?? 'single_parent';
    await uploadLocal(mode, parentRole);
  }
}

async function join() {
  if (joinRole.value !== 'mother' && joinRole.value !== 'father') {
    return;
  }

  if (
    window.confirm('加入后将与对方共享家庭档案、计划和完整账本；本机记录不会自动合并。确认加入？')
  ) {
    if (await cloud.join(code.value.trim(), joinRole.value, inviteFamilyId.value || undefined)) {
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
        v-if="localProfile"
        class="form-grid"
        @submit.prevent="create"
      >
        <p class="muted">
          已有本机档案「{{ localProfile.name }}」：{{
            localProfile.familyMode === 'couple' ? '多人' : '单人'
          }}
          ·
          {{
            familyRoleLabels[localProfile.parentRole ?? 'single_parent']
          }}。上传后沿用建档时的选择，同时上传计划和账本，本机原始记录保留。
        </p>
        <button
          class="button button-primary"
          :disabled="busy"
        >
          上传本机档案并开启同步
        </button>
      </form>
      <p
        v-else
        class="muted"
      >
        请先在家庭档案中选择单人或多人并填写资料，保存后即可开始同步；也可以直接加入另一位家长的家庭。
      </p>
      <form
        class="form-grid join-form"
        @submit.prevent="join"
      >
        <h3>已经收到邀请？</h3>
        <FamilySetupChoice
          v-model:mode="joinMode"
          v-model:parent-role="joinRole"
          identity-only
          :disabled="busy"
        />
        <label class="field">
          伴侣邀请码
          <input
            v-model="code"
            required
            inputmode="text"
            pattern="[A-Za-z0-9_-]{12}"
            maxlength="12"
            placeholder="输入 12 位邀请码"
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
              ? '多人模式 · 每一天，一起参与'
              : '多人模式 · 等待另一位家长'
        }}
      </p>
      <form
        v-if="family.mode === 'couple' && !currentMember?.familyRole"
        class="form-grid"
        @submit.prevent="ownRole && cloud.manage('identity', { familyRole: ownRole })"
      >
        <p class="muted">旧档案还没有你的家长身份，请补选。</p>
        <FamilySetupChoice
          v-model:mode="joinMode"
          v-model:parent-role="ownRole"
          identity-only
          :disabled="busy"
        />
        <button
          class="button button-secondary"
          :disabled="busy"
        >
          保存我的身份
        </button>
      </form>
      <ul class="member-list">
        <li
          v-for="member in family.members"
          :key="member.id"
        >
          <span class="member-avatar">{{ member.nickname.slice(0, 1) }}</span>
          <div class="member-detail">
            <strong>{{ member.nickname }}{{ member.id === state.user.id ? '（我）' : '' }}</strong>
            <small>
              {{ member.familyRole ? familyRoleLabels[member.familyRole] : '身份待补充' }} ·
              {{ roleLabels[member.role] }}
            </small>
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
      <FamilyInviteCard
        v-if="role === 'owner' && family.mode === 'couple' && family.members.length === 1"
      />
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

.join-form {
  border-top: 1px dashed var(--border);
  padding-top: 20px;
  margin-top: 24px;
}

.mode-description {
  color: var(--green);
  font-size: 13px;
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
</style>
