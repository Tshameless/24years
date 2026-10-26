<script setup lang="ts">
import { computed } from 'vue';
import { currency, summarizeExpenses, type Expense, type FamilyProfile } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';

const props = defineProps<{
  profile: FamilyProfile | null;
  expenses: readonly Expense[];
  familyMode: 'single' | 'couple';
  sharedFamily: { readonly members: readonly unknown[] } | null;
}>();

const totals = computed(() => summarizeExpenses(props.expenses));
</script>

<template>
  <aside class="dashboard-aside">
    <section class="panel family-card">
      <div class="panel-heading">
        <h2>我们的陪伴空间</h2>
        <AppIcon
          name="heart"
          :size="19"
        />
      </div>
      <div class="family-circle">
        {{ profile?.nickname.slice(0, 1) || '你' }}
        <span>
          <AppIcon
            name="leaf"
            :size="14"
          />
        </span>
      </div>
      <h3>{{ profile?.name || '每一种家庭，都值得被珍惜' }}</h3>
      <p>
        {{
          familyMode === 'couple'
            ? sharedFamily
              ? `已有 ${sharedFamily.members.length} 位成员参与记录。`
              : '已选择多人家庭，一起参与陪伴。'
            : '一个人也可以完整记录。'
        }}
        <br />
        {{
          familyMode === 'couple'
            ? sharedFamily
              ? '计划与账本，在彼此之间同步。'
              : '开启同步后，可邀请另一位家长加入。'
            : '不需要绑定伴侣，就能开始。'
        }}
      </p>
      <RouterLink
        to="/family"
        class="text-button"
      >
        {{ profile ? '管理家庭档案' : '认识一下我们的家' }}
        <AppIcon
          name="arrow"
          :size="15"
        />
      </RouterLink>
    </section>
    <section class="panel ledger-preview">
      <div class="panel-heading">
        <h2>每一笔，都是心意</h2>
        <AppIcon
          name="wallet"
          :size="20"
        />
      </div>
      <span class="muted">累计净支出</span>
      <strong class="net-amount numbers">{{ currency(totals.net) }}</strong>
      <div class="mini-totals">
        <span>已记账</span>
        <strong>{{ expenses.length }} 笔</strong>
      </div>
      <div class="mini-totals">
        <span>报销与津贴</span>
        <strong class="numbers">{{ currency(totals.reimbursed + totals.allowance) }}</strong>
      </div>
      <RouterLink
        to="/ledger"
        class="button button-secondary"
      >
        去记一笔
        <AppIcon
          name="arrow"
          :size="16"
        />
      </RouterLink>
    </section>
    <div class="gentle-note">
      <AppIcon
        name="leaf"
        :size="18"
      />
      <p>
        陪伴不需要满分，
        <br />
        在场，本身就很重要。
      </p>
      <span>— A NOTE FOR YOU</span>
    </div>
  </aside>
</template>

<style scoped>
.dashboard-aside {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 22px;
}

.family-card {
  text-align: center;
}

.family-card .panel-heading {
  margin-bottom: 25px;
  text-align: left;
}

.family-card .panel-heading > svg {
  color: var(--primary);
}

.family-circle {
  width: 65px;
  height: 65px;
  margin: 0 auto 20px;
  background: var(--pink-light);
  color: var(--primary-ink);
  border: 5px solid var(--canvas);
  border-radius: 50%;
  position: relative;
  display: grid;
  place-items: center;
  font: 23px var(--font-serif);
}

.family-circle span {
  position: absolute;
  right: -7px;
  bottom: -2px;
  background: var(--green-light);
  border: 3px solid var(--surface);
  border-radius: 50%;
  padding: 3px;
  color: var(--green);
  display: grid;
  place-items: center;
}

.family-card h3 {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.family-card p {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.9;
  margin-bottom: 7px;
}

.ledger-preview {
  background: var(--green-light);
  border-color: transparent;
}

.ledger-preview h2 {
  font-size: 15px;
}

.ledger-preview .panel-heading svg {
  color: var(--green);
}

.ledger-preview > .muted {
  font-size: 12px;
}

.net-amount {
  display: block;
  font-size: 29px;
  font-weight: 500;
  margin: 12px 0 22px;
  overflow-wrap: anywhere;
}

.mini-totals {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 13px;
}

.mini-totals strong {
  font-weight: 500;
}

.ledger-preview .button {
  width: 100%;
  margin-top: 22px;
  background: transparent;
  border-color: color-mix(in srgb, var(--green) 20%, transparent);
  justify-content: space-between;
}

.gentle-note {
  padding: 4px 24px;
  color: var(--green);
}

.gentle-note p {
  font: 17px/1.9 var(--font-serif);
  margin: 8px 0;
  color: var(--text-secondary);
}

.gentle-note span {
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 950px) {
  .dashboard-aside {
    grid-template-columns: 1fr 1fr;
  }

  .gentle-note {
    display: none;
  }
}

@media (max-width: 520px) {
  .dashboard-aside {
    grid-template-columns: 1fr;
  }

  .family-card {
    display: none;
  }
}
</style>
