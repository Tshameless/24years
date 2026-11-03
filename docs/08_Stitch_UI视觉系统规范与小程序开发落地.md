# Stitch "Clinical Nurture" UI 视觉系统规范与小程序端落地文档

> **设计来源**：Google Stitch 官方项目 `projects/14273146544935528330`（*Multi-Platform 24years Client*）  
> **落地分支**：`mp-family-collaboration`  
> **适用终端**：微信小程序端（`apps/mp`，Uni-app + Vue 3 + TypeScript + SCSS）  
> **设计主题**：**Clinical Nurture**（循证温润 · 双人同频 · 临床去焦虑）

---

## 一、设计系统（Design System: Clinical Nurture）

基于 Google Stitch 生成的设计规范，确立了以“临床循证严谨”与“家庭温润关怀”为核心的视觉设计语言。

### 1. 核心色彩体系（Color Palette）

| Token 类别 | 变量名 | 色值 | 设计语义与应用场景 |
| :--- | :--- | :--- | :--- |
| **Primary** | `$color-primary` | `#b90538` | **核心品牌红（玫瑰浆果红）**：象征生命关爱与核心操作，用于主按钮、选中状态与关键警示数值 |
| Primary Container | `$color-primary-container` | `#dc2c4f` | 强调型容器底色 |
| Primary Fixed | `$color-primary-fixed` | `#ffdadb` | 浅粉色胶囊底色（孕周标签、主信息强调标签） |
| On Primary Fixed Variant | `$color-on-primary-fixed-variant` | `#92002a` | 浅粉色胶囊内的深红文字 |
| **Secondary** | `$color-secondary` | `#006c49` | **生命体征绿（循证翡翠绿）**：代表医学指标正常、健康、双人在线协同与津贴入账 |
| Secondary Container | `$color-secondary-container` | `#6cf8bb` | 浅薄荷绿容器底色 |
| On Secondary Container | `$color-on-secondary-container` | `#00714d` | 浅薄荷底色上的深绿文字 |
| Secondary Fixed | `$color-secondary-fixed` | `#6ffbbe` | 伴侣同频指示、健康高亮胶囊 |
| **Tertiary** | `$color-tertiary` | `#bb0112` | **预警红**：5-1-1临产应激、破水紧急干预、危险指标警戒线 |
| Tertiary Fixed | `$color-tertiary-fixed` | `#ffdad6` | 预警卡片与待办逾期背景 |
| **Surface** | `$color-surface` / `$color-background` | `#faf8ff` | **温润暖白天幕**：全局页面背景，摒弃冷色冰冷灰，营造舒缓环境 |
| Surface Low | `$color-surface-container-low` | `#f2f3ff` | 页面第二层底色、输入框背景、次级卡片 |
| Surface High | `$color-surface-container-high` | `#e2e7ff` | 分段选择器背景、胶囊未选中底色 |
| Surface Highest | `$color-surface-container-highest` | `#dae2fd` | 进度条底轨、边框分割线 |
| Surface Lowest | `$color-surface-lowest` | `#ffffff` | 卡片主要承载容器纯白底色 |
| **Text** | `$color-on-surface` | `#131b2e` | **深蓝夜幕黑**：一级标题与主要读数，高对比度防眩晕 |
| Text Muted | `$color-on-surface-variant` | `#5b4041` | 二级说明与辅文 |
| Outline | `$color-outline` | `#8f6f71` | 弱化边框与占位提示 |

---

### 2. 空间与形态规范（Spacing & Shapes）

* **圆角层次（Border Radius）**：
  * 卡片圆角：`$radius-lg: 24rpx`（温润圆角，弱化棱角带来的焦虑感）
  * 输入框/单元格：`$radius-md: 16rpx`
  * 胶囊徽标/状态点：`$radius-full: 9999rpx`（全药丸胶囊风格）
* **阴影规范（Elevation & Shadows）**：
  * 微卡片阴影：`0 4rpx 20rpx rgba(19, 27, 46, 0.05)`
  * 品牌主动作按钮投影：`0 4rpx 14rpx rgba(185, 5, 56, 0.25)`
  * 协同绿点光晕：`0 8rpx 24rpx rgba(0, 108, 73, 0.12)`

---

## 二、小程序端重点页面重构与改造实施

### 1. 全局样式架构升级

1. **`apps/mp/src/uni.scss`**
   * 注入完整的 Stitch Design Tokens（主色、次色、背景阶梯色、圆角、阴影）。
   * 映射适配 Uni-app 原生扩展规范，让所有分页面与组件自动获得变量支撑。
2. **`apps/mp/src/pages.json`**
   * 全局背景色切换为 Stitch 暖白：`#faf8ff`。
   * TabBar 视觉升级：未选中色设为 `#5b4041`，选中高亮设为 `#b90538`。
