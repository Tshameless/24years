<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { dueDateFromGestation } from '@24years/domain/profile';
import { localDate } from '@24years/domain/primitives';
import type { FamilyProfile } from '@24years/domain/profile';

import { familyStore, setProfile } from '@/store/family';

const today = localDate();
const existing = familyStore.data.profile;

const name = ref(existing?.name ?? '');
const nickname = ref(existing?.nickname ?? '');
const familyMode = ref<'single' | 'couple'>(existing?.familyMode ?? 'single');
const parentRole = ref<'single_parent' | 'mother' | 'father'>(
  existing?.parentRole ?? 'single_parent',
);
const referenceDate = ref(today);
const weeks = ref(0);
const days = ref(0);
const dueDate = ref(existing?.dueDate ?? '');
const quietMode = ref(existing?.quietMode ?? false);
const lmpDate = ref(existing?.lmpDate ?? '');
const prePregnancyWeightKg = ref(existing?.prePregnancyWeightKg?.toString() ?? '');
const heightCm = ref(existing?.heightCm?.toString() ?? '');

watch(familyMode, (mode) => {
  if (mode === 'single') {
    parentRole.value = 'single_parent';
  } else if (parentRole.value === 'single_parent') {
    parentRole.value = 'mother';
  }
});

const computedDueDate = computed(() => dueDateFromGestation(weeks.value, days.value, referenceDate.value));
const effectiveDueDate = computed(() => computedDueDate.value ?? dueDate.value);

const modeOptions = [
  { value: 'single', label: '单人' },
  { value: 'couple', label: '多人（父母）' },
] as const;

const roleOptions = [
  { value: 'single_parent', label: '本人' },
  { value: 'mother', label: '母亲' },
  { value: 'father', label: '父亲' },
] as const;

function onWeeksChange(event: any): void {
  weeks.value = Number(event.detail.value);
}

function onDaysChange(event: any): void {
  days.value = Number(event.detail.value);
}

const weekRange = Array.from({ length: 43 }, (_, index) => index);
const dayRange = Array.from({ length: 7 }, (_, index) => index);

function save(): void {
  const trimmedName = name.value.trim();
  const trimmedNickname = nickname.value.trim();
  const resolvedDueDate = effectiveDueDate.value;

  if (!trimmedName) {
    uni.showToast({ title: '请填写家庭名称', icon: 'none' });

    return;
  }

  if (!trimmedNickname) {
    uni.showToast({ title: '请填写你的称呼', icon: 'none' });

    return;
  }

  if (!resolvedDueDate) {
    uni.showToast({ title: '请选择预产期或填写孕周', icon: 'none' });

    return;
  }

  const weight = prePregnancyWeightKg.value.trim() ? Number(prePregnancyWeightKg.value) : undefined;
  const height = heightCm.value.trim() ? Number(heightCm.value) : undefined;

  const profile: FamilyProfile = {
    name: trimmedName,
    nickname: trimmedNickname,
    dueDate: resolvedDueDate,
    quietMode: quietMode.value,
    familyMode: familyMode.value,
    parentRole: parentRole.value,
    ...(lmpDate.value ? { lmpDate: lmpDate.value } : {}),
    ...(weight && Number.isFinite(weight) ? { prePregnancyWeightKg: weight } : {}),
    ...(height && Number.isFinite(height) ? { heightCm: height } : {}),
  };

  setProfile(profile);
  uni.showToast({ title: '档案已保存', icon: 'success' });
  setTimeout(() => uni.navigateBack(), 600);
}

function clearProfile(): void {
  uni.showModal({
    title: '清空档案',
    content: '仅清除家庭档案，计划、账本与记录会保留。确定继续？',
    success: (result) => {
      if (result.confirm) {
        setProfile(null);
        uni.navigateBack();
      }
    },
  });
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="section-title">家庭档案</view>

      <input v-model="name" class="input" placeholder="家庭名称" />
      <input v-model="nickname" class="input" placeholder="你的称呼" />

      <view class="field">
        <text>家庭模式</text>
        <picker
          mode="selector"
          :range="modeOptions"
          range-key="label"
          :value="modeOptions.findIndex((item) => item.value === familyMode)"
          @change="(e: any) => (familyMode = modeOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ modeOptions.find((i) => i.value === familyMode)?.label }}</text>
        </picker>
      </view>

      <view class="field">
        <text>我的身份</text>
        <picker
          mode="selector"
          :range="roleOptions"
          range-key="label"
          :value="roleOptions.findIndex((item) => item.value === parentRole)"
          @change="(e: any) => (parentRole = roleOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ roleOptions.find((i) => i.value === parentRole)?.label }}</text>
        </picker>
      </view>
    </view>

    <view class="card">
      <view class="section-title">孕周与预产期</view>
      <text class="muted">按项目 40 周约定推算，仅作日历参考。</text>

      <view class="field">
        <text>建档日期</text>
        <picker mode="date" :value="referenceDate" @change="(e: any) => (referenceDate = e.detail.value)">
          <text class="picker-value">{{ referenceDate }}</text>
        </picker>
      </view>

      <view class="field">
        <text>已满孕周</text>
        <picker mode="selector" :range="weekRange" :value="weeks" @change="onWeeksChange">
          <text class="picker-value">{{ weeks }} 周</text>
        </picker>
      </view>

      <view class="field">
        <text>额外天数</text>
        <picker mode="selector" :range="dayRange" :value="days" @change="onDaysChange">
          <text class="picker-value">{{ days }} 天</text>
        </picker>
      </view>

      <view class="field">
        <text>推算预产期</text>
        <text class="picker-value">{{ effectiveDueDate || '待计算' }}</text>
      </view>

      <view class="field">
        <text>直接指定预产期</text>
        <picker mode="date" :value="dueDate || today" @change="(e: any) => (dueDate = e.detail.value)">
          <text class="picker-value">{{ dueDate || '未指定' }}</text>
        </picker>
      </view>
    </view>

    <view class="card">
      <view class="section-title">可选资料</view>
      <view class="field">
        <text>末次月经</text>
        <picker mode="date" :value="lmpDate || today" @change="(e: any) => (lmpDate = e.detail.value)">
          <text class="picker-value">{{ lmpDate || '未填写' }}</text>
        </picker>
      </view>
      <view class="field">
        <text>孕前体重 (kg)</text>
        <input v-model="prePregnancyWeightKg" class="inline-input" type="digit" placeholder="选填" />
      </view>
      <view class="field">
        <text>身高 (cm)</text>
        <input v-model="heightCm" class="inline-input" type="digit" placeholder="选填" />
      </view>
      <view class="field">
        <text>静默关怀</text>
        <switch :checked="quietMode" color="#4caf50" @change="(e: any) => (quietMode = e.detail.value)" />
      </view>
      <text class="muted">开启后首页不再显示孕周、倒计时与计划，历史记录仍保留。</text>
    </view>

    <button class="primary-button" type="primary" @click="save">保存档案</button>
    <button v-if="existing" class="danger-button" @click="clearProfile">清空档案</button>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 60rpx;
}

.input {
  width: 100%;
  padding: 16rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
}

.inline-input {
  width: 240rpx;
  text-align: right;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 2rpx solid #f0f1f3;
}

.picker-value {
  color: #4caf50;
}

.primary-button {
  margin: 32rpx 24rpx 0;
}

.danger-button {
  margin: 20rpx 24rpx 0;
  color: #e0533d;
}
</style>
