<script setup lang="ts">
import { computed, ref } from 'vue';

import { createId } from '@24years/domain/id';
import { formatGrowthAge, type ChildGrowthRecord } from '@24years/domain/growth';
import { growthCsv } from '@24years/domain/growthReport';
import { localDate } from '@24years/domain/primitives';
import type { Child, ChildBloodType, ChildGender } from '@24years/domain/child';

import { addChild, familyStore, removeChild, updateChild } from '@/store/family';

const today = localDate();
const formOpen = ref(false);
const editingId = ref<string | null>(null);
const activeChildId = ref<string | null>(null);

const name = ref('');
const birthDate = ref(today);
const gender = ref<ChildGender>('unknown');
const bloodType = ref<ChildBloodType>('unknown');
const birthWeightGrams = ref('');
const birthLengthCm = ref('');
const headCircumferenceCm = ref('');
const birthGestationalWeeks = ref('');
const notes = ref('');

const growthDate = ref(today);
const growthWeight = ref('');
const growthHeight = ref('');
const growthHead = ref('');
const growthNotes = ref('');

const children = computed(() => familyStore.data.children);

const genderOptions = [
  { value: 'unknown', label: '未填写' },
  { value: 'boy', label: '男孩' },
  { value: 'girl', label: '女孩' },
  { value: 'other', label: '其他' },
] as const;

const bloodOptions = [
  { value: 'unknown', label: '未填写' },
  { value: 'A', label: 'A 型' },
  { value: 'B', label: 'B 型' },
  { value: 'AB', label: 'AB 型' },
  { value: 'O', label: 'O 型' },
] as const;

function resetChildForm(): void {
  editingId.value = null;
  name.value = '';
  birthDate.value = today;
  gender.value = 'unknown';
  bloodType.value = 'unknown';
  birthWeightGrams.value = '';
  birthLengthCm.value = '';
  headCircumferenceCm.value = '';
  birthGestationalWeeks.value = '';
  notes.value = '';
}

function openCreateChild(): void {
  resetChildForm();
  formOpen.value = true;
}

function openEditChild(child: Child): void {
  editingId.value = child.id;
  name.value = child.name;
  birthDate.value = child.birthDate;
  gender.value = child.gender ?? 'unknown';
  bloodType.value = child.bloodType ?? 'unknown';
  birthWeightGrams.value = child.birthWeightGrams?.toString() ?? '';
  birthLengthCm.value = child.birthLengthCm?.toString() ?? '';
  headCircumferenceCm.value = child.headCircumferenceCm?.toString() ?? '';
  birthGestationalWeeks.value = child.birthGestationalWeeks?.toString() ?? '';
  notes.value = child.notes ?? '';
  formOpen.value = true;
}

function submitChild(): void {
  const trimmed = name.value.trim();

  if (!trimmed) {
    uni.showToast({ title: '请填写孩子姓名', icon: 'none' });

    return;
  }

  const payload = {
    name: trimmed,
    birthDate: birthDate.value,
    gender: gender.value === 'unknown' ? undefined : gender.value,
    bloodType: bloodType.value === 'unknown' ? undefined : bloodType.value,
    birthWeightGrams: birthWeightGrams.value ? Number(birthWeightGrams.value) : undefined,
    birthLengthCm: birthLengthCm.value ? Number(birthLengthCm.value) : undefined,
    headCircumferenceCm: headCircumferenceCm.value ? Number(headCircumferenceCm.value) : undefined,
    birthGestationalWeeks: birthGestationalWeeks.value ? Number(birthGestationalWeeks.value) : undefined,
    notes: notes.value.trim() || undefined,
  };

  if (editingId.value) {
    updateChild(editingId.value, payload);
  } else {
    addChild(payload);
  }

  formOpen.value = false;
  resetChildForm();
}

function remove(child: Child): void {
  uni.showModal({
    title: '删除孩子档案',
    content: '删除后生长记录一并移除，确定继续？',
    success: (result) => {
      if (result.confirm) {
        removeChild(child.id);
      }
    },
  });
}

function correctedAgeText(child: Child): string {
  return formatGrowthAge(child.birthDate, today, child.birthGestationalWeeks);
}

function addGrowth(child: Child): void {
  const weight = growthWeight.value.trim() ? Number(growthWeight.value) : undefined;
  const height = growthHeight.value.trim() ? Number(growthHeight.value) : undefined;
  const head = growthHead.value.trim() ? Number(growthHead.value) : undefined;

  if (weight === undefined && height === undefined && head === undefined) {
    uni.showToast({ title: '请至少填写一项测量值', icon: 'none' });

    return;
  }

  const record: ChildGrowthRecord = {
    id: createId(),
    date: growthDate.value,
    weightKg: weight,
    heightCm: height,
    headCircumferenceCm: head,
    notes: growthNotes.value.trim() || undefined,
  };

  updateChild(child.id, { growthRecords: [...(child.growthRecords ?? []), record] });

  growthWeight.value = '';
  growthHeight.value = '';
  growthHead.value = '';
  growthNotes.value = '';
  uni.showToast({ title: '已记录', icon: 'success' });
}

function removeGrowth(child: Child, recordId: string): void {
  updateChild(child.id, {
    growthRecords: (child.growthRecords ?? []).filter((item) => item.id !== recordId),
  });
}

function toggleGrowth(childId: string): void {
  activeChildId.value = activeChildId.value === childId ? null : childId;
}

