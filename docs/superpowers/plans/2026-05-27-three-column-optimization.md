# 三栏结构功能优化与问题修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化三栏布局的交互体验，修复图谱点击无响应问题，重构灵魂和审查中心模块

**Architecture:** 在 SidebarPanel 内扩展 activeView 分支（方案 A），新增 graph/soul/reviewCenter 三个侧边栏面板，精简第3栏视图。状态通过 wiki-store 共享。

**Tech Stack:** React, Zustand, TypeScript, Tailwind CSS, react-i18next

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/stores/wiki-store.ts` | 修改 | activeView 类型变更，新增图谱/灵魂/审查中心状态字段 |
| `src/components/layout/icon-sidebar.tsx` | 修改 | NAV_ITEMS 调整：移除 review，重命名 characterAura→soul、dashboard→reviewCenter |
| `src/components/layout/sidebar-panel.tsx` | 修改 | 新增 3 个 activeView 分支路由 |
| `src/components/layout/content-area.tsx` | 修改 | 视图路由调整：移除 review/characterAura/dashboard，新增 soul/reviewCenter |
| `src/components/layout/graph-sidebar-panel.tsx` | 新增 | 图谱第2栏面板 |
| `src/components/layout/soul-sidebar-panel.tsx` | 新增 | 灵魂第2栏面板 |
| `src/components/layout/review-center-sidebar-panel.tsx` | 新增 | 审查中心第2栏面板 |
| `src/components/graph/graph-view.tsx` | 修改 | 移除顶栏控件，改为读取 store 状态 |
| `src/components/novel/soul-view.tsx` | 新增 | 灵魂第3栏视图 |
| `src/components/review/review-center-view.tsx` | 新增 | 审查中心第3栏视图 |
| `src/i18n/zh.json` | 修改 | 新增翻译 key |
| `src/i18n/en.json` | 修改 | 新增翻译 key |

---

### Task 1: wiki-store 类型与状态扩展

**Files:**
- Modify: `src/stores/wiki-store.ts:352` (activeView 类型)
- Modify: `src/stores/wiki-store.ts:328-409` (WikiState 接口)

- [ ] **Step 1: 修改 activeView 联合类型**

在 `src/stores/wiki-store.ts` L352，将 activeView 类型从：

```typescript
activeView: "wiki" | "sources" | "search" | "graph" | "lint" | "review" | "characterAura" | "settings" | "trash" | "dashboard"
```

改为：

```typescript
activeView: "wiki" | "sources" | "search" | "graph" | "lint" | "soul" | "settings" | "trash" | "reviewCenter"
```

- [ ] **Step 2: 在 WikiState 接口中新增灵魂和审查中心状态字段**

在 `src/stores/wiki-store.ts` WikiState 接口中，`activeView` 行之后添加：

```typescript
selectedSoulId: string | null
selectedSoulTab: "project" | "character"
selectedSoulSection: "builtIn" | "custom"
selectedReviewDimension: string | null
```

- [ ] **Step 3: 在 WikiState 接口中新增 setter 方法**

在 `setActiveView` 行之后添加：

```typescript
setSelectedSoulId: (id: string | null) => void
setSelectedSoulTab: (tab: "project" | "character") => void
setSelectedSoulSection: (section: "builtIn" | "custom") => void
setSelectedReviewDimension: (dimension: string | null) => void
```

- [ ] **Step 4: 在 store 实现中添加初始值和 setter 实现**

在 `src/stores/wiki-store.ts` 的 `useWikiStore` 实现中，`activeView` 初始值行之后添加：

```typescript
selectedSoulId: null,
selectedSoulTab: "project",
selectedSoulSection: "builtIn",
selectedReviewDimension: null,
```

在 `setActiveView` setter 实现之后添加：

```typescript
setSelectedSoulId: (id) => set({ selectedSoulId: id }),
setSelectedSoulTab: (tab) => set({ selectedSoulTab: tab }),
setSelectedSoulSection: (section) => set({ selectedSoulSection: section }),
setSelectedReviewDimension: (dimension) => set({ selectedReviewDimension: dimension }),
```

- [ ] **Step 5: 更新类型导出**

确认 `WikiState` 类型已导出（L547 附近），无需额外修改。

- [ ] **Step 6: 提交**

```bash
git add src/stores/wiki-store.ts
git commit -m "feat: extend wiki-store with soul/reviewCenter activeView types and state"
```

---

### Task 2: i18n 翻译更新

**Files:**
- Modify: `src/i18n/zh.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: 更新 zh.json 的 nav 翻译**

在 `src/i18n/zh.json` 的 `nav` 对象中（L43-55），将：

```json
"review": "待审阅",
"characterAura": "灵魂",
"dashboard": "项目仪表盘"
```

改为：

```json
"soul": "灵魂",
"reviewCenter": "审查中心"
```

- [ ] **Step 2: 更新 zh.json 的 novel.nav 翻译**

在 `src/i18n/zh.json` 的 `novel.nav` 对象中（L803-814），将：

```json
"review": "AI 审稿",
"characterAura": "灵魂",
"dashboard": "项目仪表盘"
```

改为：

```json
"soul": "灵魂",
"reviewCenter": "审查中心"
```

- [ ] **Step 3: 在 zh.json 中新增审查中心翻译 key**

在 `src/i18n/zh.json` 的 `dashboard` 对象同级位置，新增 `reviewCenter` 对象：

```json
"reviewCenter": {
  "title": "审查中心",
  "sixDimensions": "六维审查",
  "aiReview": "AI审阅",
  "dimension": {
    "thrill": "爽感密度",
    "consistency": "设定自洽",
    "pacing": "节奏张力",
    "character": "人设一致",
    "continuity": "叙事衔接",
    "pull": "追读引力"
  },
  "dimensionDesc": {
    "thrill": "爽点分布是否合理、密度是否足够",
    "consistency": "战力/地点/时间线等设定是否自相矛盾",
    "pacing": "叙事节奏是否合理、张弛是否有度",
    "character": "角色行为是否偏离人设、对话是否符合性格",
    "continuity": "场景转换是否自然、前后文是否衔接",
    "pull": "章末钩子是否有力、读者期待管理是否到位"
  },
  "noResults": "暂无该维度审查结果",
  "stats": "阻塞:{{blocking}} 高:{{high}} 中:{{medium}} 低:{{low}}"
}
```

