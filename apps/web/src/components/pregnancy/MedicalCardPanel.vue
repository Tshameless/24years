<script setup lang="ts">
import { computed } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import type { PregnancyRecord } from '@/domain/family';

import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type MedicalCard = Extract<PregnancyRecord, { type: 'medical' }>;
const { cloudActive, records, disabled, message, error, save } = usePregnancyRecords();
const card = computed(
  () => records.value.find((item): item is MedicalCard => item.type === 'medical') ?? null,
);
const { form, before, stale, draft, reset, edit } = usePregnancyDraft({
  type: 'medical',
  initial: card.value,
  defaults: () => ({ hospital: '', contact: '', phone: '', notes: '' }),
  fields: (item: MedicalCard) => ({
    hospital: item.hospital,
    contact: item.contact,
    phone: item.phone,
    notes: item.notes,
  }),
});

function cancel() {
  if (draft.confirmDiscard()) {
    reset(card.value);
  }
}

function reload() {
  if (card.value) {
    edit(card.value);
  } else {
    cancel();
  }
}

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  const value: MedicalCard = {
    id: 'medical-card',
    type: 'medical',
    hospital: form.hospital.trim(),
    contact: form.contact.trim(),
    phone: form.phone.trim(),
    notes: form.notes.trim(),
  };

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset(value);
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
          cloudActive
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
      <div
        v-if="card?.notes && (card.notes.includes('过敏') || card.notes.includes('禁忌'))"
        class="allergy-alert"
      >
        <strong>⚠️ 用药安全警示</strong>
        <p>{{ card.notes }}</p>
      </div>
      <p class="muted">就诊时请同时携带正式证件和病历。点击电话号码可调用设备拨号功能。</p>
    </section>
    <section class="panel">
      <div class="panel-heading"><h2>编辑就医卡</h2></div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <FormDraftNotice
          :dirty="draft.dirty.value"
          :restored="draft.restored.value"
          :error="draft.storageError.value"
          :blocked="stale"
          @discard="cancel"
        />
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

.allergy-alert {
  margin: 16px 0;
  padding: 12px 16px;
  background: var(--pink-light);
  border: 1px solid var(--primary);
  border-radius: 6px;
  color: var(--primary);
  font-size: 13px;
}

.allergy-alert strong {
  display: block;
  margin-bottom: 4px;
}
</style>