/** 导出为 CSV：小程序无法直接落盘，统一复制到剪贴板后粘贴到表格应用。 */
function exportGrowth(child: Child): void {
  const records = child.growthRecords ?? [];

  if (!records.length) {
    uni.showToast({ title: '暂无生长测量记录', icon: 'none' });

    return;
  }

  uni.setClipboardData({
    data: growthCsv(records),
    success: () => {
      uni.showToast({ title: 'CSV 已复制，可粘贴到表格应用', icon: 'none' });
    },
  });
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <text class="section-title">儿童档案</text>
        <button size="mini" type="primary" @click="openCreateChild">添加孩子</button>
      </view>
      <text class="muted">生长数据为家庭手工填写，不构成临床判断或诊疗建议。</text>
      <view v-if="children.length === 0" class="muted gap">还没有孩子档案。</view>
    </view>

    <view v-for="child in children" :key="child.id" class="card">
      <view class="row">
        <text class="child-name">{{ child.name }}</text>
        <text class="muted">{{ child.birthDate }}</text>
      </view>
      <view class="row muted">
        <text>{{ correctedAgeText(child) }}</text>
        <text v-if="child.birthWeightGrams">出生体重 {{ child.birthWeightGrams }} g</text>
      </view>
      <view class="actions">
        <button size="mini" @click="toggleGrowth(child.id)">
          {{ activeChildId === child.id ? '收起生长记录' : '生长记录' }}
        </button>
        <button size="mini" @click="openEditChild(child)">编辑</button>
        <button size="mini" type="warn" @click="remove(child)">删除</button>
      </view>

      <view v-if="activeChildId === child.id" class="growth">
        <view class="section-title">新增测量</view>
        <view class="field">
          <text>日期</text>
          <picker mode="date" :value="growthDate" @change="(e: any) => (growthDate = e.detail.value)">
            <text class="picker-value">{{ growthDate }}</text>
          </picker>
        </view>
        <view class="field">
          <text>体重 (kg)</text>
          <input v-model="growthWeight" class="inline-input" type="digit" placeholder="选填" />
        </view>
        <view class="field">
          <text>身高 (cm)</text>
          <input v-model="growthHeight" class="inline-input" type="digit" placeholder="选填" />
        </view>
        <view class="field">
          <text>头围 (cm)</text>
          <input v-model="growthHead" class="inline-input" type="digit" placeholder="选填" />
        </view>
        <input v-model="growthNotes" class="input" placeholder="备注（可选）" />
        <button size="mini" type="primary" @click="addGrowth(child)">保存测量</button>

        <view v-for="record in child.growthRecords ?? []" :key="record.id" class="record">
          <view class="row">
            <text>{{ record.date }}</text>
            <text class="muted">
              {{ record.weightKg ? record.weightKg + ' kg' : '' }}
              {{ record.heightCm ? record.heightCm + ' cm' : '' }}
              {{ record.headCircumferenceCm ? '头围 ' + record.headCircumferenceCm + ' cm' : '' }}
            </text>
          </view>
          <button size="mini" type="warn" @click="removeGrowth(child, record.id)">删除</button>
        </view>

        <button
          v-if="(child.growthRecords ?? []).length"
          class="submit"
          size="mini"
          @click="exportGrowth(child)"
        >
          导出生长记录 CSV
        </button>
      </view>
    </view>

    <view v-if="formOpen" class="card">
      <view class="section-title">{{ editingId ? '编辑孩子' : '添加孩子' }}</view>
      <input v-model="name" class="input" placeholder="孩子姓名" />
      <view class="field">
        <text>出生日期</text>
        <picker mode="date" :value="birthDate" @change="(e: any) => (birthDate = e.detail.value)">
          <text class="picker-value">{{ birthDate }}</text>
        </picker>
      </view>
      <view class="field">
        <text>性别</text>
        <picker
          mode="selector"
          :range="genderOptions"
          range-key="label"
          :value="genderOptions.findIndex((item) => item.value === gender)"
          @change="(e: any) => (gender = genderOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ genderOptions.find((i) => i.value === gender)?.label }}</text>
        </picker>
      </view>
      <view class="field">
        <text>血型</text>
        <picker
          mode="selector"
          :range="bloodOptions"
          range-key="label"
          :value="bloodOptions.findIndex((item) => item.value === bloodType)"
          @change="(e: any) => (bloodType = bloodOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ bloodOptions.find((i) => i.value === bloodType)?.label }}</text>
        </picker>
      </view>
      <view class="field">
        <text>出生体重 (g)</text>
        <input v-model="birthWeightGrams" class="inline-input" type="number" placeholder="选填" />
      </view>
      <view class="field">
        <text>出生身长 (cm)</text>
        <input v-model="birthLengthCm" class="inline-input" type="digit" placeholder="选填" />
      </view>
      <view class="field">
        <text>出生头围 (cm)</text>
        <input v-model="headCircumferenceCm" class="inline-input" type="digit" placeholder="选填" />
      </view>
      <view class="field">
        <text>出生孕周</text>
        <input v-model="birthGestationalWeeks" class="inline-input" type="number" placeholder="选填" />
      </view>
      <input v-model="notes" class="input" placeholder="备注（可选）" />
      <view class="actions">
        <button size="mini" type="primary" @click="submitChild">保存</button>
        <button size="mini" @click="formOpen = false">取消</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 60rpx;
}

.gap {
  margin-top: 12rpx;
}

.child-name {
  font-size: 32rpx;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.growth {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid #f0f1f3;
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

.record {
  padding: 16rpx 0;
  border-top: 2rpx solid #f0f1f3;
}
</style>
