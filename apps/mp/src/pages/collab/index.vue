<script setup lang="ts">
import { computed, ref } from 'vue';

import { authStore, isSignedIn, signInWithWechat, signOut } from '@/store/auth';
import {
  canEdit,
  collabStore,
  createSpace,
  joinSpace,
  keepLocalVersion,
  keepRemoteVersion,
  memberRoleLabel,
  pullSpace,
  signOutCollaboration,
} from '@/store/collab';

const spaceName = ref('');
const inviteInput = ref('');

const statusText = computed(() => {
  if (!isSignedIn()) {
    return '未登录 · 本机离线';
  }

  if (!collabStore.ready || collabStore.loading) {
    return '正在同步…';
  }

  if (collabStore.conflict) {
    return '存在版本冲突，待处理';
  }

  if (collabStore.syncing) {
    return '正在上传…';
  }

  if (!collabStore.spaceId) {
    return '已登录 · 尚未加入家庭';
  }

  if (collabStore.error) {
    return `同步异常：${collabStore.error}`;
  }

  return `已同步 · ${collabStore.lastSyncedAt || '刚刚'}`;
});

const isConnected = computed(() => isSignedIn() && !!collabStore.spaceId && !collabStore.error);

// 角色文案统一取领域层定义，避免和 Web 端措辞漂移。
const memberLines = computed(() =>
  collabStore.members.map((member) => {
    const mine = isSignedIn() && member.ownerId === authStore.account?.id;

    return {
      name: `${member.displayName || '微信家人'}${mine ? ' (我)' : ''}`,
      role: memberRoleLabel(member.role),
      date: member.joinedAt,
      isOwner: member.role === 'owner',
    };
  }),
);

/** 已加入但权限为「仅查看」时明确告知，避免用户以为改了能同步出去。 */
const readOnlyHint = computed(() => {
  if (!isSignedIn() || !collabStore.spaceId || canEdit()) {
    return '';
  }

  return '你在本家庭中的权限为「仅查看」，本机改动不会同步给家人。';
});

async function login(): Promise<void> {
  const ok = await signInWithWechat();

  if (ok) {
    uni.showToast({ title: '登录成功', icon: 'success' });
  }
}

async function logout(): Promise<void> {
  await signOut();
  await signOutCollaboration();
  uni.showToast({ title: '已退出，数据仍保存在本机', icon: 'none' });
}

async function create(): Promise<void> {
  const ok = await createSpace(spaceName.value);

  if (ok) {
    uni.showToast({ title: '家庭空间已创建', icon: 'success' });
  }
}

async function join(): Promise<void> {
  const ok = await joinSpace(inviteInput.value);

  if (ok) {
    inviteInput.value = '';
    uni.showToast({ title: '已加入家庭', icon: 'success' });
  }
}

function copyInviteCode(): void {
  uni.setClipboardData({
    data: collabStore.inviteCode,
    success: () => uni.showToast({ title: '邀请码已复制', icon: 'none' }),
  });
}

async function refresh(): Promise<void> {
  await pullSpace();

  if (!collabStore.error) {
    uni.showToast({ title: '已拉取最新数据', icon: 'success' });
  }
}
</script>

