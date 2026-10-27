<script setup lang="ts">
import { computed } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import type { PregnancyRecord } from '@/domain/family';

type MedicalCard = Extract<PregnancyRecord, { type: 'medical' }>;
const { records } = usePregnancyRecords();
const card = computed(() =>
  records.value.find((item): item is MedicalCard => item.type === 'medical'),
);
</script>

<template>
  <section class="panel emergency-guide">
    <div class="panel-heading">
      <h2>孕期异常与就医指引</h2>
      <span class="tag emergency-tag">需要时优先求助</span>
    </div>
    <p class="emergency-lead">
      出现严重或持续不适时，不要等待应用判断；立即联系产科、急诊或拨打 120。
    </p>
    <div class="emergency-grid">
      <article>
        <h3>立即就医或呼叫急救</h3>
        <ul>
          <li>大量鲜红色出血、血块或明显加重的腹痛。</li>
          <li>持续剧烈头痛、视物模糊、胸闷气短、抽搐或意识异常。</li>
          <li>疑似破水、规律宫缩明显增强，或胎动较平时明显减少。</li>
        </ul>
      </article>
      <article>
        <h3>出发前准备</h3>
        <ul>
          <li>携带身份证件、产检资料、用药和过敏信息。</li>
          <li>疑似破水时尽量平躺，避免自行驾车；按医护人员指引转运。</li>
          <li>不确定是否紧急时，先拨打医院产科或 120 咨询。</li>
        </ul>
      </article>
      <article>
        <h3>产后与 24 月龄内婴幼儿急症</h3>
        <ul>
          <li>产妇大量出血、高热寒战、剧烈头痛、伤口红肿裂开或呼吸困难。</li>
          <li>1 岁内婴儿气道异物梗阻：面朝下头低脚高，5 次拍背与 5 次压胸交替，严禁盲目抠挖。</li>
          <li>婴幼儿抽搐惊厥：平卧侧头保持呼吸道通畅并记录时长，严禁掐人中或往嘴里塞异物。</li>
        </ul>
      </article>
      <article>
        <h3>婴幼儿外伤、烫伤与误服</h3>
        <ul>
          <li>烫伤：立即用流动冷水冲淋降温 15–20 分钟，勿涂抹牙膏、酱油等偏方。</li>
          <li>坠床或头部碰撞：观察是否持续哭闹、频繁呕吐、嗜睡或精神反应差，异常立即就医。</li>
          <li>疑似误服药物或化学品：保留包装瓶或残留物随身带往急诊，切勿盲目催吐。</li>
        </ul>
      </article>
    </div>
    <div class="emergency-actions">
      <a
        class="button button-primary"
        href="tel:120"
      >
        拨打 120
      </a>
      <a
        v-if="card?.phone"
        class="button button-secondary"
        :href="`tel:${card.phone.replace(/[^+\d]/g, '')}`"
      >
        联系就医卡电话
      </a>
      <RouterLink
        class="button button-secondary"
        to="/pregnancy?tab=medical"
      >
        查看就医卡
      </RouterLink>
    </div>
    <p class="muted">本页是应急准备信息，不能替代医生诊断、急救培训或医院分诊。</p>
  </section>
</template>

<style scoped>
.emergency-guide {
  border-color: var(--primary);
}

.emergency-tag {
  color: var(--primary-ink);
  background: var(--pink-light);
}

.emergency-lead {
  color: var(--primary-ink);
  font-weight: 600;
  line-height: 1.8;
}

.emergency-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.emergency-grid article {
  padding: 16px;
  background: var(--pink-light);
  border-radius: 10px;
}

.emergency-grid h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.emergency-grid ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  font-size: 13px;
}

.emergency-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

@media (max-width: 600px) {
  .emergency-grid {
    grid-template-columns: 1fr;
  }

  .emergency-actions .button {
    flex: 1 1 100%;
  }
}
</style>
