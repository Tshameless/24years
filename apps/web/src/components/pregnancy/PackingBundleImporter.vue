<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { createId } from '@/domain/id';
import { localDate, type PregnancyRecord } from '@/domain/family';
import {
  packingPresetBundles,
  type PackingPresetBundle,
  type PackingPresetItem,
} from '@/domain/preparationTemplates';
import { useFamily } from '@/composables/useFamily';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';

type Packing = Extract<PregnancyRecord, { type: 'packing' }>;

const { familyMode } = useFamily();
const { records, disabled, save } = usePregnancyRecords();

const importingId = shallowRef('');
const notice = shallowRef('');
const importError = shallowRef('');

const existingTitles = computed(
  () =>
    new Set(
      records.value
        .filter((item): item is Packing => item.type === 'packing')
        .map((item) => item.title.trim()),
    ),
);

function missingItems(bundle: PackingPresetBundle): readonly PackingPresetItem[] {
  return bundle.items.filter((item) => !existingTitles.value.has(item.title));
}

function resolveAssignee(
  defaultRole: PackingPresetItem['defaultRole'],
): 'mother' | 'father' | 'single_parent' {
  if (familyMode.value === 'single') {
    return 'single_parent';
  }

  return defaultRole === 'mother' ? 'mother' : 'father';
}

async function importBundle(bundle: PackingPresetBundle) {
  const missing = missingItems(bundle);

  if (disabled.value || importingId.value || !missing.length) {
    return;
  }

  notice.value = '';
  importError.value = '';
  importingId.value = bundle.id;

  let addedCount = 0;

  try {
    const today = localDate();

    for (const item of missing) {
      const saved = await save({
        type: 'pregnancy',
        before: null,
        value: {
          id: createId(),
          type: 'packing',
          date: today,
          title: item.title,
          category: item.category,
          quantity: item.quantity,
          assignee: resolveAssignee(item.defaultRole),
          completed: false,
          notes: item.notes,
        },
      });

      if (!saved) {
        importError.value = `已导入 ${addedCount} 项，剩余项暂未保存，请稍后重试。`;

        return;
      }

      addedCount += 1;
    }

    notice.value = `已向待产清单补齐「${bundle.title}」共 ${addedCount} 项。`;
  } finally {
    importingId.value = '';
  }
}
</script>

<template>
  <section
    v-if="!disabled"
    class="panel bundle-importer"
    aria-label="医院场景待产套组快速补齐"
  >
    <div class="panel-heading">
      <div>
        <h2>医院场景待产套组快速补齐</h2>
        <p class="muted importer-subtitle">
          按入院证件报销、妈妈产后护理、新生儿出院与陪护后勤四类整理，自动跳过清单中已有的同名物品；采购前请先核对建档医院待产包明细。
        </p>
      </div>
      <span class="tag">按需导入</span>
    </div>

    <div class="bundle-grid">
      <article
        v-for="bundle in packingPresetBundles"
        :key="bundle.id"
        class="bundle-card"
      >
        <div class="bundle-card-header">
          <h3>{{ bundle.title }}</h3>
          <span class="tag">
            已含 {{ bundle.items.length - missingItems(bundle).length }} / {{ bundle.items.length }}
          </span>
        </div>
        <p class="muted bundle-summary">{{ bundle.summary }}</p>
        <details class="bundle-items-toggle">
          <summary>查看包含的 {{ bundle.items.length }} 项参考物品</summary>
          <ul class="bundle-item-list">
            <li
              v-for="item in bundle.items"
              :key="item.title"
              :class="{ included: existingTitles.has(item.title) }"
            >
              {{ item.title }}
            </li>
          </ul>
        </details>
        <button
          type="button"
          class="button button-secondary button-sm bundle-action"
          :disabled="disabled || Boolean(importingId) || !missingItems(bundle).length"
          @click="importBundle(bundle)"
        >
          {{
            !missingItems(bundle).length
              ? '本组已全部在清单中'
              : importingId === bundle.id
                ? '正在导入…'
                : `一键补齐本组（${missingItems(bundle).length} 项）`
          }}
        </button>
      </article>
    </div>

    <p
      v-if="notice"
      class="success-message importer-feedback"
      role="status"
    >
      {{ notice }}
    </p>
    <p
      v-if="importError"
      class="form-error importer-feedback"
      role="alert"
    >
      {{ importError }}
    </p>
  </section>
</template>

<style scoped>
.bundle-importer {
  margin-bottom: 22px;
}

.importer-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
}

.bundle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.bundle-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--canvas);
}

.bundle-card-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.bundle-card-header h3 {
  margin: 0;
  font-size: 15px;
}

.bundle-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
}

.bundle-items-toggle {
  flex: 1;
}

.bundle-items-toggle summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--green);
  font-weight: 500;
}

.bundle-item-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-secondary);
}

.bundle-item-list li.included {
  color: var(--muted);
  text-decoration: line-through;
}

.bundle-action {
  align-self: flex-start;
}

.importer-feedback {
  margin: 14px 0 0;
}

@media (max-width: 760px) {
  .bundle-grid {
    grid-template-columns: 1fr;
  }

  .bundle-action {
    width: 100%;
  }
}
</style>