- [ ] **Step 4: 在 zh.json 中新增灵魂侧边栏翻译 key**

在 `src/i18n/zh.json` 的 `novel.soul` 对象中，新增：

```json
"projectSoulItem": "项目灵魂文档",
"builtInSoul": "内置灵魂",
"customSoul": "自定义灵魂",
"newCustomSoul": "+ 新建角色灵魂",
"noCustomSoul": "暂无自定义灵魂"
```

- [ ] **Step 5: 更新 en.json 的 nav 翻译**

在 `src/i18n/en.json` 的 `nav` 对象中，将：

```json
"review": "Review",
"characterAura": "Soul",
"dashboard": "Dashboard"
```

改为：

```json
"soul": "Soul",
"reviewCenter": "Review Center"
```

- [ ] **Step 6: 更新 en.json 的 novel.nav 翻译**

在 `src/i18n/en.json` 的 `novel.nav` 对象中，将：

```json
"review": "AI 审稿",
"characterAura": "Soul",
"dashboard": "Dashboard"
```

改为：

```json
"soul": "Soul",
"reviewCenter": "Review Center"
```

- [ ] **Step 7: 在 en.json 中新增审查中心翻译 key**

在 `src/i18n/en.json` 中新增 `reviewCenter` 对象：

```json
"reviewCenter": {
  "title": "Review Center",
  "sixDimensions": "Six Dimensions",
  "aiReview": "AI Review",
  "dimension": {
    "thrill": "Thrill Density",
    "consistency": "Setting Consistency",
    "pacing": "Pacing Tension",
    "character": "Character Consistency",
    "continuity": "Narrative Continuity",
    "pull": "Reader Pull"
  },
  "dimensionDesc": {
    "thrill": "Whether thrill points are well-distributed and sufficient",
    "consistency": "Whether power system/locations/timeline are self-consistent",
    "pacing": "Whether narrative pacing is reasonable",
    "character": "Whether character behavior matches their personality",
    "continuity": "Whether scene transitions are natural",
    "pull": "Whether chapter-end hooks are compelling"
  },
  "noResults": "No review results for this dimension",
  "stats": "Blocking:{{blocking}} High:{{high}} Medium:{{medium}} Low:{{low}}"
}
```

- [ ] **Step 8: 在 en.json 中新增灵魂侧边栏翻译 key**

在 `src/i18n/en.json` 的 `novel.soul` 对象中，新增：

```json
"projectSoulItem": "Project Soul Document",
"builtInSoul": "Built-in Soul",
"customSoul": "Custom Soul",
"newCustomSoul": "+ New Character Soul",
"noCustomSoul": "No custom souls yet"
```

- [ ] **Step 9: 提交**

```bash
git add src/i18n/zh.json src/i18n/en.json
git commit -m "feat: add i18n keys for soul sidebar and review center"
```

---

### Task 3: IconSidebar 导航项调整

**Files:**
- Modify: `src/components/layout/icon-sidebar.tsx:23-31` (NAV_ITEMS)

- [ ] **Step 1: 修改 NAV_ITEMS 数组**

在 `src/components/layout/icon-sidebar.tsx` L23-31，将 NAV_ITEMS 从：

```typescript
const NAV_ITEMS: { view: NavView; icon: typeof FileText; labelKey: string; novelLabelKey: string }[] = [
  { view: "wiki", icon: FileText, labelKey: "nav.wiki", novelLabelKey: "novel.nav.wiki" },
  { view: "sources", icon: FolderOpen, labelKey: "nav.sources", novelLabelKey: "novel.nav.sources" },
  { view: "graph", icon: Network, labelKey: "nav.graph", novelLabelKey: "novel.nav.graph" },
  { view: "lint", icon: Brain, labelKey: "nav.lint", novelLabelKey: "novel.nav.lint" },
  { view: "review", icon: ClipboardList, labelKey: "nav.review", novelLabelKey: "novel.nav.review" },
  { view: "characterAura", icon: Sparkles, labelKey: "nav.characterAura", novelLabelKey: "novel.nav.characterAura" },
  { view: "dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard", novelLabelKey: "novel.nav.dashboard" },
]
```

改为：

```typescript
const NAV_ITEMS: { view: NavView; icon: typeof FileText; labelKey: string; novelLabelKey: string }[] = [
  { view: "wiki", icon: FileText, labelKey: "nav.wiki", novelLabelKey: "novel.nav.wiki" },
  { view: "sources", icon: FolderOpen, labelKey: "nav.sources", novelLabelKey: "novel.nav.sources" },
  { view: "graph", icon: Network, labelKey: "nav.graph", novelLabelKey: "novel.nav.graph" },
  { view: "lint", icon: Brain, labelKey: "nav.lint", novelLabelKey: "novel.nav.lint" },
  { view: "soul", icon: Sparkles, labelKey: "nav.soul", novelLabelKey: "novel.nav.soul" },
  { view: "reviewCenter", icon: LayoutDashboard, labelKey: "nav.reviewCenter", novelLabelKey: "novel.nav.reviewCenter" },
]
```

变更：移除 `review` 和 `dashboard` 项，将 `characterAura` 改为 `soul`，将 `dashboard` 的图标 `LayoutDashboard` 移给 `reviewCenter`。

- [ ] **Step 2: 移除 ClipboardList 导入（如不再使用）**

