<script setup lang="ts">
import { computed } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { currency, summarizeExpenses } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';
import JourneyCard from './JourneyCard.vue';
import TaskList from '@/components/tasks/TaskList.vue';

const { data, today, todayTasks, toggleTask, locked } = useFamily();

const totals = computed(() => summarizeExpenses(data.value.expenses));

const completed = computed(
  () => todayTasks.value.filter((task) => task.completedDates.includes(today.value)).length,
);

const dateLabel = computed(() =>
  new Date(`${today.value}T12:00:00`).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }),
);
</script>

<template>
  <div class="fade-in">
    <header class="page-heading">
      <div>
        <p class="eyebrow">A LITTLE CARE, EVERY DAY</p>
        <h1>
          {{
            data.profile?.nickname
              ? `${data.profile.nickname}，今天也要好好的`
              : '你好，欢迎来到 24Years'
          }}
        </h1>
        <p>
          {{
            data.profile?.quietMode
              ? '把时间留给自己，不必完成任何期待。'
              : '把平凡的一天，过成值得珍藏的小事。'
          }}
        </p>
      </div>
      <span class="today-date">
        <AppIcon
          name="calendar"
          :size="16"
        />
        {{ dateLabel }}
      </span>
    </header>
    <div class="dashboard-grid">
      <div class="dashboard-main">
        <JourneyCard
          :profile="data.profile"
          :today="today"
        />
        <section
          v-if="!data.profile?.quietMode"
          class="panel"
        >
          <div class="panel-heading">
            <div class="section-title">
              <span class="section-accent" />
              <h2>今日的小计划</h2>
              <span class="count">{{ completed }}/{{ todayTasks.length }}</span>
            </div>
            <RouterLink
              to="/tasks"
              class="text-button"
            >
              <AppIcon
                name="plus"
                :size="15"
              />
              添加计划
            </RouterLink>
          </div>
          <TaskList
            :tasks="todayTasks"
            :date="today"
            :disabled="locked"
            @toggle="toggleTask($event, today)"
          />
          <p class="task-footnote">留一点时间照顾自己，也是一件重要的事。</p>
        </section>
        <section
          v-else
          class="panel quiet-message"
        >
          <AppIcon
            name="leaf"
            :size="28"
          />
          <div>
            <h2>这里一直为你留着位置</h2>
            <p class="muted">你的资料与历史记录不会被删除。首页不会展示孕周、倒计时或任务提示。</p>
          </div>
        </section>
      </div>
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
            {{ data.profile?.nickname.slice(0, 1) || '你' }}
            <span>
              <AppIcon
                name="leaf"
                :size="14"
              />
            </span>
          </div>
          <h3>{{ data.profile?.name || '每一种家庭，都值得被珍惜' }}</h3>
          <p>
            一个人也可以完整记录。
            <br />
            不需要绑定伴侣，就能开始。
          </p>
          <RouterLink
            to="/family"
            class="text-button"
          >
            {{ data.profile ? '管理家庭档案' : '认识一下我们的家' }}
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
            <strong>{{ data.expenses.length }} 笔</strong>
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
    </div>
  </div>
</template>

<style scoped>
.today-date {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 285px;
  gap: 25px;
}

.dashboard-main,
.dashboard-aside {
  min-width: 0;
}

.dashboard-aside {
  display: grid;
  align-content: start;
  gap: 22px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-accent {
  width: 3px;
  height: 16px;
  background: var(--green);
  border-radius: 3px;
}

.count {
  font-size: 12px;
  color: var(--muted);
}

.task-footnote {
  padding-top: 18px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--muted);
  margin: 18px 0 0;
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

.quiet-message {
  display: flex;
  gap: 20px;
}

.quiet-message > svg {
  flex-shrink: 0;
  color: var(--green);
}

.quiet-message p {
  margin-top: 15px;
}

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 20px;
  }

  .today-date {
    display: none;
  }
}

@media (max-width: 950px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

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

  .section-title {
    gap: 6px;
  }

  .section-title h2 {
    font-size: 16px;
  }
}
</style>
