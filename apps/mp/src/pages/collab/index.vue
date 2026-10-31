<script setup lang="ts">
import { computed, ref } from 'vue';

import { authStore, isSignedIn, signInWithWechat, signOut } from '@/store/auth';
import {
  collabStore,
  createSpace,
  joinSpace,
  keepLocalVersion,
  keepRemoteVersion,
  pullSpace,
  signOutCollaboration,
} from '@/store/collab';

const spaceName = ref('');
const inviteInput = ref('');

const statusText = computed(() => {
  if (!isSignedIn()) {
    return '未登录 · 数据只存在本机';
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

const memberLines = computed(() =>
  collabStore.members.map((member) => {
    const role = member.role === 'owner' ? '创建者' : '成员';

    return `${member.displayName || '未设置昵称'} · ${role} · ${member.joinedAt}`;
  }),
);

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
    <view class="card">
      <view class="row">
        <text class="section-title">家庭共享</text>
        <text class="status">{{ statusText }}</text>
      </view>
      <text class="muted gap">登录并加入同一家庭后，双方在本机的改动会互相同步。</text>
    </view>

    <view v-if="!isSignedIn()" class="card">
      <view class="section-title">登录</view>
      <text class="muted">使用微信身份登录，把本机数据升级为可在两人之间同步的家庭数据。</text>
      <button class="primary" type="primary" :loading="authStore.loading" @click="login">
        微信一键登录
      </button>
      <text v-if="authStore.error" class="error">{{ authStore.error }}</text>
    </view>

    <view v-else class="card">
      <view class="row">
        <text>{{ authStore.account?.name || '微信用户' }}</text>
        <button size="mini" @click="logout">退出登录</button>
      </view>
      <text class="muted gap">账号 ID：{{ authStore.account?.id }}</text>
    </view>

    <view v-if="collabStore.conflict" class="card conflict">
      <view class="section-title">版本冲突</view>
      <text class="muted">家人在这台设备离线期间更新了同一份家庭数据，请选择保留哪一份。</text>
      <button class="primary" type="primary" @click="keepRemoteVersion">用家人的版本</button>
      <button class="primary" @click="keepLocalVersion">用我这台的版本覆盖</button>
    </view>

    <view v-if="isSignedIn() && !collabStore.spaceId" class="card">
      <view class="section-title">创建家庭</view>
      <input v-model="spaceName" class="input" placeholder="家庭名称，如：小团圆" />
      <button class="primary" type="primary" :loading="collabStore.loading" @click="create">
        创建并把本机数据上传
      </button>

      <view class="section-title gap">加入家人的家庭</view>
      <input v-model="inviteInput" class="input" placeholder="输入 8 位邀请码" />
      <button class="primary" :loading="collabStore.loading" @click="join">加入</button>
      <text v-if="collabStore.error" class="error">{{ collabStore.error }}</text>
    </view>

    <view v-if="isSignedIn() && collabStore.spaceId" class="card">
      <view class="row">
        <text class="section-title">{{ collabStore.spaceName }}</text>
        <button size="mini" :loading="collabStore.loading" @click="refresh">刷新</button>
      </view>
      <view class="field">
        <text>邀请码</text>
        <text class="code" @click="copyInviteCode">{{ collabStore.inviteCode }}</text>
      </view>
      <text class="muted">把邀请码告诉家人，对方在「加入家庭」里输入即可共享同一份数据。</text>

      <view class="section-title gap">成员 {{ collabStore.members.length }} 人</view>
      <text v-for="line in memberLines" :key="line" class="member">{{ line }}</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 60rpx;
}

.status {
  font-size: 24rpx;
  color: #6b7280;
}

.gap {
  margin-top: 12rpx;
}

.muted {
  color: #6b7280;
  font-size: 26rpx;
}

.error {
  display: block;
  margin-top: 12rpx;
  color: #e0533d;
  font-size: 26rpx;
}

.primary {
  margin-top: 16rpx;
}

.input {
  padding: 16rpx;
  margin-top: 12rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
}

.code {
  font-size: 36rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  color: #4caf50;
}

.member {
  display: block;
  padding: 8rpx 0;
  color: #374151;
}

.conflict {
  border: 2rpx solid #ff9800;
}
</style>