<template>
  <view class="page">
    <!-- 品牌与协同状态顶卡 (Brand Badge & Hearth Aesthetics) -->
    <view class="card brand-card">
      <view class="brand-badge-wrap">
        <text class="brand-icon">🤝</text>
      </view>
      <view class="brand-title">24Years · 双人家庭协同</view>
      <text class="brand-tagline">双向同频 · 循证产检 · 家庭共享账本</text>

      <view class="row status-bar">
        <view class="status-left">
          <view :class="['pulse-dot', { offline: !isConnected }]" />
          <text class="status-text">{{ statusText }}</text>
        </view>
        <view class="pill pill-surface">
          <text>端到端加密</text>
        </view>
      </view>
    </view>

    <!-- 登录模块 -->
    <view v-if="!isSignedIn()" class="card login-card">
      <view class="section-title">微信一键接入</view>
      <text class="muted desc">使用微信快速登录，将当前设备的孕期与账本数据升级为双人实时同步状态。</text>
      <button class="primary" type="primary" :loading="authStore.loading" @click="login">
        微信一键安全登录
      </button>
      <text v-if="authStore.error" class="error">{{ authStore.error }}</text>
    </view>

    <!-- 已登录账号卡片 -->
    <view v-else class="card account-card">
      <view class="row">
        <view class="user-info">
          <view class="avatar-circle">👤</view>
          <view class="user-text">
            <text class="user-name">{{ authStore.account?.name || '微信用户' }}</text>
            <text class="hint">ID: {{ authStore.account?.id }}</text>
          </view>
        </view>
        <button class="logout-btn" size="mini" @click="logout">退出</button>
      </view>
    </view>

    <!-- 冲突解决卡片 -->
    <view v-if="collabStore.conflict" class="card conflict-card">
      <view class="section-title text-alert">⚠️ 数据版本冲突</view>
      <text class="muted desc">家人在你离线期间更新了同一份家庭档案，请选择保留哪一份：</text>
      <view class="conflict-actions">
        <button class="conflict-btn primary" type="primary" @click="keepRemoteVersion">
          使用家人的最新版本
        </button>
        <button class="conflict-btn secondary" @click="keepLocalVersion">
          用我当前的版本覆盖
        </button>
      </view>
    </view>

    <!-- 未创建/未加入家庭 -->
    <view v-if="isSignedIn() && !collabStore.spaceId" class="card action-card">
      <view class="form-section">
        <view class="section-title">创建专属家庭空间</view>
        <input v-model="spaceName" class="input" placeholder="输入家庭名称，如：温馨小家" />
        <button class="primary" type="primary" :loading="collabStore.loading" @click="create">
          创建家庭并同步数据
        </button>
      </view>

      <view class="section-divider">
        <text class="divider-text">或者</text>
      </view>

      <view class="form-section">
        <view class="section-title">加入家人的家庭</view>
        <input v-model="inviteInput" class="input" placeholder="输入 8 位家庭邀请码" />
        <button class="btn-join" :loading="collabStore.loading" @click="join">
          验证并加入
        </button>
      </view>
      <text v-if="collabStore.error" class="error">{{ collabStore.error }}</text>
    </view>

    <!-- 已加入家庭空间 -->
    <view v-if="isSignedIn() && collabStore.spaceId" class="card space-card">
      <view class="row space-header">
        <view>
          <view class="section-title">{{ collabStore.spaceName }}</view>
          <view class="section-subtitle">双人同频已生效</view>
        </view>
        <button size="mini" :loading="collabStore.loading" @click="refresh">拉取同步</button>
      </view>

      <!-- 邀请码高亮卡片 -->
      <view class="invite-highlight-box" @click="copyInviteCode">
        <text class="invite-label">家庭邀请码 (点击复制)</text>
        <text class="code-number">{{ collabStore.inviteCode }}</text>
        <text class="invite-tip">将此码发送给伴侣，即可在另一台设备共享数据</text>
      </view>

      <text v-if="readOnlyHint" class="readonly-tip">{{ readOnlyHint }}</text>

      <!-- 成员列表 -->
      <view class="members-section">
        <view class="section-title">家庭成员 ({{ collabStore.members.length }}人)</view>
        <view v-for="m in memberLines" :key="m.name" class="member-row">
          <view class="member-left">
            <text class="member-name">{{ m.name }}</text>
            <text class="hint">{{ m.date }} 加入</text>
          </view>
          <view :class="['pill', m.isOwner ? 'pill-primary' : 'pill-secondary']">
            <text>{{ m.role }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  padding-bottom: 60rpx;
}

