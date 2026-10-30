<script setup lang="ts">
import { computed, ref } from 'vue';

import { localDate } from '@24years/domain/primitives';
import type { PregnancyRecord } from '@24years/domain/pregnancy';

import { applyPregnancy, familyStore, setProfile } from '@/store/family';

const today = localDate();
const profile = computed(() => familyStore.data.profile);

const outcome = computed(() => {
  const record = familyStore.data.pregnancyRecords.find(
    (item): item is Extract<PregnancyRecord, { type: 'outcome' }> => item.type === 'outcome',
  );

  return record ?? null;
});

const birthPlan = computed(() => {
  const record = familyStore.data.pregnancyRecords.find(
    (item): item is Extract<PregnancyRecord, { type: 'birthPlan' }> => item.type === 'birthPlan',
  );

  return record ?? null;
});

const postpartum = computed(() => {
  const record = familyStore.data.pregnancyRecords.find(
    (item): item is Extract<PregnancyRecord, { type: 'postpartum' }> => item.type === 'postpartum',
  );

  return record ?? null;
});

const outcomeKind = ref<'birth' | 'ended'>('birth');
const outcomeDate = ref(today);
const babyName = ref('');
const birthWeightGrams = ref('');
const birthLengthCm = ref('');

const planSupportPerson = ref('');
const planQuestions = ref('');
const painRelief = ref(false);
const position = ref(false);
const procedures = ref(false);
const newbornCare = ref(false);
const earlyContact = ref(false);

const careSupportPerson = ref('');
const careRecovery = ref('');
const careFeeding = ref('');
const careFollowupDate = ref('');

function saveOutcome(): void {
  applyPregnancy({
    type: 'pregnancy',
    before: outcome.value,
    value: {
      id: 'pregnancy-outcome',
      type: 'outcome',
      kind: outcomeKind.value,
      date: outcomeDate.value,
      babyName: babyName.value.trim() || undefined,
      birthWeightGrams: birthWeightGrams.value ? Number(birthWeightGrams.value) : undefined,
      birthLengthCm: birthLengthCm.value ? Number(birthLengthCm.value) : undefined,
      notes: '',
    },
  });

  uni.showToast({ title: '已记录', icon: 'success' });
}

function saveBirthPlan(): void {
  applyPregnancy({
    type: 'pregnancy',
    before: birthPlan.value,
    value: {
      id: 'birth-plan',
      type: 'birthPlan',
      date: today,
      supportPerson: planSupportPerson.value.trim(),
      discussPainRelief: painRelief.value,
      discussPosition: position.value,
      discussProcedures: procedures.value,
      discussNewbornCare: newbornCare.value,
      discussEarlyContact: earlyContact.value,
      questions: planQuestions.value.trim(),
      notes: '',
    },
  });

  uni.showToast({ title: '分娩沟通计划已保存', icon: 'success' });
}

function savePostpartum(): void {
  applyPregnancy({
    type: 'pregnancy',
    before: postpartum.value,
    value: {
      id: 'postpartum-plan',
      type: 'postpartum',
      date: today,
      followupDate: careFollowupDate.value || undefined,
      supportPerson: careSupportPerson.value.trim(),
      recovery: careRecovery.value.trim(),
      feeding: careFeeding.value.trim(),
      questions: '',
      notes: '',
    },
  });

  uni.showToast({ title: '产后照护交接已保存', icon: 'success' });
}

function toggleQuietMode(event: any): void {
  if (!profile.value) {
    uni.showToast({ title: '请先建立家庭档案', icon: 'none' });

    return;
  }

  setProfile({ ...profile.value, quietMode: Boolean(event.detail.value) });
}

function go(url: string): void {
  uni.navigateTo({ url });
}

