# 事实快照比对 + 六维审稿 + Dashboard + 伏笔债务 设计文档

## 概述

本文档定义四个独立模块的设计，作为 analysis-report.md 中 P1/P2 阶段的实施方案。所有模块遵循最小化修改原则：新增独立文件，通过 `mod.ts` 导出，不修改现有函数签名和行为。

## 项目上下文

- 项目路径：`e:\QMAI`
- 工作树：`e:\QMAI\.worktrees\fix-mock-test-baseline`（branch: `fix/mock-test-baseline`，待提交）
- 测试框架：Vitest (`npm run test:mocks`)
- 类型检查：`npm run typecheck`
- 关键依赖：`src/lib/novel/chapter-ingest.ts`（ChapterSnapshot）、`src/lib/novel/review-adapter.ts`（NovelReviewResult）、`src/lib/novel/foreshadowing-tracker.ts`（ForeshadowingStore）、`src/lib/novel/fact-model.ts`（FactRecord）

## 模块 1：事实快照比对引擎

### 文件

- 新增：`src/lib/novel/fact-snapshot.ts`
- 新增：`src/lib/novel/fact-snapshot.test.ts`
- 修改：`src/lib/novel/mod.ts`（新增导出）

### 职责

提供基于已有 ChapterSnapshot 的跨章节事实一致性检测。双模式运行：规则引擎（纯 TS，无 LLM 依赖）+ 可选的 LLM 深度分析。

### 输入

- `ChapterSnapshot[]`：从 `.novel/snapshots/` 通过已有的 `loadSnapshot()` / `listSnapshots()` 加载
- `options?: { llmMode?: boolean; llmConfig?: LlmConfig; projectPath?: string }`

### 规则引擎检测项（纯 TS）

| 检测类型 | type 值 | 规则 | 证据来源 |
|---------|---------|------|---------|
| 角色状态跳变 | `character_jump` | 同一角色在相邻章 characterStateChanges 中出现矛盾状态（如第5章"轻伤"，第6章"重伤"，中间无受伤事件） | `characterStateChanges[]` |
| 角色位置矛盾 | `location_conflict` | 同一角色在第 N 章位于地点 A，第 N+1 章位于地点 B，但 transitions 中无移动记录 | `locations[]` + `characterDetails` |
| 物品持有者变更 | `item_holder_change` | 同一物品在相邻章之间持有者变更，但无物品转移事件的记录 | `itemDetails.holder` |
| 组织关系翻转 | `org_flip` | 同一组织的 leader 或 members 在相邻章之间无原因完全反转 | `organizationDetails` |
| 时间线冲突 | `timeline_conflict` | 两个 timelineEvents 声称同一时间点发生互斥事件 | `timelineEvents[]` |
| 设定事实矛盾 | `setting_conflict` | 同一实体在不同章的 newCanonFacts 中给出矛盾描述 | `newCanonFacts[]` |
| 关系反向 | `relationship_reversal` | 两个角色的 relationshipChanges 在相邻章之间方向反转且无中间过渡 | `relationshipChanges[]` |
| 事件因果断裂 | `causality_break` | 某章 events 的 cause 引用了不存在的先前事件 | `eventDetails.cause` |

### LLM 深度分析模式

当 `options.llmMode === true` 且 `hasUsableLlm(llmConfig)` 时：
1. 规则引擎先运行，产出初筛结果（`confidence = 1`）
2. 将初筛结果中的可疑项打包为 prompt，通过已有的 `streamChat` + `resolveNovelModel` 做语义确认
3. LLM 返回的 confidence 覆盖规则引擎的值
4. LLM 不可用时降级为纯规则引擎模式

### 输出类型

```typescript
export interface FactCheckResult {
  severity: "blocking" | "high" | "medium" | "low"
  type: "character_jump" | "location_conflict" | "item_holder_change"
    | "org_flip" | "timeline_conflict" | "setting_conflict"
    | "relationship_reversal" | "causality_break"
  message: string
  evidenceA: string    // 前章节证据锚点
  evidenceB: string    // 后章节证据锚点
  chapters: [number, number]
  confidence: number   // 0-1
  suggestion: string
}

export interface FactCheckReport {
  results: FactCheckResult[]
  checkedChapterCount: number
  ruleEngineTime: number
  llmTime?: number
}

export function runFactCheck(
  snapshots: ChapterSnapshot[],
  options?: { llmMode?: boolean; llmConfig?: LlmConfig; projectPath?: string },
): Promise<FactCheckReport>
```

### 严重程度映射

| 规则检测 | 默认 severity |
|---------|-------------|
| character_jump（状态跳变 ≥ 2 级） | blocking |
| timeline_conflict | high |
| setting_conflict | high |
| location_conflict | medium |
| item_holder_change | medium |
| org_flip | medium |
| relationship_reversal | medium |
| causality_break | low |

### 测试覆盖

