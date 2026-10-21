<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import type { PregnancyRecord } from '@/domain/family';

type MedicalCard = Extract<PregnancyRecord, { type: 'medical' }>;
const { store, records, disabled, message, error, save } = usePregnancyRecords();
const card = computed(
  () => records.value.find((item): item is MedicalCard => item.type === 'medical') ?? null,
);
const before = shallowRef<MedicalCard | null>(card.value ? { ...card.value } : null);
const form = reactive({
  hospital: before.value?.hospital ?? '',
  contact: before.value?.contact ?? '',
  phone: before.value?.phone ?? '',
  notes: before.value?.notes ?? '',
});
const stale = computed(() => JSON.stringify(card.value) !== JSON.stringify(before.value));

function reload() {
  before.value = card.value ? { ...card.value } : null;
  Object.assign(form, {
    hospital: before.value?.hospital ?? '',
    contact: before.value?.contact ?? '',
    phone: before.value?.phone ?? '',
    notes: before.value?.notes ?? '',
  });
}

async function submit() {
  const value: MedicalCard = {
    id: 'medical-card',
    type: 'medical',
    hospital: form.hospital.trim(),
    contact: form.contact.trim(),
    phone: form.phone.trim(),
    notes: form.notes.trim(),
  };

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reload();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel medical-card">
      <div class="panel-heading">
        <h2>我的就医卡</h2>
        <span class="tag">随时查阅</span>
      </div>
      <p class="muted">
        {{
          store.cloud.active.value
            ? '此卡与孕期记录对家庭全部成员可见，请只填写愿意共享的信息。'
            : '此卡保存在当前浏览器，登录并同步后会对家庭成员可见。'
        }}
      </p>
      <dl>
        <dt>就诊医院</dt>
        <dd>{{ card?.hospital || '尚未填写' }}</dd>
        <dt>紧急联系人</dt>
        <dd>{{ card?.contact || '尚未填写' }}</dd>
        <dt>联系电话</dt>
        <dd>
          <a
            v-if="card?.phone"
            :href="`tel:${card.phone.replace(/[^+\d]/g, '')}`"
            class="text-button"
          >
            {{ card.phone }}
          </a>
          <span v-else>尚未填写</span>
        </dd>
        <dt>过敏史、用药与其他备注</dt>
        <dd class="record-notes">{{ card?.notes || '尚未填写' }}</dd>
      </dl>
      <p class="muted">就诊时请同时携带正式证件和病历。点击电话号码可调用设备拨号功能。</p>
    </section>
    <section class="panel">
      <div class="panel-heading"><h2>编辑就医卡</h2></div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <fieldset
          class="record-fields"
          :disabled="disabled || stale"
        >
          <label class="field">
            就诊医院
            <input
              v-model="form.hospital"
              maxlength="100"
            />
          </label>
          <label class="field">
            紧急联系人
            <input
              v-model="form.contact"
              maxlength="50"
            />
          </label>
          <label class="field">
            联系电话
            <input
              v-model="form.phone"
              type="tel"
              maxlength="30"
            />
          </label>
          <label class="field">
            过敏史、用药与其他备注
            <textarea
              v-model="form.notes"
              maxlength="2000"
              rows="5"
            />
          </label>
          <button class="button button-primary">保存就医卡</button>
        </fieldset>
        <template v-if="stale">
          <p
            class="form-error"
            role="alert"
          >
            就医卡已更新。输入仍保留，重新载入会替换当前输入。
          </p>
          <button
            type="button"
            class="button button-secondary"
            @click="reload"
          >
            载入最新就医卡
          </button>
        </template>
      </form>
      <p
        v-if="error"
        class="form-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="message"
        class="success-message"
        role="status"
      >
        {{ message }}
      </p>
    </section>
  </div>
</template>

<style scoped>
dt {
  color: var(--muted);
  font-size: 13px;
  margin-top: 24px;
}

dd {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
  line-height: 1.8;
}

.medical-card {
  background: linear-gradient(135deg, var(--green-light), var(--surface));
}
</style>