const outcomeKindOptions = [
  { value: 'birth', label: '分娩' },
  { value: 'ended', label: '其他原因结束' },
] as const;
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <text class="section-title">{{ profile?.name || '未建档' }}</text>
        <text class="muted">{{ profile?.nickname || '' }}</text>
      </view>
      <text class="muted">本机模式：数据保存在这台设备，账号同步能力待接入。</text>
    </view>

    <view class="card">
      <view class="section-title">档案与数据</view>
      <button class="entry" @click="go('/pages/profile/edit')">家庭档案</button>
      <button class="entry" @click="go('/pages/child/index')">儿童档案</button>
      <button class="entry" @click="go('/pages/settings/index')">数据与备份</button>
    </view>

    <view v-if="profile" class="card">
      <view class="field">
        <text>静默关怀</text>
        <switch :checked="profile.quietMode" color="#4caf50" @change="toggleQuietMode" />
      </view>
      <text class="muted gap">开启后首页隐藏孕周、倒计时与计划。</text>
    </view>

    <view class="card">
      <view class="section-title">分娩沟通计划</view>
      <input v-model="planSupportPerson" class="input" placeholder="陪产/支持人" />
      <view class="field">
        <text>镇痛方式</text>
        <switch :checked="painRelief" color="#4caf50" @change="(e: any) => (painRelief = e.detail.value)" />
      </view>
      <view class="field">
        <text>分娩姿势</text>
        <switch :checked="position" color="#4caf50" @change="(e: any) => (position = e.detail.value)" />
      </view>
      <view class="field">
        <text>可能的操作</text>
        <switch :checked="procedures" color="#4caf50" @change="(e: any) => (procedures = e.detail.value)" />
      </view>
      <view class="field">
        <text>新生儿护理</text>
        <switch :checked="newbornCare" color="#4caf50" @change="(e: any) => (newbornCare = e.detail.value)" />
      </view>
      <view class="field">
        <text>早接触早吸吮</text>
        <switch :checked="earlyContact" color="#4caf50" @change="(e: any) => (earlyContact = e.detail.value)" />
      </view>
      <input v-model="planQuestions" class="input" placeholder="想和医护沟通的问题" />
      <button size="mini" type="primary" @click="saveBirthPlan">保存计划</button>
    </view>

    <view class="card">
      <view class="section-title">孕期结束记录</view>
      <text class="muted">记录分娩或其他原因结束，历史记录会归档保留。</text>
      <view class="field">
        <text>类型</text>
        <picker
          mode="selector"
          :range="outcomeKindOptions"
          range-key="label"
          :value="outcomeKindOptions.findIndex((item) => item.value === outcomeKind)"
          @change="(e: any) => (outcomeKind = outcomeKindOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ outcomeKindOptions.find((i) => i.value === outcomeKind)?.label }}</text>
        </picker>
      </view>
      <view class="field">
        <text>日期</text>
        <picker mode="date" :value="outcomeDate" @change="(e: any) => (outcomeDate = e.detail.value)">
          <text class="picker-value">{{ outcomeDate }}</text>
        </picker>
      </view>
      <input v-model="babyName" class="input" placeholder="宝宝姓名（分娩时填写）" />
      <view class="field">
        <text>出生体重 (g)</text>
        <input v-model="birthWeightGrams" class="inline-input" type="number" placeholder="选填" />
      </view>
      <view class="field">
        <text>出生身长 (cm)</text>
        <input v-model="birthLengthCm" class="inline-input" type="digit" placeholder="选填" />
      </view>
      <button size="mini" type="primary" @click="saveOutcome">保存记录</button>
      <view v-if="outcome" class="muted gap">
        已记录：{{ outcome.kind === 'birth' ? '分娩' : '其他原因结束' }} · {{ outcome.date }}
      </view>
    </view>

    <view class="card">
      <view class="section-title">产后照护交接</view>
      <input v-model="careSupportPerson" class="input" placeholder="主要照护人" />
      <input v-model="careRecovery" class="input" placeholder="恢复情况与注意事项" />
      <input v-model="careFeeding" class="input" placeholder="喂养安排" />
      <view class="field">
        <text>复诊日期</text>
        <picker mode="date" :value="careFollowupDate || today" @change="(e: any) => (careFollowupDate = e.detail.value)">
          <text class="picker-value">{{ careFollowupDate || '未设置' }}</text>
        </picker>
      </view>
      <button size="mini" type="primary" @click="savePostpartum">保存交接</button>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 60rpx;
}

.entry {
  margin-top: 12rpx;
  text-align: left;
}

.gap {
  margin-top: 12rpx;
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
</style>