- 空快照列表 → 空结果
- 单章快照 → 空结果
- 两章无冲突快照 → 空结果
- 角色状态跳变检测
- 时间线冲突检测
- 设定事实矛盾检测
- LLM 模式降级到规则引擎

---

## 模块 2：六维审稿打分

### 文件

- 新增：`src/lib/novel/review-scoring.ts`
- 新增：`src/lib/novel/review-scoring.test.ts`
- 修改：`src/lib/novel/mod.ts`（新增导出）

### 职责

将现有审稿的 17 维度扁平结果映射到 6 维打分体系，并提供防幻觉规则增强。不修改 `review-adapter.ts`，作为后处理层。

### 维度映射

| 六维 | key | 映射的现有 17 维度 | 权重 |
|------|-----|-------------------|------|
| 剧情推进 | `plot` | 是否违背总大纲、是否违背分卷大纲、是否违背章节目标、是否剧情水文、下一章推进建议是否被忽略 | 20% |
| 人物塑造 | `character` | 是否人设崩坏、是否人物动机不一致、是否角色知道了不该知道的信息 | 15% |
| 世界观设定 | `world` | 是否能力体系崩坏、是否新增未登记设定 | 10% |
| 节奏追读力 | `pacing` | 是否缺少章节钩子 | 15% |
| 事实一致性 | `facts` | 是否时间线错误、是否地点错误、是否伏笔遗忘、是否提前泄露秘密 | 25% |
| 防违规 | `compliance` | 本章必须完成项是否已完成、本章避免违背项是否存在违背 | 15% |

### 打分算法

```
每维初始分 = 100
扣分 = Σ(该维度下各问题的扣分值)
  - error   severity → 扣 20
  - warning severity → 扣 10
  - info    severity → 扣 5
最低分 = 0

总分 = Σ(维度分 × 权重)
```

### 输出类型

```typescript
export interface DimensionScore {
  key: string
  labelKey: string
  score: number     // 0-100
  weight: number    // 0-1
  issueCount: number
  issues: NovelReviewResult[]
}

export interface ReviewScoreReport {
  dimensions: DimensionScore[]
  totalScore: number  // 0-100
  totalIssues: number
  severity: "excellent" | "good" | "fair" | "poor"  // 90+/75+/60+/<60
  antiHallucinationWarnings: string[]
}

export function scoreReviewResults(
  results: NovelReviewResult[],
  options?: { enableAntiHallucination?: boolean },
): ReviewScoreReport
```

### 防幻觉规则

当 `options.enableAntiHallucination === true` 时，对每条 result 做规则校验：

1. **证据绑定检查**：`evidence` 字段非空，否则标记"证据缺失"
2. **推断边界检查**：`message` 中如果包含"必然""一定""绝对"等确定性词汇但 `confidence` 低于阈值，标记"过度推断"
3. **不确定性表达**：对标记项输出 `antiHallucinationWarnings`

### 测试覆盖

- 空结果列表 → 全 100 分
- 单 error → 对应维度扣分正确
- 混合 severity → 扣分正确
- 防幻觉标记检测
- 评级边界测试（90/75/60 分界线）

---

## 模块 3：Dashboard 风险聚合面板

### 文件

- 新增：`src/components/dashboard/dashboard-view.tsx`
- 新增：`src/components/dashboard/dashboard-view.test.tsx`（如有 UI 测试需求）
- 修改：`src/lib/novel/mod.ts`（如有新导出）

### 职责

在一个统一视图中聚合审稿结果、lint 结果和事实检查结果，按严重程度排序展示。

### 不修改

- `review-view.tsx`
- `lint-view.tsx`
- `useWikiStore` 和 `useReviewStore`

### 数据来源

- 审稿结果：`useWikiStore.reviewRun?.results`（NovelReviewResult[]）
- Lint 结果：`useWikiStore.lintRun?.results`（LintResult[]）
- 事实检查：模块 1 的 `FactCheckReport`（按需触发）
- 伏笔债务：模块 4 的 `ForeshadowingDebtReport`（按需触发）

### 严重程度统一分级

| 来源 severity | Dashboard 等级 | 颜色 |
|-------------|---------------|------|
| `blocking` | 阻断级 | 红色 |
| `error` | 高风险 | 橙色 |
| `warning` | 中风险 | 黄色 |
| `info` | 低风险/提示 | 蓝色 |

### UI 结构

```
┌─ Dashboard ─────────────────────────┐
│ 总览：X 阻断 | Y 高风险 | Z 中风险 | W 提示  │
├─────────────────────────────────────┤
│ ▼ 阻断级 (N)              [展开/折叠] │
│   ├─ [审稿] 时间线严重矛盾...        │
│   └─ [事实] 角色状态跳变: 杨妙菲...  │
├─────────────────────────────────────┤
│ ▼ 高风险 (M)              [展开/折叠] │
│   └─ ...                            │
├─────────────────────────────────────┤
│ ▼ 中风险 (P)              [展开/折叠] │
│   └─ ...                            │
├─────────────────────────────────────┤
│ ▼ 低风险/提示 (Q)         [展开/折叠] │
│   └─ ...                            │
├─────────────────────────────────────┤
│ [运行事实检查]  [运行审稿]  [运行Lint] │
└─────────────────────────────────────┘
```