/* 顶卡 */
.brand-card {
  text-align: center;
  background: linear-gradient(180deg, #ffffff 0%, $color-surface-container-low 100%);
  border: 1rpx solid rgba(218, 226, 253, 0.7);

  .brand-badge-wrap {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background-color: $color-primary-fixed;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16rpx;

    .brand-icon {
      font-size: 48rpx;
    }
  }

  .brand-title {
    font-size: 34rpx;
    font-weight: 700;
    color: $color-on-surface;
    letter-spacing: -0.01em;
  }

  .brand-tagline {
    font-size: 24rpx;
    color: $color-on-surface-variant;
    margin-top: 6rpx;
    display: block;
  }

  .status-bar {
    margin-top: 28rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid rgba(218, 226, 253, 0.8);

    .status-left {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .status-text {
        font-size: 24rpx;
        color: $color-on-surface;
        font-weight: 500;
      }

      .pulse-dot.offline {
        background-color: $color-outline;
        animation: none;
      }
    }
  }
}

.desc {
  line-height: 1.6;
  margin-bottom: 24rpx;
  display: block;
}

.error {
  display: block;
  margin-top: 14rpx;
  color: $color-tertiary;
  font-size: 26rpx;
}

.primary {
  margin-top: 16rpx;
  width: 100%;
}

.input {
  width: 100%;
  height: 80rpx;
  min-height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  margin: 16rpx 0 20rpx;
  background-color: $color-surface-container-low;
  border: 1rpx solid rgba(218, 226, 253, 0.8);
  border-radius: $radius-md;
  box-sizing: border-box;
  font-size: 28rpx;
  color: $color-on-surface;
}

.account-card {
  .user-info {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .avatar-circle {
      width: 72rpx;
      height: 72rpx;
      border-radius: 50%;
      background-color: $color-surface-container-high;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36rpx;
    }

    .user-text {
      display: flex;
      flex-direction: column;

      .user-name {
        font-size: 28rpx;
        font-weight: 600;
        color: $color-on-surface;
      }
    }
  }

  .logout-btn {
    margin: 0 !important;
    border-radius: $radius-full !important;
  }
}

.conflict-card {
  border: 2rpx solid $color-tertiary-container;
  background-color: #fff9f9;

  .text-alert {
    color: $color-tertiary;
  }

  .conflict-actions {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }
}

.section-divider {
  text-align: center;
  margin: 28rpx 0;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1rpx;
    background-color: rgba(218, 226, 253, 0.8);
  }

  .divider-text {
    position: relative;
    background-color: #ffffff;
    padding: 0 20rpx;
    font-size: 22rpx;
    color: $color-outline;
  }
}

.btn-join {
  width: 100%;
  border-radius: $radius-lg !important;
  background-color: $color-surface-container !important;
  color: $color-on-surface !important;
  font-weight: 500 !important;
}

.space-card {
  .space-header {
    margin-bottom: 24rpx;
  }

  .invite-highlight-box {
    padding: 30rpx;
    background: linear-gradient(135deg, $color-surface-container-low 0%, $color-surface-container 100%);
    border-radius: $radius-lg;
    border: 1rpx dashed $color-primary;
    text-align: center;
    margin-bottom: 24rpx;

    .invite-label {
      font-size: 24rpx;
      color: $color-on-surface-variant;
      display: block;
      margin-bottom: 8rpx;
    }

    .code-number {
      font-size: 52rpx;
      font-weight: 800;
      letter-spacing: 6rpx;
      color: $color-primary;
      font-family: -apple-system, monospace;
      display: block;
      margin: 10rpx 0;
    }

    .invite-tip {
      font-size: 22rpx;
      color: $color-outline;
    }
  }

  .members-section {
    margin-top: 24rpx;

    .member-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18rpx 0;
      border-top: 1rpx solid rgba(218, 226, 253, 0.6);

      .member-left {
        display: flex;
        flex-direction: column;

        .member-name {
          font-size: 28rpx;
          font-weight: 500;
          color: $color-on-surface;
        }
      }
    }
  }

  .readonly-tip {
    display: block;
    margin-bottom: 20rpx;
    padding: 16rpx 20rpx;
    border-radius: $radius-md;
    background-color: $color-tertiary-fixed;
    color: $color-on-tertiary-fixed;
    font-size: 24rpx;
    line-height: 1.5;
  }
}
</style>
