# 三栏结构功能优化与问题修复 — 设计文档

> 日期：2026-05-27
> 分支：feature/three-column-optimization
> 方案：SidebarPanel 内扩展（方案 A）

---

## 1. 整体架构

### 1.1 导航图标变更（第1栏 IconSidebar）

| 变更 | 原值 | 新值 |
|------|------|------|
| characterAura 图标 | Sparkles + `nav.characterAura` | Sparkles + `nav.soul`（中文"灵魂"） |
| dashboard 图标 | LayoutDashboard + `nav.dashboard` | LayoutDashboard + `nav.reviewCenter`（中文"审查中心"） |
| review 导航项 | 保留在 NAV_ITEMS | 移除，功能合并到审查中心 |

### 1.2 activeView 类型变更

```typescript
// 原
"wiki" | "sources" | "search" | "graph" | "lint" | "review" | "characterAura" | "settings" | "trash" | "dashboard"
// 新
"wiki" | "sources" | "search" | "graph" | "lint" | "soul" | "settings" | "trash" | "reviewCenter"
```

移除 `review`、`characterAura`、`dashboard`，新增 `soul`、`reviewCenter`。

注意：原 `review` 在非 novelMode 下也有用途（wiki 审稿），合并后 `reviewCenter` 同时支持两种模式。非小说模式下第2栏显示原有审稿列表，小说模式下显示6维审查+AI审阅。

### 1.3 SidebarPanel 扩展（第2栏）

在 SidebarPanel 中增加 3 个 activeView 分支：

- `activeView === "graph"` → GraphSidebarPanel（模式+筛选器）
- `activeView === "soul"` → SoulSidebarPanel（项目灵魂/角色灵魂分类）
- `activeView === "reviewCenter"` → ReviewCenterSidebarPanel（6维审查+AI审阅）

### 1.4 ContentArea 变更（第3栏）

| 视图 | 变更 |
|------|------|
| graph | 移除顶栏控件（迁移到第2栏），保留图谱画布+Insights面板 |
| soul | 替换原 characterAura，显示选中灵魂的编辑/详情界面 |
| reviewCenter | 新视图，显示选中审查维度的分析结果 |

---

## 2. 图谱交互优化

### 2.1 第2栏：GraphSidebarPanel

从 graph-view.tsx 顶栏迁移以下控件到第2栏：

- 标题"小说图谱"
- 模式选择下拉（概览/角色/地点/伏笔等）
- 显示模式下拉（图谱/文档/思维导图）
- 颜色模式（类型/社区）
- 标签显示（全部/自动/聚焦）
- 筛选器面板（隐藏索引页、隐藏孤立节点、节点类型勾选、最大关联数）
- 节点类型图例（带颜色圆点+数量，双击切换可见性）
- 当前统计（节点数/边数/隐藏数）

选中状态：点击某节点类型时高亮，第3栏图谱自动筛选。

### 2.2 第3栏：GraphView 精简

移除：顶栏控件、底部图例面板
保留：图谱画布、ZoomControls、Insights 侧面板、右键菜单、线条设置

### 2.3 状态共享

wiki-store 新增字段：

```typescript
selectedGraphMode: GraphMode
selectedDisplayMode: "graph" | "document" | "mindmap"
selectedColorMode: "type" | "community"
selectedLabelMode: "all" | "auto" | "focused"
graphFilters: GraphFilterState
```

第2栏写入，第3栏读取并响应。

---

## 3. 灵魂内容展示与交互

### 3.1 第2栏：SoulSidebarPanel

结构：

```
┌─────────────────────┐
│ 灵魂                 │
├─────────────────────┤
│ [项目灵魂] [角色灵魂] │
├─────────────────────┤
│ 项目灵魂：            │
│  · 项目灵魂文档       │
├─────────────────────┤
│ 角色灵魂：            │
│  [内置灵魂] [自定义]  │
│  · 诸葛亮            │
│  · 曹操              │
│  · 自定义灵魂A       │
│  · + 新建角色灵魂     │
└─────────────────────┘
```

交互逻辑：

- 点击"项目灵魂"Tab → 第2栏显示项目灵魂条目 → 点击条目 → 第3栏显示 SoulDocEditor
- 点击"角色灵魂"Tab → 第2栏显示内置/自定义子Tab + 灵魂列表 → 点击某灵魂 → 第3栏显示 AuraDetails
- 点击"+ 新建角色灵魂" → 第3栏显示 CustomAuraForm（创建模式）

### 3.2 选中状态

