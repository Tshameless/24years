<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import {
  formatChildAge,
  localDate,
  type Child,
  type ChildBloodType,
  type ChildGender,
} from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';
import GrowthTracker from './GrowthTracker.vue';

const { children, addChild, updateChild, removeChild, locked, today } = useFamily();

const showModal = shallowRef(false);
const editingId = shallowRef<string | null>(null);
const expandedGrowthChildId = shallowRef<string | null>(null);
const formError = shallowRef('');

const form = reactive({
  name: '',
  birthDate: localDate(),
  gender: '' as ChildGender | '',
  bloodType: '' as ChildBloodType | '',
  birthWeightGrams: '',
  birthLengthCm: '',
  headCircumferenceCm: '',
  birthGestationalWeeks: '',
  notes: '',
});

function openAddModal() {
  editingId.value = null;
  form.name = '';
  form.birthDate = localDate();
  form.gender = '';
  form.bloodType = '';
  form.birthWeightGrams = '';
  form.birthLengthCm = '';
  form.headCircumferenceCm = '';
  form.birthGestationalWeeks = '';
  form.notes = '';
  formError.value = '';
  showModal.value = true;
}

function openEditModal(child: Child) {
  editingId.value = child.id;
  form.name = child.name;
  form.birthDate = child.birthDate;
  form.gender = child.gender ?? '';
  form.bloodType = child.bloodType ?? '';
  form.birthWeightGrams = child.birthWeightGrams ? String(child.birthWeightGrams) : '';
  form.birthLengthCm = child.birthLengthCm ? String(child.birthLengthCm) : '';
  form.headCircumferenceCm = child.headCircumferenceCm ? String(child.headCircumferenceCm) : '';
  form.birthGestationalWeeks = child.birthGestationalWeeks
    ? String(child.birthGestationalWeeks)
    : '';
  form.notes = child.notes ?? '';
  formError.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingId.value = null;
  formError.value = '';
}