### 入口

- 侧栏导航新增 `Dashboard` 标签
- 不替换现有的 Review / Lint 独立视图

---

## 模块 4：伏笔债务追踪

### 文件

- 新增：`src/lib/novel/foreshadowing-debt.ts`
- 新增：`src/lib/novel/foreshadowing-debt.test.ts`
- 修改：`src/lib/novel/mod.ts`（新增导出）

### 职责

基于现有的 `ForeshadowingStore` 做超期未处理分析。不修改 `foreshadowing-tracker.ts`。

### 检测规则

| 检测项 | 规则 | 默认阈值 |
|--------|------|---------|
| 埋设未推进 | `status === "planted"` 且当前章节 - `plantedChapter` > N | N = 5 章 |
| 推进未回收 | `status === "advanced"` 且最后推进章节距今 > M | M = 10 章 |
| 总未回收数 | `status !== "resolved"` 的总数统计 | — |
| 单章伏笔密度 | 单章 planted 数量 > 阈值 | 阈值 = 5 |

### 输出类型

```typescript
export interface ForeshadowingDebtItem {
  id: string
  name: string
  description: string
  status: "planted" | "advanced" | "resolved"
  plantedChapter: number
  lastAdvancedChapter?: number
  chaptersSincePlanted: number
  chaptersSinceAdvanced?: number
  debtLevel: "critical" | "warning" | "normal"
}

export interface ForeshadowingDebtReport {
  items: ForeshadowingDebtItem[]
  totalUnresolved: number
  criticalCount: number
  warningCount: number
  debtScore: number  // 0-100，100 = 无债务
  thresholds: { plantedStale: number; advancedStale: number; densityLimit: number }
}

export function analyzeForeshadowingDebt(
  store: ForeshadowingStore,
  currentChapter: number,
  options?: { plantedStale?: number; advancedStale?: number; densityLimit?: number },
): ForeshadowingDebtReport
```

### 债务评分

```
debtScore = 100
  - criticalCount × 15
  - warningCount × 5
  - max(0, totalUnresolved - 5) × 2
最低 0
```

### 测试覆盖

- 空 store → 满分 100
- 刚埋设的伏笔（1章前）→ normal
- 超过阈值未推进 → critical
- 超过阈值未回收 → warning
- 混合状态 → 正确分类
- 自定义阈值

---

## 实施顺序与分支策略

实施顺序：**模块 1 → 模块 2 → 模块 3 → 模块 4**

每个模块在独立的 feature 分支中开发：

| 模块 | feature 分支名 | 预估改动文件数 |
|------|---------------|-------------|
| 1. 事实快照比对 | `feature/fact-snapshot-engine` | 3（新增 2 + 修改 mod.ts） |
| 2. 六维审稿打分 | `feature/review-scoring` | 3（新增 2 + 修改 mod.ts） |
| 3. Dashboard 面板 | `feature/dashboard-view` | 2（新增 1 + 导航注册） |
| 4. 伏笔债务追踪 | `feature/foreshadowing-debt` | 3（新增 2 + 修改 mod.ts） |

每个分支完成后：
1. 运行 `npm run test:mocks`
2. 运行 `npm run typecheck`
3. 确认旧功能无回退
4. 合并回 `master`

---

## 不变更清单（明确排除）

以下文件和功能在本设计中**不做任何修改**：

- `src/lib/novel/review-adapter.ts` — 审稿主逻辑不变
- `src/lib/novel/lint.ts` — Lint 主逻辑不变
- `src/lib/novel/foreshadowing-tracker.ts` — 伏笔追踪主逻辑不变
- `src/lib/novel/chapter-ingest.ts` — 章节摄取主逻辑不变
- `src/lib/novel/context-engine.ts` — 上下文引擎不变
- `src/components/review/review-view.tsx` — 审稿视图不变
- `src/components/lint/lint-view.tsx` — Lint 视图不变
- `src/stores/wiki-store.ts` — Store 结构不变
- `src/stores/review-store.ts` — Review Store 不变

---

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 规则引擎误报率高 | 用户体验差，信任度下降 | 规则阈值可配置，LLM 模式做二次确认 |
| 六维打分权重不适用特定题材 | 评分失真 | 权重和映射关系集中在 `REVIEW_DIMENSION_MAP` 常量中，易调整 |
| Dashboard 信息过载 | 用户仍难判断优先级 | 阻断级置顶 + 各等级可折叠 |
| 伏笔债务阈值固定不适配不同篇幅 | 长篇和短篇阈值需求不同 | `options` 提供自定义阈值 |