3. **`apps/mp/src/App.vue`**
   * 建立统一的 `.card` 质感（纯白卡片 + 24rpx 圆角 + 柔和边界线）。
   * 封装标准化 `.pill`（Pill Badges）、`.pulse-dot`（双人协同脉冲绿点）与按钮规范。

---

### 2. 核心业务页面改造落地

#### (1) 今日陪伴首页（`pages/index/index.vue`）
* **对应 Stitch 稿**：`MOBILE_今日陪伴与双人协作.html`
* **改造落地**：
  * **Ambient 渐变首卡**：引入 `-top-40rpx` 与 `-bottom-40rpx` 的绿色/粉色多层柔光粒子光晕。
  * **孕周双轨长河**：上方陈列 `孕28周+4天`（粉色胶囊）与 `距预产期 87 天`（浅灰紫胶囊），中间为双轨渐变进度条。
  * **双人同频标识**：增加“准妈 · 孕周体征”与“准爸/家人 · 同步守护”节点。
  * **真实自费工作台预览**：大字号展示本月净支出 `¥0.00`，拆分支出与津贴双侧对照。
  * **待办打卡**：升级为带圆环勾选动效的协作流卡片。

#### (2) 孕期记录与监测中心（`pages/pregnancy/index.vue`）
* **对应 Stitch 稿**：`MOBILE_产检体征与去焦虑解码.html` & `MOBILE_5-1-1临产应激与宫缩计时.html`
* **改造落地**：
  * **分段切换器（Segmented Pills）**：药丸胶囊状滚动 Tabs，选中态赋予 `#b90538` 阴影高亮。
  * **快捷通道入口**：顶部双卡卡片导航至“体征趋势图”与“产检排期”。
  * **体征双轨记录**：高低压双值输入、血糖多场景分类选择。
  * **5-1-1 临产应激与宫缩计时**：大号计时器数字（`52rpx` 粗体），融入规则三联指标卡片与红绿警戒提示。

#### (3) 产检排期与体征趋势（`schedule.vue` & `trends.vue`）
* **排期时间轴**：每个产检节点增加状态胶囊（已完成、当前节点、已排期），左侧状态色彩边框条。
* **趋势图表**：适配 Clinical Nurture 页面底色，数值与表格采用翡翠绿和高对比度深蓝。

#### (4) 家庭账本与生育津贴工作台（`pages/ledger/index.vue`）
* **对应 Stitch 稿**：`MOBILE_家庭账本与生育津贴工作台.html`
* **改造落地**：
  * **真实生娃净成本大卡片（Net Maternity Impact Ledger）**：
    * 采用 `60rpx` 特大加粗数字高亮净支出金额。
    * 左右双栏：左侧总支出（红色强调），右侧已报销/津贴（绿色强调）。
  * **横向胶囊分类筛选器**：支持滑动无缝切换 `全部`、`津贴`、`产检医疗`、`分娩母婴` 等分类。
  * **明细列表卡片化**：区分正负向现金流与报销状态小胶囊。

#### (5) 家庭共享与接入中心（`pages/collab/index.vue`）
* **对应 Stitch 稿**：`MOBILE_登录与家庭接入.html`
* **改造落地**：
  * **品牌徽章与美学**：顶部设立“24Years · 双人家庭协同”品牌卡片，配端到端加密微标。
  * **动态协作指示**：同步中显示呼吸绿点，离线与单机模式显示灰调。
  * **邀请码高亮卡片**：大字号邀请码，支持点击一键复制，伴侣加入更直观。

#### (6) 档案与日常设置（`profile/edit.vue`, `tasks/index.vue`, `mine/index.vue`, `settings/index.vue`）
* 全面替换原生开关颜色（`switch: #b90538`）。
* 输入框、日历选择器统一样式为 Clinical Nurture 的圆角浅底色风格。

---

## 三、代码与构建验证

在当前分支执行完整测试与编译验证：
1. **类型检查**：
   ```bash
   pnpm --filter 24years-mp type-check
   # 结果：vue-tsc --noEmit 成功，0 错误
   ```
2. **微信小程序构建**：
   ```bash
   pnpm --filter 24years-mp build:mp-weixin
   # 结果：DONE Build complete. 产物生成于 dist/build/mp-weixin
   ```

---

## 四、Stitch 资产保存路径

通过 Stitch MCP 下载的完整 HTML/CSS 原型文件已保存在项目仓库中，供后续页面迭代对照查阅：
* 目录路径：`apps/mp/stitch-design-assets/`
* 包含主要页面：
  * `MOBILE_今日陪伴与双人协作.html`
  * `MOBILE_产检体征与去焦虑解码.html`
  * `MOBILE_家庭账本与生育津贴工作台.html`
  * `MOBILE_5-1-1临产应激与宫缩计时.html`
  * `MOBILE_登录与家庭接入.html`
  * `MOBILE_阶段切换与生命周期管理.html`
  * `MOBILE_欢迎与家庭建档向导.html`
