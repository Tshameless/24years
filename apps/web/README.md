# 24Years Web

孕期场景的单人本地 MVP。产品需求见仓库根目录 `docs/`，完整产品架构仍是后续目标。本应用先验证家庭档案、日常计划和记账流程。

## 运行与检查

环境：Node.js 22.12+，建议 24 LTS；pnpm 11。首次安装使用锁文件：

```powershell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5173 --strictPort
```

浏览器访问 <http://127.0.0.1:5173>。本地记录按来源隔离，请固定使用相同的地址和端口；`localhost`、`127.0.0.1` 和不同端口不共享存档。

```powershell
pnpm type-check
pnpm format:check
pnpm lint
pnpm lint:style
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

端到端测试自动在 `127.0.0.1:4173` 启动独立服务，覆盖 Chromium 桌面和 Pixel 7 手机视口，使用隔离的浏览器存储和固定日期。截图及失败跟踪输出到忽略提交的 `test-results/`。构建输出到 `dist/`；部署静态站点时应将未知路径回退到 `index.html`，以支持历史模式路由。

## 代码结构

```text
src/
  domain/family.ts         数据结构、存档校验、日历和金额运算
  composables/useFamily.ts 共享状态、本地写入、导出和跨日更新
  components/             布局及 home / tasks / ledger / family 功能组件
  views/                  路由页面组合
  router/                 懒加载路由与 404
  styles/                 公共样式、日夜主题和响应式布局
e2e/                      完整用户流程测试
```

组件使用 Composition API 与 `<script setup lang="ts">`，跨页面状态通过带类型的 provide/inject 共享；表单/列表采用 props 与 emits。业务计算不依赖 UI，可以单独测试。

代码统一使用两空格缩进、100 字符行宽和 LF 换行。Vue 多属性标签按属性逐行排列，嵌套标签明确换行；导入、函数、条件分支和样式规则之间留空行。使用 `pnpm format` 格式化、`pnpm format:check` 检查排版，ESLint 和 Stylelint 检查分组与规则间距。

## 数据约定和边界

- 存档键为 `24years.family.v1`，JSON 的 `version` 为 `1`。修改格式前需补充迁移方案，不应直接覆盖旧存档。
- 保存成功后才更新界面。遇到格式损坏时保留原始记录、禁止写入，并提供原始 JSON 导出。检测到其他页面已写入时阻止旧页面覆盖，刷新后继续；当前没有实时跨设备同步。
- 金额以整数分保存。净支出 = 总支出 − 已报销金额 − 已到账津贴，允许负值。津贴不计入支出或医保报销。
- 计划只有一次性和每日重复两种；每日打卡按日期保存。首页每 30 秒、窗口重新聚焦或可见性变化时更新日期。时间仅供显示排序，不会触发通知。
- 孕周基于医生确认的预产期和项目的 40 周日历约定估算，不包含临床评估或医疗建议。
- 静默关怀隐藏首页孕周、倒计时和今日任务，保留其他页面与数据。
- 数据仅在当前浏览器中，未加密。导出文件包含全部记录，请自行妥善保管；本版暂不支持导入恢复。无服务工作线程，不承诺断网冷启动。

## 后续开发

优先补齐带预览和确认的备份导入、已有计划与账目的编辑、计划历史记录。之后再接入账号/家庭权限/同步后端与 Uni-app 客户端。产检模板、健康指标和急救内容需独立医学审核，不应由页面逻辑推断生成。

## 已知开发依赖问题

2026-10-09 更新了 Vue、Router、Vite、测试环境和可兼容的间接依赖。完整依赖审计仍报告开发工具链中的 `braces`（尚无修复版）和 `eslint-plugin-vue` 使用的 `postcss-selector-parser`（6.x 分支）告警；它们不随本应用的浏览器构建发布。后续升级 ESLint 工具链时一并处理，不应将全量审计描述为无告警。