检查 `ClipboardList` 是否在文件其他位置使用。如果仅在 NAV_ITEMS 中使用，移除其 import。

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/icon-sidebar.tsx
git commit -m "feat: update NAV_ITEMS for soul and reviewCenter views"
```

---

### Task 4: ContentArea 视图路由调整

**Files:**
- Modify: `src/components/layout/content-area.tsx:67-125` (switch-case)

- [ ] **Step 1: 修改视图路由 switch-case**

在 `src/components/layout/content-area.tsx` L67-125，将 switch-case 从：

```typescript
switch (activeView) {
  case "wiki":
  case "trash":
    return <WritingWorkspace />
  case "settings":
    return <Suspense fallback={<LoadingView />}><SettingsView /></Suspense>
  case "sources":
    return <Suspense fallback={<LoadingView />}><SourcesView /></Suspense>
  case "review":
    return <Suspense fallback={<LoadingView />}><ReviewView /></Suspense>
  case "characterAura":
    return <Suspense fallback={<LoadingView />}><CharacterAuraView /></Suspense>
  case "lint":
    return <Suspense fallback={<LoadingView />}>{novelMode ? <MemoryCenterView /> : <LintView />}</Suspense>
  case "search":
    return <Suspense fallback={<LoadingView />}><SearchView /></Suspense>
  case "graph":
    return <Suspense fallback={<LoadingView />}><GraphView /></Suspense>
  case "dashboard":
    return <Suspense fallback={<LoadingView />}><DashboardView /></Suspense>
  default:
    return <Suspense fallback={<LoadingView />}><ChatPanel /></Suspense>
}
```

改为：

```typescript
switch (activeView) {
  case "wiki":
  case "trash":
    return <WritingWorkspace />
  case "settings":
    return <Suspense fallback={<LoadingView />}><SettingsView /></Suspense>
  case "sources":
    return <Suspense fallback={<LoadingView />}><SourcesView /></Suspense>
  case "soul":
    return <Suspense fallback={<LoadingView />}><SoulView /></Suspense>
  case "lint":
    return <Suspense fallback={<LoadingView />}>{novelMode ? <MemoryCenterView /> : <LintView />}</Suspense>
  case "search":
    return <Suspense fallback={<LoadingView />}><SearchView /></Suspense>
  case "graph":
    return <Suspense fallback={<LoadingView />}><GraphView /></Suspense>
  case "reviewCenter":
    return <Suspense fallback={<LoadingView />}><ReviewCenterView /></Suspense>
  default:
    return <Suspense fallback={<LoadingView />}><ChatPanel /></Suspense>
}
```

- [ ] **Step 2: 更新懒加载导入**

在 `src/components/layout/content-area.tsx` 顶部，将：

```typescript
const ReviewView = lazy(() => import("@/components/review/review-view"))
const CharacterAuraView = lazy(() => import("@/components/novel/character-aura-view"))
const DashboardView = lazy(() => import("@/components/dashboard/dashboard-view"))
```

改为：

```typescript
const SoulView = lazy(() => import("@/components/novel/soul-view"))
const ReviewCenterView = lazy(() => import("@/components/review/review-center-view"))
```

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/content-area.tsx
git commit -m "feat: update ContentArea routing for soul and reviewCenter views"
```

---

### Task 5: GraphSidebarPanel 组件

**Files:**
- Create: `src/components/layout/graph-sidebar-panel.tsx`

- [ ] **Step 1: 创建 GraphSidebarPanel 组件**

创建 `src/components/layout/graph-sidebar-panel.tsx`：

```tsx
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { Filter, SlidersHorizontal, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GraphMode } from "@/components/graph/graph-view"

type ColorMode = "type" | "community"
type GraphDisplayMode = "graph" | "document" | "mindmap"
type GraphLabelDisplayMode = "all" | "auto" | "focused"
type GraphEdgeStyle = "curve" | "arrow" | "line"

interface GraphSidebarPanelProps {
  graphMode: GraphMode
  setGraphMode: (mode: GraphMode) => void
  displayMode: GraphDisplayMode
  setDisplayMode: (mode: GraphDisplayMode) => void
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  labelDisplayMode: GraphLabelDisplayMode
  setLabelDisplayMode: (mode: GraphLabelDisplayMode) => void
  showFilters: boolean
  setShowFilters: (v: boolean) => void
  showEdgeControls: boolean
  setShowEdgeControls: (v: boolean) => void
  edgeStyle: GraphEdgeStyle
  setEdgeStyle: (style: GraphEdgeStyle) => void
  edgeColorHex: string
  setEdgeColorHex: (hex: string) => void
  edgeStrengthPercent: number
  setEdgeStrengthPercent: (pct: number) => void
  nodeCount: number
  edgeCount: number
  hiddenCount: number
  filteredNodeCount: number
  filteredEdgeCount: number
  onRefresh: () => void
  loading: boolean
}

const GRAPH_MODE_LABELS: Record<GraphMode, string> = {
  overview: "概览",
  character: "角色",
  chapter: "章节",
  storyline: "故事线",
  foreshadowing: "伏笔",
  location: "地点",
}

export function GraphSidebarPanel(props: GraphSidebarPanelProps) {
  const { t } = useTranslation()
  const {
    graphMode, setGraphMode,
    displayMode, setDisplayMode,
    colorMode, setColorMode,
    labelDisplayMode, setLabelDisplayMode,
    showFilters, setShowFilters,
    showEdgeControls, setShowEdgeControls,
    edgeStyle, setEdgeStyle,
    edgeColorHex, setEdgeColorHex,
    edgeStrengthPercent, setEdgeStrengthPercent,
    nodeCount, edgeCount, hiddenCount,
    filteredNodeCount, filteredEdgeCount,
    onRefresh, loading,
  } = props

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold text-foreground">
          {t("novel.graph.title")}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">图谱模式</label>
          <select
            value={graphMode}
            onChange={(e) => setGraphMode(e.target.value as GraphMode)}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(GRAPH_MODE_LABELS) as GraphMode[]).map((mode) => (
              <option key={mode} value={mode}>{GRAPH_MODE_LABELS[mode]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">显示模式</label>
          <select
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as GraphDisplayMode)}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="graph">{t("novel.graph.displayModeGraph")}</option>
            <option value="document">{t("novel.graph.displayModeDocument")}</option>
            <option value="mindmap">{t("novel.graph.displayModeMindmap")}</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">颜色模式</label>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="type">{t("graph.type")}</option>
            <option value="community">{t("graph.community")}</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">标签显示</label>
          <select
            value={labelDisplayMode}
            onChange={(e) => setLabelDisplayMode(e.target.value as GraphLabelDisplayMode)}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">{t("graph.labelDisplayAll")}</option>
            <option value="auto">{t("graph.labelDisplayAuto")}</option>
            <option value="focused">{t("graph.labelDisplayFocused")}</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 text-xs gap-1"
          >
            <Filter className="h-3 w-3" />
            {t("graph.filter")}
          </Button>
          <Button
            variant={showEdgeControls ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowEdgeControls(!showEdgeControls)}
            className="flex-1 text-xs gap-1"
          >
            <SlidersHorizontal className="h-3 w-3" />
            线条设置
          </Button>
        </div>

        {showEdgeControls && (
          <div className="space-y-2 rounded-md border bg-card p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground whitespace-nowrap">线型</span>
              <select
                value={edgeStyle}
                onChange={(e) => setEdgeStyle(e.target.value as GraphEdgeStyle)}
                className="flex-1 h-6 rounded border border-input bg-background px-1 text-[11px] outline-none"
              >
                <option value="curve">曲线避让</option>
                <option value="arrow">箭头</option>
                <option value="line">直线避让</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground whitespace-nowrap">{t("graph.edgeColor")}</span>
              <input
                type="color"
                value={edgeColorHex}
                onChange={(e) => setEdgeColorHex(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-input bg-background p-0.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground whitespace-nowrap">{t("graph.edgeStrength")}</span>
              <input
                type="range"
                min={100}
                max={260}
                step={10}
                value={edgeStrengthPercent}
                onChange={(e) => setEdgeStrengthPercent(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-11 text-right text-muted-foreground">{edgeStrengthPercent}%</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">{filteredNodeCount}/{nodeCount} {t("graph.pages", { count: nodeCount })}</span>
          <span className="rounded bg-muted px-1.5 py-0.5">{filteredEdgeCount}/{edgeCount} {t("graph.links", { count: edgeCount })}</span>
          {hiddenCount > 0 && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
              {hiddenCount} {t("graph.hidden")}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/layout/graph-sidebar-panel.tsx
git commit -m "feat: add GraphSidebarPanel component"
```

