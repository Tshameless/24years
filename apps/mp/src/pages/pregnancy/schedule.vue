<script setup lang="ts">
import { computed, ref } from 'vue';

import { createId } from '@24years/domain/id';
import { checkupTemplates } from '@24years/domain/preparationTemplates';
import {
  prenatalSchedule,
  prenatalScheduleState,
  scheduleDate,
  scheduledCheckup,
} from '@24years/domain/prenatalSchedule';
import { localDate } from '@24years/domain/primitives';

import { applyPregnancy, familyStore } from '@/store/family';

const today = localDate();
const dueDate = computed(() => familyStore.data.profile?.dueDate ?? '');
const records = computed(() => familyStore.data.pregnancyRecords);
const showAdd = ref(false);

/** 表单：手动补录一次产检安排。 */
const form = ref({ title: '', date: today, notes: '' });
const templateIndex = ref(-1);

/** 排期时间轴：按预产期倒推每个节点的参考日期，并关联已有的同名产检记录。 */
const schedule = computed(() =>
  prenatalSchedule.map((item) => {
    const date = scheduleDate(dueDate.value || today, item.offsetWeeks);
    const checkup = scheduledCheckup(records.value, item);

    return {
      ...item,
      date,
      checkup,
      state: prenatalScheduleState(date, today, checkup),
    };
  }),
);

const stateLabels: Record<string, string> = {
  upcoming: '即将到期',
  due: '当前节点',
  past: '参考日期已过',
  scheduled: '已加入安排',
  completed: '已完成',
};

const summary = computed(() => ({
  completed: schedule.value.filter((item) => item.state === 'completed').length,
  scheduled: schedule.value.filter((item) => item.state === 'scheduled').length,
  due: schedule.value.filter((item) => item.state === 'due').length,
  past: schedule.value.filter((item) => item.state === 'past').length,
}));

function addScheduled(item: (typeof schedule.value)[number]): void {
  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: {
      id: createId(),
      type: 'checkup',
      title: item.title,
      date: item.date,
      notes: `${item.guidance}\n\n实际项目、日期与准备要求请向医院确认。`,
      completed: false,
    },
  });
  uni.showToast({ title: '已加入产检安排', icon: 'none' });
}

function toggleCompleted(item: (typeof schedule.value)[number]): void {
  if (!item.checkup) {
    return;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: item.checkup,
    value: { ...item.checkup, completed: !item.checkup.completed },
  });
}

function removeRecord(item: (typeof schedule.value)[number]): void {
  if (!item.checkup) {
    return;
  }

  uni.showModal({
    title: '移除安排',
    content: `确定移除「${item.title}」这条产检安排？`,
    success: (res) => {
      if (res.confirm) {
        applyPregnancy({ type: 'pregnancy', before: item.checkup!, value: null });
      }
    },
  });
}

function onTemplateChange(event: { detail: { value: number } }): void {
  templateIndex.value = event.detail.value;
  const template = checkupTemplates[event.detail.value];

  if (template) {
    form.value = { title: template.title, date: today, notes: template.notes };
  }
}