function saveChildForm() {
  formError.value = '';

  const name = form.name.trim();

  if (!name) {
    formError.value = '请填写孩子的称呼或姓名。';

    return;
  }

  if (form.birthDate > today.value) {
    formError.value = '出生日期不能晚于今天。';

    return;
  }

  const birthWeightGrams = form.birthWeightGrams ? Number(form.birthWeightGrams) : undefined;
  const birthLengthCm = form.birthLengthCm ? Number(form.birthLengthCm) : undefined;
  const headCircumferenceCm = form.headCircumferenceCm
    ? Number(form.headCircumferenceCm)
    : undefined;
  const birthGestationalWeeks = form.birthGestationalWeeks
    ? Number(form.birthGestationalWeeks)
    : undefined;

  if (
    (birthWeightGrams !== undefined && (isNaN(birthWeightGrams) || birthWeightGrams <= 0)) ||
    (birthLengthCm !== undefined && (isNaN(birthLengthCm) || birthLengthCm <= 0)) ||
    (headCircumferenceCm !== undefined && (isNaN(headCircumferenceCm) || headCircumferenceCm <= 0)) ||
    (birthGestationalWeeks !== undefined &&
      (!Number.isInteger(birthGestationalWeeks) || birthGestationalWeeks < 20 || birthGestationalWeeks > 45))
  ) {
    formError.value = '出生测量数据必须为有效正数。';

    return;
  }

  const payload: Omit<Child, 'id'> = {
    name,
    birthDate: form.birthDate,
    ...(form.gender ? { gender: form.gender as ChildGender } : {}),
    ...(form.bloodType ? { bloodType: form.bloodType as ChildBloodType } : {}),
    ...(birthWeightGrams !== undefined ? { birthWeightGrams } : {}),
    ...(birthLengthCm !== undefined ? { birthLengthCm } : {}),
    ...(headCircumferenceCm !== undefined ? { headCircumferenceCm } : {}),
    ...(birthGestationalWeeks !== undefined ? { birthGestationalWeeks } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };

  if (editingId.value) {
    const existing = children.value.find((c) => c.id === editingId.value);

    if (existing) {
      const updated: Child = {
        ...existing,
        ...payload,
      };

      if (updateChild(updated, existing)) {
        closeModal();
      } else {
        formError.value = '更新失败，请重试。';
      }
    }
  } else {
    if (addChild(payload)) {
      closeModal();
    } else {
      formError.value = '添加失败，请重试。';
    }
  }
}

function confirmDelete(child: Child) {
  if (
    window.confirm(`确认删除孩子「${child.name}」的档案及所有生长发育记录？操作将同步至家庭成员。`)
  ) {
    removeChild(child.id);

    if (expandedGrowthChildId.value === child.id) {
      expandedGrowthChildId.value = null;
    }
  }
}

function toggleGrowth(childId: string) {
  expandedGrowthChildId.value = expandedGrowthChildId.value === childId ? null : childId;
}

const genderLabels: Record<string, string> = {
  boy: '男孩 👦',
  girl: '女孩 👧',
  other: '其他',
  unknown: '未说明',
};
</script>

<template>
  <section class="children-panel panel">
    <div class="panel-heading">
      <div>
        <h2>孩子成长档案</h2>
        <p class="muted">
          记录家庭中孩子的成长轨迹、出生指标与发育曲线，支持多孩子独立管理与健康体检计划。
        </p>
      </div>
      <button
        class="button button-primary button-sm"
        type="button"
        :disabled="locked"
        @click="openAddModal"
      >
        <AppIcon
          name="plus"
          :size="14"
        />
        添加孩子档案
      </button>
    </div>

    <!-- 孩子列表 -->
    <div
      v-if="children.length"
      class="children-list"
    >
      <div
        v-for="child in children"
        :key="child.id"
        class="child-card"
      >
        <div class="child-card-header">
          <div class="child-title">
            <strong>{{ child.name }}</strong>
            <span
              v-if="child.gender"
              class="tag"
            >
              {{ genderLabels[child.gender] ?? child.gender }}
            </span>
            <span
              v-if="child.bloodType"
              class="tag"
            >
              {{ child.bloodType }} 型血
            </span>
            <span class="age-badge">{{ formatChildAge(child.birthDate, today).label }}</span>
          </div>
          <div class="child-actions">
            <button
              class="button button-secondary button-sm"
              type="button"
              @click="toggleGrowth(child.id)"
            >
              {{ expandedGrowthChildId === child.id ? '收起发育记录' : '生长发育记录' }}
            </button>
            <button
              class="button button-secondary button-sm"
              type="button"
              :disabled="locked"
              @click="openEditModal(child)"
            >
              编辑
            </button>
            <button
              class="text-button text-button-danger button-sm"
              type="button"
              :disabled="locked"
              @click="confirmDelete(child)"
            >
              删除
            </button>
          </div>
        </div>

        <div class="child-stats">
          <span>
            出生日期：
            <strong>{{ child.birthDate }}</strong>
          </span>
          <span v-if="child.birthWeightGrams">出生体重：{{ child.birthWeightGrams }} g</span>
          <span v-if="child.birthLengthCm">出生身长：{{ child.birthLengthCm }} cm</span>
          <span v-if="child.headCircumferenceCm">出生头围：{{ child.headCircumferenceCm }} cm</span>
        </div>

        <p
          v-if="child.notes"
          class="child-notes"
        >
          {{ child.notes }}
        </p>

        <!-- 展开的生长发育跟踪组件 -->
        <GrowthTracker
          v-if="expandedGrowthChildId === child.id"
          :child="child"
        />
      </div>
    </div>

    <div
      v-else
      class="empty-state"
    >
      <p>还没有添加孩子档案。可录入新生儿或大宝的信息，开启多周期成长陪伴与发育追踪。</p>
    </div>

    <!-- 弹窗：新增 / 编辑孩子档案 -->
    <div
      v-if="showModal"
      class="modal-backdrop"
      @click.self="closeModal"
    >
      <div
        class="modal-card panel"
        role="dialog"
        aria-modal="true"
      >
        <div class="modal-header">
          <h3>{{ editingId ? '编辑孩子档案' : '添加孩子档案' }}</h3>
          <button
            class="text-button"
            type="button"
            @click="closeModal"
          >
            ✕
          </button>
        </div>

        <form
          class="modal-form"
          @submit.prevent="saveChildForm"
        >
          <div class="form-row">
            <label class="field">
              孩子姓名或昵称 *
              <input
                v-model="form.name"
                type="text"
                required
                maxlength="50"
                placeholder="例如：小汤圆、安安"
              />
            </label>
            <label class="field">
              出生日期 *
              <input
                v-model="form.birthDate"
                type="date"
                :max="today"
                required
              />
            </label>
          </div>

          <label class="field">
            出生孕周（周，可选）
            <input
              v-model="form.birthGestationalWeeks"
              type="number"
              step="1"
              min="20"
              max="45"
              placeholder="早产儿用于矫正月龄计算"
            />
          </label>

          <div class="form-row">
            <label class="field">
              性别
              <select v-model="form.gender">
                <option value="">未设置 / 保密</option>
                <option value="boy">男孩 👦</option>
                <option value="girl">女孩 👧</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label class="field">
              血型
              <select v-model="form.bloodType">
                <option value="">未知</option>
                <option value="A">A 型</option>
                <option value="B">B 型</option>
                <option value="AB">AB 型</option>
                <option value="O">O 型</option>
              </select>
            </label>
          </div>

          <div class="form-row">
            <label class="field">
              出生体重（克）
              <input
                v-model="form.birthWeightGrams"
                type="number"
                step="1"
                min="100"
                max="10000"
                placeholder="例如：3350"
              />
            </label>
            <label class="field">
              出生身长（厘米）
              <input
                v-model="form.birthLengthCm"
                type="number"
                step="0.1"
                min="10"
                max="100"
                placeholder="例如：50.0"
              />
            </label>
            <label class="field">
              出生头围（厘米）
              <input
                v-model="form.headCircumferenceCm"
                type="number"
                step="0.1"
                min="10"
                max="70"
                placeholder="例如：34.5"
              />
            </label>
          </div>

          <label class="field">
            成长寄语或医疗备注
            <textarea
              v-model="form.notes"
              rows="2"
              maxlength="500"
              placeholder="健康情况、过敏史或特殊的出生记录"
            />
          </label>

          <p
            v-if="formError"
            class="form-error"
            role="alert"
          >
            {{ formError }}
          </p>

          <div class="modal-actions">
            <button
              class="button button-primary"
              type="submit"
            >
              {{ editingId ? '保存修改' : '确认添加' }}
            </button>
            <button
              class="button button-secondary"
              type="button"
              @click="closeModal"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.children-panel {
  margin-top: 1.5rem;
}

.children-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.child-card {
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.child-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.child-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.child-title strong {
  font-size: 1.1rem;
  color: var(--text-heading);
}

.age-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  background: var(--pink-light);
  color: var(--primary);
  font-weight: 500;
  font-size: 0.8rem;
}

.child-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.button-sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.825rem;
}

.text-button-danger {
  color: var(--danger, #d32f2f);
}

.child-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.6rem;
}

.child-notes {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--text-heading);
  background: var(--surface-secondary, rgb(0 0 0 / 2%));
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: var(--surface);
  width: 100%;
  max-width: 540px;
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: 0 10px 30px rgb(0 0 0 / 15%);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-header h3 {
  margin: 0;
  color: var(--text-heading);
}

.modal-form {
  display: grid;
  gap: 0.85rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
</style>