---

### Task 6: SoulSidebarPanel 组件

**Files:**
- Create: `src/components/layout/soul-sidebar-panel.tsx`

- [ ] **Step 1: 创建 SoulSidebarPanel 组件**

创建 `src/components/layout/soul-sidebar-panel.tsx`：

```tsx
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { Sparkles, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listCharacterAuras, type CharacterAura, BUILT_IN_CHARACTER_AURAS } from "@/lib/novel/character-aura-store"
import { useEffect, useMemo, useState } from "react"

export function SoulSidebarPanel() {
  const { t } = useTranslation()
  const project = useWikiStore((s) => s.project)
  const selectedSoulId = useWikiStore((s) => s.selectedSoulId)
  const setSelectedSoulId = useWikiStore((s) => s.setSelectedSoulId)
  const selectedSoulTab = useWikiStore((s) => s.selectedSoulTab)
  const setSelectedSoulTab = useWikiStore((s) => s.setSelectedSoulTab)
  const selectedSoulSection = useWikiStore((s) => s.selectedSoulSection)
  const setSelectedSoulSection = useWikiStore((s) => s.setSelectedSoulSection)

  const [auras, setAuras] = useState<CharacterAura[]>(BUILT_IN_CHARACTER_AURAS)

  useEffect(() => {
    if (!project) return
    listCharacterAuras(project.path).then(setAuras).catch(() => {})
  }, [project?.path])

  const builtInAuras = useMemo(() => auras.filter((a) => a.builtIn), [auras])
  const customAuras = useMemo(() => auras.filter((a) => !a.builtIn), [auras])
  const visibleAuras = selectedSoulSection === "builtIn" ? builtInAuras : customAuras

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("nav.soul")}
        </div>
      </div>

      <div className="flex border-b text-sm shrink-0">
        <button
          type="button"
          className={`flex-1 px-3 py-2 ${selectedSoulTab === "project" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          onClick={() => setSelectedSoulTab("project")}
        >
          {t("novel.soul.projectSoul")}
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 ${selectedSoulTab === "character" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          onClick={() => setSelectedSoulTab("character")}
        >
          {t("novel.soul.characterSoul")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {selectedSoulTab === "project" ? (
          <button
            type="button"
            onClick={() => setSelectedSoulId("project-soul")}
            className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
              selectedSoulId === "project-soul" ? "qm-selected" : "text-muted-foreground qm-hover"
            }`}
          >
            <div className="font-medium">{t("novel.soul.projectSoulItem")}</div>
            <div className="mt-1 text-xs opacity-80">{t("novel.soul.projectSoulDesc")}</div>
          </button>
        ) : (
          <>
            <div className="flex border-b text-xs mb-2">
              <button
                type="button"
                onClick={() => setSelectedSoulSection("builtIn")}
                className={`flex-1 px-3 py-1.5 ${selectedSoulSection === "builtIn" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
              >
                {t("novel.soul.builtInSoul")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedSoulSection("custom")}
                className={`flex-1 px-3 py-1.5 ${selectedSoulSection === "custom" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
              >
                {t("novel.soul.customSoul")}
              </button>
            </div>

            {selectedSoulSection === "custom" && (
              <div className="mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedSoulId("new-custom-soul")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("novel.soul.newCustomSoul")}
                </Button>
              </div>
            )}

            {visibleAuras.map((aura) => (
              <button
                key={aura.id}
                type="button"
                onClick={() => setSelectedSoulId(aura.id)}
                className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedSoulId === aura.id ? "qm-selected" : "text-muted-foreground qm-hover"
                }`}
              >
                <div className="font-medium">{aura.name}</div>
                <div className="mt-1 text-xs opacity-80">{aura.category ?? (aura.builtIn ? t("novel.soul.builtInSoul") : t("novel.soul.customSoul"))}</div>
              </button>
            ))}

            {selectedSoulSection === "custom" && visibleAuras.length === 0 && (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {t("novel.soul.noCustomSoul")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 CharacterAura 导出**

确认 `src/lib/novel/character-aura-store.ts` 导出了 `CharacterAura` 类型和 `BUILT_IN_CHARACTER_AURAS` 常量和 `listCharacterAuras` 函数。如果导出名称不同，调整导入路径。

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/soul-sidebar-panel.tsx
git commit -m "feat: add SoulSidebarPanel component"
```

---

### Task 7: ReviewCenterSidebarPanel 组件

**Files:**
- Create: `src/components/layout/review-center-sidebar-panel.tsx`

- [ ] **Step 1: 创建 ReviewCenterSidebarPanel 组件**

创建 `src/components/layout/review-center-sidebar-panel.tsx`：

```tsx
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { ClipboardCheck, Sparkles, AlertTriangle, ShieldAlert, Info, AlertOctagon } from "lucide-react"
import { useMemo } from "react"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import { scoreReviewResults, type DimensionScore } from "@/lib/novel/review-scoring"

const SIX_DIMENSIONS = [
  { key: "thrill", labelKey: "reviewCenter.dimension.thrill", sourceTypes: ["plot"], sourceLabels: ["是否剧情水文"] },
  { key: "consistency", labelKey: "reviewCenter.dimension.consistency", sourceTypes: ["world", "facts"], sourceLabels: ["是否能力体系崩坏", "是否新增未登记设定", "是否时间线错误", "是否地点错误"] },
  { key: "pacing", labelKey: "reviewCenter.dimension.pacing", sourceTypes: ["pacing"], sourceLabels: ["是否缺少章节钩子"] },
  { key: "character", labelKey: "reviewCenter.dimension.character", sourceTypes: ["character"], sourceLabels: ["是否人设崩坏", "是否人物动机不一致", "是否角色知道了不该知道的信息"] },
  { key: "continuity", labelKey: "reviewCenter.dimension.continuity", sourceTypes: ["facts"], sourceLabels: ["是否伏笔遗忘", "是否提前泄露秘密"] },
  { key: "pull", labelKey: "reviewCenter.dimension.pull", sourceTypes: ["pacing", "plot"], sourceLabels: ["是否缺少章节钩子", "下一章推进建议是否被忽略或反向推进"] },
]

function countDimensionIssues(dimension: typeof SIX_DIMENSIONS[number], reviewResults: NovelReviewResult[] | undefined, lintResults: { type: string; detail: string }[] | undefined): number {
  if (!reviewResults && !lintResults) return 0
  let count = 0
  if (reviewResults) {
    for (const r of reviewResults) {
      if (dimension.sourceLabels.some((label) => r.type.includes(label) || label.includes(r.type))) {
        count++
      }
    }
  }
  return count
}

export function ReviewCenterSidebarPanel() {
  const { t } = useTranslation()
  const selectedReviewDimension = useWikiStore((s) => s.selectedReviewDimension)
  const setSelectedReviewDimension = useWikiStore((s) => s.setSelectedReviewDimension)
  const reviewRun = useWikiStore((s) => s.reviewRun)
  const lintRun = useWikiStore((s) => s.lintRun)

  const reviewResults = (reviewRun?.results ?? []) as NovelReviewResult[]
  const scoreReport = useMemo(() => scoreReviewResults(reviewResults), [reviewResults])

  const dimensionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const dim of SIX_DIMENSIONS) {
      const scored = scoreReport.dimensions.find((d) => dim.sourceTypes.includes(d.key))
      counts[dim.key] = scored?.issueCount ?? 0
    }
    return counts
  }, [scoreReport])

  const totalBySeverity = useMemo(() => {
    const counts = { blocking: 0, high: 0, medium: 0, low: 0 }
    for (const dim of scoreReport.dimensions) {
      for (const issue of dim.issues) {
        if (issue.severity === "error") counts.high++
        else if (issue.severity === "warning") counts.medium++
        else counts.low++
      }
    }
    return counts
  }, [scoreReport])

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          {t("reviewCenter.title")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-3">
          <div className="px-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("reviewCenter.sixDimensions")}
          </div>
          <div className="space-y-1">
            {SIX_DIMENSIONS.map((dim) => (
              <button
                key={dim.key}
                type="button"
                onClick={() => setSelectedReviewDimension(dim.key)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedReviewDimension === dim.key ? "qm-selected" : "text-muted-foreground qm-hover"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{t(dim.labelKey)}</span>
                  {dimensionCounts[dim.key] > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{dimensionCounts[dim.key]}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="px-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("reviewCenter.aiReview")}
          </div>
          <button
            type="button"
            onClick={() => setSelectedReviewDimension("ai-review")}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
              selectedReviewDimension === "ai-review" ? "qm-selected" : "text-muted-foreground qm-hover"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>{t("reviewCenter.aiReview")}</span>
            </div>
          </button>
        </div>

        <div className="px-1 text-xs text-muted-foreground">
          {t("reviewCenter.stats", totalBySeverity)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/layout/review-center-sidebar-panel.tsx
git commit -m "feat: add ReviewCenterSidebarPanel component"
```

---

### Task 8: SidebarPanel 分支路由扩展

**Files:**
- Modify: `src/components/layout/sidebar-panel.tsx:342-429`

- [ ] **Step 1: 在 sidebar-panel.tsx 中添加新面板导入**

在 `src/components/layout/sidebar-panel.tsx` 顶部添加导入：

```typescript
import { GraphSidebarPanel } from "./graph-sidebar-panel"
import { SoulSidebarPanel } from "./soul-sidebar-panel"
import { ReviewCenterSidebarPanel } from "./review-center-sidebar-panel"
```

- [ ] **Step 2: 在 SidebarPanel 组件中添加 graph 分支**

在 `activeView === "trash"` 分支（L342-344）之前，添加：

```typescript
if (activeView === "graph") {
  return <GraphSidebarPanel {...graphSidebarProps} />
}
```

注意：GraphSidebarPanel 需要从 GraphView 接收 props。由于 GraphView 的状态是组件内部状态，我们需要通过 store 共享。具体实现方式：在 GraphView 中将控件状态提升到 wiki-store，然后 GraphSidebarPanel 从 store 读取。

**修正方案：** 由于 GraphView 内部状态复杂，采用 props 回调模式。在 SidebarPanel 中不直接渲染 GraphSidebarPanel，而是让 GraphView 自行渲染其侧边栏内容。具体做法：

1. 在 wiki-store 中新增 `graphSidebarProps` 字段（类型为 GraphSidebarPanelProps | null）
2. GraphView 在 mount 时将 props 设置到 store，unmount 时清除
3. SidebarPanel 从 store 读取并渲染

**更简单的方案：** 使用 React Context 在 GraphView 和 GraphSidebarPanel 之间共享状态。但这需要 GraphView 包裹 SidebarPanel，架构上不太合理。

**最终方案：** 将 GraphView 的控件状态迁移到 wiki-store 中，GraphSidebarPanel 和 GraphView 都从 store 读写。

在 wiki-store 中新增字段（在 Task 1 的基础上扩展）：

```typescript
graphMode: string
setGraphMode: (mode: string) => void
graphDisplayMode: string
setGraphDisplayMode: (mode: string) => void
graphColorMode: string
setGraphColorMode: (mode: string) => void
graphLabelDisplayMode: string
setGraphLabelDisplayMode: (mode: string) => void
graphShowFilters: boolean
setGraphShowFilters: (v: boolean) => void
graphShowEdgeControls: boolean
setGraphShowEdgeControls: (v: boolean) => void
graphEdgeStyle: string
setGraphEdgeStyle: (style: string) => void
graphEdgeColorHex: string
setGraphEdgeColorHex: (hex: string) => void
graphEdgeStrengthPercent: number
setGraphEdgeStrengthPercent: (pct: number) => void
```

这些字段需要在 Task 1 中一并添加。

- [ ] **Step 3: 在 SidebarPanel 组件中添加 soul 和 reviewCenter 分支**

在 `activeView === "graph"` 分支之后，添加：

```typescript
if (activeView === "soul") {
  return <SoulSidebarPanel />
}

if (activeView === "reviewCenter") {
  return <ReviewCenterSidebarPanel />
}
```

- [ ] **Step 4: 提交**

```bash
git add src/components/layout/sidebar-panel.tsx
git commit -m "feat: add graph/soul/reviewCenter sidebar panel routing"
```

---

### Task 9: wiki-store 图谱状态字段补充

**Files:**
- Modify: `src/stores/wiki-store.ts`

- [ ] **Step 1: 在 WikiState 接口中新增图谱状态字段**

在 Task 1 添加的字段之后，继续添加：

```typescript
graphMode: string
graphDisplayMode: string
graphColorMode: string
graphLabelDisplayMode: string
graphShowFilters: boolean
graphShowEdgeControls: boolean
graphEdgeStyle: string
graphEdgeColorHex: string
graphEdgeStrengthPercent: number
```

以及对应的 setter：

```typescript
setGraphMode: (mode: string) => void
setGraphDisplayMode: (mode: string) => void
setGraphColorMode: (mode: string) => void
setGraphLabelDisplayMode: (mode: string) => void
setGraphShowFilters: (v: boolean) => void
setGraphShowEdgeControls: (v: boolean) => void
setGraphEdgeStyle: (style: string) => void
setGraphEdgeColorHex: (hex: string) => void
setGraphEdgeStrengthPercent: (pct: number) => void
```

- [ ] **Step 2: 在 store 实现中添加初始值和 setter**

```typescript
graphMode: "overview",
graphDisplayMode: "graph",
graphColorMode: "type",
graphLabelDisplayMode: "all",
graphShowFilters: false,
graphShowEdgeControls: false,
graphEdgeStyle: "curve",
graphEdgeColorHex: "#7f8ea3",
graphEdgeStrengthPercent: 180,
```

以及 setter 实现：

```typescript
setGraphMode: (mode) => set({ graphMode: mode }),
setGraphDisplayMode: (mode) => set({ graphDisplayMode: mode }),
setGraphColorMode: (mode) => set({ graphColorMode: mode }),
setGraphLabelDisplayMode: (mode) => set({ graphLabelDisplayMode: mode }),
setGraphShowFilters: (v) => set({ graphShowFilters: v }),
setGraphShowEdgeControls: (v) => set({ graphShowEdgeControls: v }),
setGraphEdgeStyle: (style) => set({ graphEdgeStyle: style }),
setGraphEdgeColorHex: (hex) => set({ graphEdgeColorHex: hex }),
setGraphEdgeStrengthPercent: (pct) => set({ graphEdgeStrengthPercent: pct }),
```

- [ ] **Step 3: 提交**

```bash
git add src/stores/wiki-store.ts
git commit -m "feat: add graph control state fields to wiki-store"
```

---

### Task 10: GraphView 精简 — 移除顶栏控件，改用 store 状态

**Files:**
- Modify: `src/components/graph/graph-view.tsx`

- [ ] **Step 1: 将 GraphView 内部状态改为从 store 读取**

在 `src/components/graph/graph-view.tsx` 中，将以下 useState 替换为 store 读取：

将 L1047-1082 的状态声明：

```typescript
const [colorMode, setColorMode] = useState<ColorMode>("type")
const [displayMode, setDisplayMode] = useState<GraphDisplayMode>("graph")
const [graphMode, setGraphMode] = useState<GraphMode>("overview")
const [labelDisplayMode, setLabelDisplayMode] = useState<GraphLabelDisplayMode>(() => { ... })
const [edgeColorHex, setEdgeColorHex] = useState(() => { ... })
const [edgeStrengthPercent, setEdgeStrengthPercent] = useState(() => { ... })
const [edgeStyle, setEdgeStyle] = useState<GraphEdgeStyle>(() => { ... })
const [showFilters, setShowFilters] = useState(false)
const [showEdgeControls, setShowEdgeControls] = useState(false)
```

替换为：

```typescript
const graphMode = useWikiStore((s) => s.graphMode) as GraphMode
const setGraphMode = useWikiStore((s) => s.setGraphMode)
const displayMode = useWikiStore((s) => s.graphDisplayMode) as GraphDisplayMode
const setDisplayMode = useWikiStore((s) => s.setGraphDisplayMode)
const colorMode = useWikiStore((s) => s.graphColorMode) as ColorMode
const setColorMode = useWikiStore((s) => s.setGraphColorMode)
const labelDisplayMode = useWikiStore((s) => s.graphLabelDisplayMode) as GraphLabelDisplayMode
const setLabelDisplayMode = useWikiStore((s) => s.setGraphLabelDisplayMode)
const edgeColorHex = useWikiStore((s) => s.graphEdgeColorHex)
const setEdgeColorHex = useWikiStore((s) => s.setGraphEdgeColorHex)
const edgeStrengthPercent = useWikiStore((s) => s.graphEdgeStrengthPercent)
const setEdgeStrengthPercent = useWikiStore((s) => s.setGraphEdgeStrengthPercent)
const edgeStyle = useWikiStore((s) => s.graphEdgeStyle) as GraphEdgeStyle
const setEdgeStyle = useWikiStore((s) => s.setGraphEdgeStyle)
const showFilters = useWikiStore((s) => s.graphShowFilters)
const setShowFilters = useWikiStore((s) => s.setGraphShowFilters)
const showEdgeControls = useWikiStore((s) => s.graphShowEdgeControls)
const setShowEdgeControls = useWikiStore((s) => s.setGraphShowEdgeControls)
```

- [ ] **Step 2: 移除 GraphView 顶栏 JSX**

在 `src/components/graph/graph-view.tsx` L1437-1577，移除整个 Header div：

```tsx
{/* Header */}
<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
  ...全部顶栏内容...
</div>
```

保留 L1574-1576 的刷新按钮逻辑，将其移到 GraphSidebarPanel 中（已在 Task 5 实现）。

- [ ] **Step 3: 更新 GraphSidebarPanel 的 props 传递**

在 `src/components/layout/sidebar-panel.tsx` 中，graph 分支的实现改为：

```typescript
if (activeView === "graph") {
  return <GraphSidebarPanel
    graphMode={useWikiStore.getState().graphMode as GraphMode}
    setGraphMode={(mode) => useWikiStore.getState().setGraphMode(mode)}
    displayMode={useWikiStore.getState().graphDisplayMode as GraphDisplayMode}
    setDisplayMode={(mode) => useWikiStore.getState().setGraphDisplayMode(mode)}
    colorMode={useWikiStore.getState().graphColorMode as ColorMode}
    setColorMode={(mode) => useWikiStore.getState().setGraphColorMode(mode)}
    labelDisplayMode={useWikiStore.getState().graphLabelDisplayMode as GraphLabelDisplayMode}
    setLabelDisplayMode={(mode) => useWikiStore.getState().setGraphLabelDisplayMode(mode)}
    showFilters={useWikiStore.getState().graphShowFilters}
    setShowFilters={(v) => useWikiStore.getState().setGraphShowFilters(v)}
    showEdgeControls={useWikiStore.getState().graphShowEdgeControls}
    setShowEdgeControls={(v) => useWikiStore.getState().setGraphShowEdgeControls(v)}
    edgeStyle={useWikiStore.getState().graphEdgeStyle as GraphEdgeStyle}
    setEdgeStyle={(style) => useWikiStore.getState().setGraphEdgeStyle(style)}
    edgeColorHex={useWikiStore.getState().graphEdgeColorHex}
    setEdgeColorHex={(hex) => useWikiStore.getState().setGraphEdgeColorHex(hex)}
    edgeStrengthPercent={useWikiStore.getState().graphEdgeStrengthPercent}
    setEdgeStrengthPercent={(pct) => useWikiStore.getState().setGraphEdgeStrengthPercent(pct)}
    nodeCount={0}
    edgeCount={0}
    hiddenCount={0}
    filteredNodeCount={0}
    filteredEdgeCount={0}
    onRefresh={() => {}}
    loading={false}
  />
}
```

**更好的方案：** 让 GraphSidebarPanel 直接从 store 读取状态，不需要 props 传递。修改 GraphSidebarPanel 为无 props 组件，内部使用 `useWikiStore` 读取所有状态。GraphView 的统计信息（nodeCount 等）也通过 store 共享。

在 wiki-store 中额外添加：

```typescript
graphStats: { nodeCount: number; edgeCount: number; hiddenCount: number; filteredNodeCount: number; filteredEdgeCount: number }
setGraphStats: (stats: WikiState["graphStats"]) => void
```

GraphView 在数据加载后调用 `setGraphStats`，GraphSidebarPanel 从 store 读取。

- [ ] **Step 4: 提交**

```bash
git add src/components/graph/graph-view.tsx src/components/layout/sidebar-panel.tsx src/stores/wiki-store.ts
git commit -m "feat: refactor GraphView to use store state, remove top bar controls"
```

---

### Task 11: SoulView 组件

**Files:**
- Create: `src/components/novel/soul-view.tsx`

- [ ] **Step 1: 创建 SoulView 组件**

创建 `src/components/novel/soul-view.tsx`，复用 CharacterAuraView 中的子组件：

```tsx
import { useWikiStore } from "@/stores/wiki-store"
import { CharacterAuraView } from "./character-aura-view"
import { SoulDocEditor } from "./soul-doc-editor"

export function SoulView() {
  const selectedSoulId = useWikiStore((s) => s.selectedSoulId)
  const selectedSoulTab = useWikiStore((s) => s.selectedSoulTab)

  if (selectedSoulTab === "project" || selectedSoulId === "project-soul") {
    return (
      <div className="flex h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <SoulDocEditor />
        </div>
      </div>
    )
  }

  return <CharacterAuraView hideSidebar />
}
```

注意：需要给 CharacterAuraView 添加 `hideSidebar` prop，当该 prop 为 true 时隐藏内部侧边栏。

- [ ] **Step 2: 修改 CharacterAuraView 支持 hideSidebar prop**

在 `src/components/novel/character-aura-view.tsx` 中：

1. 添加 `hideSidebar?: boolean` 到组件 props
2. 当 `hideSidebar` 为 true 时，不渲染 `<aside>` 部分，只渲染 `<main>` 部分
3. 当 `hideSidebar` 为 true 时，从 store 读取 `selectedSoulId` 和 `selectedSoulSection` 替代内部状态

具体修改：
- L119: 添加 `{ hideSidebar = false }: { hideSidebar?: boolean }` 参数
- L137: 当 `hideSidebar` 时，从 store 读取 `selectedSoulTab`
- L122: 当 `hideSidebar` 时，从 store 读取 `selectedSoulSection`
- L126: 当 `hideSidebar` 时，从 store 读取 `selectedSoulId`
- L322-537: 当 `hideSidebar` 时，跳过顶部的 Tab 栏和 aside，只渲染 main 内容

- [ ] **Step 3: 提交**

```bash
git add src/components/novel/soul-view.tsx src/components/novel/character-aura-view.tsx
git commit -m "feat: add SoulView and CharacterAuraView hideSidebar support"
```

---

### Task 12: ReviewCenterView 组件

**Files:**
- Create: `src/components/review/review-center-view.tsx`

- [ ] **Step 1: 创建 ReviewCenterView 组件**

创建 `src/components/review/review-center-view.tsx`：

```tsx
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { useMemo } from "react"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import { scoreReviewResults } from "@/lib/novel/review-scoring"
import { ReviewView } from "./review-view"
import { DashboardView } from "@/components/dashboard/dashboard-view"

const DIMENSION_SOURCE_MAP: Record<string, string[]> = {
  thrill: ["plot"],
  consistency: ["world", "facts"],
  pacing: ["pacing"],
  character: ["character"],
  continuity: ["facts"],
  pull: ["pacing", "plot"],
}

export function ReviewCenterView() {
  const { t } = useTranslation()
  const selectedReviewDimension = useWikiStore((s) => s.selectedReviewDimension)
  const novelMode = useWikiStore((s) => s.novelMode)

  if (selectedReviewDimension === "ai-review") {
    return <ReviewView />
  }

  if (!selectedReviewDimension || !novelMode) {
    return <DashboardView />
  }

  return <DimensionResultView dimension={selectedReviewDimension} />
}

function DimensionResultView({ dimension }: { dimension: string }) {
  const { t } = useTranslation()
  const reviewRun = useWikiStore((s) => s.reviewRun)
  const lintRun = useWikiStore((s) => s.lintRun)

  const reviewResults = (reviewRun?.results ?? []) as NovelReviewResult[]

  const dimensionIssues = useMemo(() => {
    const sourceTypes = DIMENSION_SOURCE_MAP[dimension] ?? []
    const report = scoreReviewResults(reviewResults)
    const issues: NovelReviewResult[] = []
    for (const dim of report.dimensions) {
      if (sourceTypes.includes(dim.key)) {
        issues.push(...dim.issues)
      }
    }
    return issues
  }, [reviewResults, dimension])

  const labelKey = `reviewCenter.dimension.${dimension}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t(labelKey)}</h2>
        {dimensionIssues.length > 0 && (
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{dimensionIssues.length}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {dimensionIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <p>{t("reviewCenter.noResults")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dimensionIssues.map((issue, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    issue.severity === "error" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" :
                    issue.severity === "warning" ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" :
                    "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                  }`}>{issue.severity}</span>
                  <span className="text-xs text-muted-foreground">{issue.type}</span>
                </div>
                <p className="mt-1 text-xs">{issue.message}</p>
                {issue.evidence && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    {'\u300C'}{issue.evidence}{'\u300D'}
                  </p>
                )}
                {issue.suggestion && (
                  <p className="mt-1 text-xs text-green-700 dark:text-green-400">{issue.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/review/review-center-view.tsx
git commit -m "feat: add ReviewCenterView component with dimension filtering"
```

---

### Task 13: 集成测试与验证

**Files:**
- 无新增文件

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
npx tsc --noEmit
```

预期：无类型错误

- [ ] **Step 2: 运行 lint 检查**

```bash
npx eslint src/components/layout/graph-sidebar-panel.tsx src/components/layout/soul-sidebar-panel.tsx src/components/layout/review-center-sidebar-panel.tsx src/components/novel/soul-view.tsx src/components/review/review-center-view.tsx src/stores/wiki-store.ts src/components/layout/icon-sidebar.tsx src/components/layout/sidebar-panel.tsx src/components/layout/content-area.tsx src/components/graph/graph-view.tsx src/components/novel/character-aura-view.tsx
```

预期：无 lint 错误

- [ ] **Step 3: 运行开发服务器验证**

```bash
npm run dev
```

手动验证：
1. 点击第1栏"灵魂"图标 → 第2栏显示灵魂面板（项目灵魂/角色灵魂 Tab）
2. 点击"项目灵魂" → 第3栏显示 SoulDocEditor
3. 切换到"角色灵魂" → 第2栏显示内置/自定义子 Tab + 灵魂列表
4. 点击某个灵魂角色 → 第3栏显示 AuraDetails
5. 点击第1栏"审查中心"图标 → 第2栏显示6维审查列表 + AI审阅
6. 点击某个维度 → 第3栏显示该维度的审查结果
7. 点击"AI审阅" → 第3栏显示审稿界面
8. 点击第1栏"图谱"图标 → 第2栏显示图谱控件面板
9. 调整第2栏的模式/筛选器 → 第3栏图谱实时响应
10. 验证原有功能（wiki/sources/lint/search）未受影响

- [ ] **Step 4: 提交最终验证**

```bash
git add -A
git commit -m "chore: integration test and verification pass"
```

---

## 自审检查

### 1. 规格覆盖

| 规格要求 | 对应 Task |
|----------|-----------|
| 修复点击图谱时第2栏无变化 | Task 5, 8, 10 |
| 图谱顶栏内容迁移至第2栏 | Task 5, 10 |
| 第2栏实现选中状态 | Task 5, 6, 7 |
| 第3栏仅显示图谱内容 | Task 10 |
| 灵魂选中后2栏显示分类 | Task 6 |
| 项目灵魂点击→3栏输入界面 | Task 6, 11 |
| 角色灵魂内置+自定义 | Task 6 |
| 角色灵魂点击→3栏内容 | Task 6, 11 |
| 仪表盘+AI审稿合并 | Task 7, 12 |
| 6维审查列表展示 | Task 7 |
| 6维按钮交互 | Task 7, 12 |
| AI审阅选项 | Task 7, 12 |
| AI审阅与6维审查合并 | Task 12 |
| activeView 类型变更 | Task 1 |
| 导航图标调整 | Task 3 |
| i18n 翻译 | Task 2 |

### 2. 占位符扫描

无 TBD/TODO/待定内容。

### 3. 类型一致性

- `GraphMode` 从 graph-view.tsx 导出，GraphSidebarPanel 导入使用 ✅
- `selectedSoulId` 在 wiki-store 中为 `string | null`，SoulSidebarPanel 和 SoulView 都使用此类型 ✅
- `selectedReviewDimension` 在 wiki-store 中为 `string | null`，ReviewCenterSidebarPanel 和 ReviewCenterView 都使用此类型 ✅
- `NovelReviewResult` 从 review-adapter.ts 导出，ReviewCenterSidebarPanel 和 ReviewCenterView 都导入使用 ✅
- `scoreReviewResults` 从 review-scoring.ts 导出，ReviewCenterSidebarPanel 和 ReviewCenterView 都导入使用 ✅