function submit(): void {
  const title = form.value.title.trim();

  if (!title) {
    uni.showToast({ title: '请填写产检名称', icon: 'none' });

    return;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: {
      id: createId(),
      type: 'checkup',
      title,
      date: form.value.date,
      notes: form.value.notes.trim(),
      completed: false,
    },
  });
  form.value = { title: '', date: today, notes: '' };
  templateIndex.value = -1;
  showAdd.value = false;
  uni.showToast({ title: '已添加', icon: 'none' });
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="head">
        <view>
          <view class="section-title">孕周产检参考时间轴</view>
          <view class="muted">根据当前预产期估算，仅用于提前整理。</view>
        </view>
        <view :class="['tag', { warn: !dueDate }]">
          {{ dueDate ? `预产期 ${dueDate}` : '未设置预产期' }}
        </view>
      </view>

      <view v-if="!dueDate" class="notice">
        尚未设置预产期，下方日期按今天倒推，仅供参考。请先到「家庭档案」填写预产期。
      </view>

      <view class="summary">
        <view class="summary-item">
          <text class="num ok">{{ summary.completed }}</text>
          <text class="muted">已完成</text>
        </view>
        <view class="summary-item">
          <text class="num">{{ summary.scheduled }}</text>
          <text class="muted">已加入安排</text>
        </view>
        <view v-if="summary.due" class="summary-item">
          <text class="num current">{{ summary.due }}</text>
          <text class="muted">当前节点</text>
        </view>
        <view v-if="summary.past" class="summary-item">
          <text class="num past">{{ summary.past }}</text>
          <text class="muted">参考日期已过</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view v-for="item in schedule" :key="item.title" :class="['item', `state-${item.state}`]">
        <view class="item-head">
          <text class="item-title">{{ item.week }} · {{ item.title }}</text>
          <text :class="['state-tag', `tag-${item.state}`]">{{ stateLabels[item.state] }}</text>
        </view>
        <view class="muted">预计 {{ item.date }}</view>
        <view class="guidance">{{ item.guidance }}</view>

        <view class="actions">
          <view v-if="!item.checkup" class="btn small primary" @click="addScheduled(item)">
            {{ item.state === 'past' ? '补记安排' : '加入安排' }}
          </view>
          <template v-else>
            <view
              :class="['btn small', item.checkup.completed ? '' : 'primary']"
              @click="toggleCompleted(item)"
            >
              {{ item.checkup.completed ? '取消完成' : '标记完成' }}
            </view>
            <view class="btn small danger" @click="removeRecord(item)">移除</view>
          </template>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="row between" @click="showAdd = !showAdd">
        <text class="section-title">手动补录产检</text>
        <text class="link">{{ showAdd ? '收起' : '展开' }}</text>
      </view>

      <view v-if="showAdd" class="form">
        <picker
          mode="selector"
          :range="checkupTemplates"
          range-key="title"
          :value="templateIndex"
          @change="onTemplateChange"
        >
          <view class="field">
            <text class="label">套用模板</text>
            <text class="value">
              {{ templateIndex >= 0 ? checkupTemplates[templateIndex].title : '选择常用产检模板' }}
            </text>
          </view>
        </picker>

        <view class="field">
          <text class="label">产检名称</text>
          <input v-model="form.title" class="input" placeholder="例如：系统超声排畸" />
        </view>

        <picker mode="date" :value="form.date" @change="form.date = $event.detail.value">
          <view class="field">
            <text class="label">日期</text>
            <text class="value">{{ form.date }}</text>
          </view>
        </picker>

        <view class="field">
          <text class="label">备注</text>
          <textarea v-model="form.notes" class="input area" placeholder="想问医生的问题、注意事项" />
        </view>

        <view class="btn primary" @click="submit">保存</view>
      </view>
    </view>

    <view class="card">
      <view class="muted">
        排期为常用产检节点的组织性提醒，不是临床方案。最终检查项目与日期以医院安排为准。
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 40rpx;
}

.card {
  margin: 24rpx;
  padding: 28rpx;
  background: #fff;
  border-radius: 16rpx;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.row.between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tag {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  background: #eef7ef;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #4caf50;
}

.tag.warn {
  background: #fdecea;
  color: #e0533d;
}

.notice {
  margin-top: 20rpx;
  padding: 18rpx;
  background: #fdf3f2;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #e0533d;
  line-height: 1.6;
}

.summary {
  display: flex;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #f0f1f3;
}

.summary-item {
  flex: 1;
  text-align: center;
}

.num {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
}

.num.ok {
  color: #4caf50;
}

.num.current {
  color: #2196f3;
}

.num.past {
  color: #9ca3af;
}

.item {
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: #f7f8fa;
  border-left: 6rpx solid #e5e7eb;
  border-radius: 12rpx;
}

.item.state-due {
  border-left-color: #2196f3;
}

.item.state-completed {
  border-left-color: #4caf50;
}

.item.state-scheduled {
  border-left-color: #f2994a;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.item-title {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
}

.state-tag {
  flex-shrink: 0;
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  background: #eef0f2;
  color: #6b7280;
}

.tag-completed {
  background: #e8f5e9;
  color: #4caf50;
}

.tag-due {
  background: #e3f2fd;
  color: #2196f3;
}

.tag-scheduled {
  background: #fff3e0;
  color: #f2994a;
}

.guidance {
  margin: 12rpx 0;
  font-size: 25rpx;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.form {
  margin-top: 20rpx;
}

.field {
  margin-bottom: 20rpx;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.value {
  padding: 20rpx;
  background: #f7f8fa;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.input {
  padding: 20rpx;
  background: #f7f8fa;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.area {
  width: 100%;
  min-height: 120rpx;
}

.btn {
  padding: 20rpx 0;
  text-align: center;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 27rpx;
}

.btn.small {
  flex: 1;
  padding: 14rpx 0;
  font-size: 24rpx;
}

.btn.primary {
  background: #4caf50;
  border-color: #4caf50;
  color: #fff;
}

.btn.danger {
  color: #e0533d;
}

.link {
  font-size: 26rpx;
  color: #4caf50;
}

.muted {
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}
</style>
