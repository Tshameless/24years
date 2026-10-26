<script setup lang="ts">
import { currency } from '@/domain/family';

defineProps<{
  totals: {
    readonly total: number;
    readonly reimbursed: number;
    readonly allowance: number;
    readonly net: number;
  };
}>();
</script>

<template>
  <section
    class="ledger-summary"
    aria-label="累计账目汇总"
  >
    <div class="summary-main">
      <span>累计净支出</span>
      <strong
        class="numbers"
        data-testid="net-cost"
      >
        {{ currency(totals.net) }}
      </strong>
      <small>每一份投入，清楚记录。</small>
    </div>
    <div class="summary-detail">
      <div>
        <span>账单总支出</span>
        <strong class="numbers">{{ currency(totals.total) }}</strong>
      </div>
      <b>−</b>
      <div>
        <span>已报销</span>
        <strong class="numbers">{{ currency(totals.reimbursed) }}</strong>
      </div>
      <b>−</b>
      <div>
        <span>已到账津贴</span>
        <strong class="numbers">{{ currency(totals.allowance) }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ledger-summary {
  display: flex;
  align-items: center;
  gap: 35px;
  background: var(--green-light);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 26px;
}

.summary-main {
  min-width: 225px;
}

.summary-main > span {
  font-size: 13px;
  color: var(--green);
}

.summary-main > strong {
  font-size: 38px;
  font-weight: 500;
  display: block;
  margin: 10px 0 7px;
  overflow-wrap: anywhere;
}

.summary-main small {
  color: var(--text-secondary);
  font-size: 12px;
}

.summary-detail {
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 1;
  justify-content: space-between;
  padding-left: 30px;
  border-left: 1px solid color-mix(in srgb, var(--green) 18%, transparent);
}

.summary-detail span {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 12px;
}

.summary-detail strong {
  font-size: 19px;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.summary-detail b {
  font-weight: 400;
  color: var(--green);
}

@media (max-width: 1200px) {
  .ledger-summary {
    flex-wrap: wrap;
  }

  .summary-detail {
    border: 0;
    padding: 0;
    min-width: 100%;
  }
}

@media (max-width: 520px) {
  .ledger-summary {
    padding: 24px;
    gap: 25px;
  }

  .summary-detail {
    gap: 8px;
  }

  .summary-detail strong {
    font-size: 14px;
  }

  .summary-main > strong {
    font-size: 34px;
  }
}
</style>