通过 wiki-store 新增 `selectedSoulId: string | null` 追踪选中状态，使用 `qm-selected` 样式高亮。

### 3.3 第3栏：SoulView

复用现有 CharacterAuraView 中的子组件，拆分为独立视图：

- SoulDocEditor：项目灵魂编辑（已有）
- AuraDetails：灵魂详情展示（已有）
- CustomAuraForm：自定义灵魂创建/编辑（已有）

不再需要 CharacterAuraView 的整体布局，改为由第2栏驱动第3栏内容切换。

---

## 4. 审查中心（仪表盘+AI审稿合并）

### 4.1 第2栏：ReviewCenterSidebarPanel

结构：

```
┌─────────────────────┐
│ 审查中心              │
├─────────────────────┤
│ 六维审查              │
│  · 爽感密度  (3)      │
│  · 设定自洽  (2)      │
│  · 节奏张力  (1)      │
│  · 人设一致  (0)      │
│  · 叙事衔接  (1)      │
│  · 追读引力  (2)      │
├─────────────────────┤
│ AI审阅               │
│  · AI审阅             │
├─────────────────────┤
│ 阻塞:0 高:2 中:4 低:1│
└─────────────────────┘
```

### 4.2 六维审查维度定义

| 维度 | 名称 | 检查重点 | 映射 type |
|------|------|----------|-----------|
| 1 | 爽感密度 | 爽点分布是否合理、密度是否足够 | high-point |
| 2 | 设定自洽 | 战力/地点/时间线等设定是否自相矛盾 | consistency |
| 3 | 节奏张力 | 叙事节奏是否合理、张弛是否有度 | pacing |
| 4 | 人设一致 | 角色行为是否偏离人设、对话是否符合性格 | ooc |
| 5 | 叙事衔接 | 场景转换是否自然、前后文是否衔接 | continuity |
| 6 | 追读引力 | 章末钩子是否有力、读者期待管理是否到位 | reader-pull |

数据来源：基于现有 review-adapter.ts 的 NovelReviewResult，按 type 字段映射到6个维度。未覆盖的维度显示"(0)"。

### 4.3 AI审阅功能

复用现有 ReviewView 中的 handleNovelReview 逻辑。点击"AI审阅"后第3栏显示审稿界面（章节选择+审稿按钮+结果列表）。

### 4.4 第3栏：ReviewCenterView

| 选中项 | 第3栏内容 |
|--------|----------|
| 爽感密度 | 该维度的审查结果列表 + AI改写操作 |
| 设定自洽 | 同上 |
| ... | 同上 |
| AI审阅 | 章节审稿界面 |

6维审查结果视图复用 DashboardView 中的 renderDashCard 逻辑，按维度过滤显示。

### 4.5 仪表盘原有功能保留

- 事实核查（factcheck）结果 → 归入"设定自洽"维度
- 伏笔债务 → 归入"叙事衔接"维度
- AI改写/恢复/忽略操作 → 保留在各维度结果中
- 严重度分组 → 保留在各维度结果内部

---

## 5. 涉及文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| src/stores/wiki-store.ts | 修改 | activeView 类型变更，新增图谱/灵魂状态字段 |
| src/components/layout/icon-sidebar.tsx | 修改 | 导航项调整 |
| src/components/layout/sidebar-panel.tsx | 修改 | 新增3个 activeView 分支 |
| src/components/layout/content-area.tsx | 修改 | 视图路由调整 |
| src/components/graph/graph-view.tsx | 修改 | 移除顶栏控件，改为读取 store 状态 |
| src/components/novel/character-aura-view.tsx | 修改 | 拆分为子组件导出 |
| src/components/dashboard/dashboard-view.tsx | 修改 | 提取 renderDashCard 为可复用函数 |
| src/components/review/review-view.tsx | 修改 | 提取审稿核心逻辑为可复用函数 |
| src/components/layout/graph-sidebar-panel.tsx | 新增 | 图谱第2栏面板 |
| src/components/layout/soul-sidebar-panel.tsx | 新增 | 灵魂第2栏面板 |
| src/components/layout/review-center-sidebar-panel.tsx | 新增 | 审查中心第2栏面板 |
| src/components/review/review-center-view.tsx | 新增 | 审查中心第3栏视图 |
| src/components/novel/soul-view.tsx | 新增 | 灵魂第3栏视图 |
| src/i18n/zh.json | 修改 | 新增中文翻译 |
| src/i18n/en.json | 修改 | 新增英文翻译 |
