# P1/P2 实施计划 — 事实快照比对 + 六维审稿 + Dashboard + 伏笔债务

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现四个独立模块：事实快照比对引擎、六维审稿打分、Dashboard 风险聚合面板、伏笔债务追踪

**Architecture:** 所有模块遵循最小化修改原则 — 新增独立文件，通过 `mod.ts` 导出，不修改现有函数签名和行为。每个模块在独立 feature 分支开发：`feature/fact-snapshot-engine` → `feature/review-scoring` → `feature/dashboard-view` → `feature/foreshadowing-debt`

**Tech Stack:** TypeScript, Vitest (`npm run test:mocks`), React (TSX), 复用现有 `streamChat`/`resolveNovelModel`/`ChapterSnapshot`/`ForeshadowingStore`/`FactRecord`/`LlmConfig`

**设计文档:** `docs/superpowers/specs/2026-05-26-fact-check-review-dashboard-design.md`

---

## 前置准备：合并测试基线修复

在开始新功能之前，先将 `fix/mock-test-baseline` 合并回 `master`。

### Task 0: Merge test baseline fixes to master

**Files:**
- None (merge operation)

- [ ] **Step 1: Merge fix/mock-test-baseline into master**

```bash
git checkout master
git merge fix/mock-test-baseline
```

- [ ] **Step 2: Verify tests still pass on master**

```bash
npm run test:mocks
```

Expected: 134 passed, 1417 tests

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Cleanup worktree**

```bash
git branch -d fix/mock-test-baseline
git worktree remove .worktrees/fix-mock-test-baseline --force
```

---

## 模块 1：事实快照比对引擎

**分支:** `feature/fact-snapshot-engine`
**工作树:** `.worktrees/fact-snapshot-engine`

### Task 1.1: 搭建分支和工作树

**Files:**
- Create: branch `feature/fact-snapshot-engine`

- [ ] **Step 1: 创建 feature 分支**

```bash
git checkout master
git checkout -b feature/fact-snapshot-engine
```

- [ ] **Step 2: 创建 worktree**

```bash
git worktree add .worktrees/fact-snapshot-engine feature/fact-snapshot-engine
cd .worktrees/fact-snapshot-engine
```

### Task 1.2: 编写测试文件（角色状态跳变检测）

**Files:**
- Create: `src/lib/novel/fact-snapshot.test.ts`

- [ ] **Step 1: 编写空快照列表测试**

```typescript
import { describe, it, expect } from "vitest"
import { runFactCheck } from "./fact-snapshot"
import type { ChapterSnapshot } from "./chapter-ingest"

describe("fact-snapshot", () => {
  it("returns empty results for empty snapshot list", async () => {
    const report = await runFactCheck([])
    expect(report.results).toEqual([])
    expect(report.checkedChapterCount).toBe(0)
  })

  it("returns empty results for single snapshot", async () => {
    const snapshot: ChapterSnapshot = {
      chapterId: "chapter-1",
      chapterNumber: 1,
      summary: "测试章节",
      characters: [],
      locations: [],
      organizations: [],
      items: [],
      events: [],
      characterStateChanges: [],
      relationshipChanges: [],
      knowledgeChanges: [],
      foreshadowingChanges: [],
      newCanonFacts: [],
      timelineEvents: [],
      conflicts: [],
      endingHook: "",
      graphNodes: [],
      graphEdges: [],
    }
    const report = await runFactCheck([snapshot])
    expect(report.results).toEqual([])
    expect(report.checkedChapterCount).toBe(1)
  })

  it("returns empty results for two consistent snapshots", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: ["杨妙菲"], locations: ["北京"],
      organizations: [], items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: ["第1天：到达北京"],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: ["杨妙菲"], locations: ["北京"],
      organizations: [], items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: ["第2天：在北京修炼"],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    expect(report.results).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/fact-snapshot.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/fact-snapshot.test.ts
git commit -m "test: fact-snapshot 空快照和一致快照测试"
```

### Task 1.3: 实现核心模块骨架和空快照逻辑

**Files:**
- Create: `src/lib/novel/fact-snapshot.ts`

- [ ] **Step 1: 编写类型定义和最小实现**

```typescript
import type { ChapterSnapshot } from "./chapter-ingest"
import type { LlmConfig } from "@/stores/wiki-store"

export interface FactCheckResult {
  severity: "blocking" | "high" | "medium" | "low"
  type: "character_jump" | "location_conflict" | "item_holder_change"
    | "org_flip" | "timeline_conflict" | "setting_conflict"
    | "relationship_reversal" | "causality_break"
  message: string
  evidenceA: string
  evidenceB: string
  chapters: [number, number]
  confidence: number
  suggestion: string
}

export interface FactCheckReport {
  results: FactCheckResult[]
  checkedChapterCount: number
  ruleEngineTime: number
  llmTime?: number
}

export interface FactCheckOptions {
  llmMode?: boolean
  llmConfig?: LlmConfig
  projectPath?: string
}

export async function runFactCheck(
  snapshots: ChapterSnapshot[],
  options?: FactCheckOptions,
): Promise<FactCheckReport> {
  const startTime = Date.now()

  if (snapshots.length < 2) {
    return {
      results: [],
      checkedChapterCount: snapshots.length,
      ruleEngineTime: Date.now() - startTime,
    }
  }

  const results: FactCheckResult[] = []
  const sorted = [...snapshots].sort((a, b) => a.chapterNumber - b.chapterNumber)

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    results.push(...checkCharacterJump(prev, curr))
    results.push(...checkLocationConflict(prev, curr))
    results.push(...checkItemHolderChange(prev, curr))
    results.push(...checkOrgFlip(prev, curr))
    results.push(...checkTimelineConflict(prev, curr))
    results.push(...checkSettingConflict(prev, curr))
    results.push(...checkRelationshipReversal(prev, curr))
    results.push(...checkCausalityBreak(prev, curr))
  }

  const report: FactCheckReport = {
    results,
    checkedChapterCount: sorted.length,
    ruleEngineTime: Date.now() - startTime,
  }

  if (options?.llmMode && options.llmConfig) {
    // LLM deep analysis will be added in Task 1.6
  }

  return report
}

function checkCharacterJump(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []
  const prevMap = parseStateChanges(prev.characterStateChanges)
  const currMap = parseStateChanges(curr.characterStateChanges)

  const severityLevels: Record<string, number> = {
    "健康": 5, "轻伤": 4, "受伤": 3, "重伤": 2, "濒死": 1, "死亡": 0,
    "死亡": 0, "已死": 0,
  }

  for (const [name, currState] of currMap) {
    const prevState = prevMap.get(name)
    if (!prevState) continue

    const prevLevel = severityLevels[prevState]
    const currLevel = severityLevels[currState]
    if (prevLevel !== undefined && currLevel !== undefined) {
      const delta = prevLevel - currLevel
      if (delta >= 2) {
        results.push({
          severity: "blocking",
          type: "character_jump",
          message: `角色"${name}"状态从"${prevState}"跳变到"${currState}"（跨${delta}级），第${prev.chapterNumber}章到第${curr.chapterNumber}章之间缺少受伤事件`,
          evidenceA: `第${prev.chapterNumber}章：${name}:${prevState}`,
          evidenceB: `第${curr.chapterNumber}章：${name}:${currState}`,
          chapters: [prev.chapterNumber, curr.chapterNumber],
          confidence: 1,
          suggestion: `需要在第${prev.chapterNumber}章到第${curr.chapterNumber}章之间增加受伤/治疗事件，或修正角色状态`,
        })
      }
    } else {
      if (prevState !== currState) {
        results.push({
          severity: "medium",
          type: "character_jump",
          message: `角色"${name}"状态从"${prevState}"变为"${currState}"，缺少中间事件`,
          evidenceA: `第${prev.chapterNumber}章：${name}:${prevState}`,
          evidenceB: `第${curr.chapterNumber}章：${name}:${currState}`,
          chapters: [prev.chapterNumber, curr.chapterNumber],
          confidence: 0.7,
          suggestion: `请确认状态变化是否有对应事件支撑`,
        })
      }
    }
  }
  return results
}

function parseStateChanges(changes: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const change of changes) {
    const idx = change.indexOf(":") >= 0 ? change.indexOf(":") : change.indexOf("：")
    if (idx > 0) {
      const name = change.slice(0, idx).trim()
      const state = change.slice(idx + 1).trim()
      if (name && state) map.set(name, state)
    }
  }
  return map
}

function checkLocationConflict(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}

function checkItemHolderChange(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}

function checkOrgFlip(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}

function checkTimelineConflict(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}

function checkSettingConflict(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}

function checkRelationshipReversal(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}

function checkCausalityBreak(
  _prev: ChapterSnapshot,
  _curr: ChapterSnapshot,
): FactCheckResult[] {
  return []
}
```

- [ ] **Step 2: 运行测试**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/fact-snapshot.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/fact-snapshot.ts
git commit -m "feat: fact-snapshot 骨架 + 角色状态跳变检测"
```

### Task 1.4: 编写角色状态跳变检测的完整测试

**Files:**
- Modify: `src/lib/novel/fact-snapshot.test.ts`

- [ ] **Step 1: 添加角色状态跳变测试用例**

在测试文件中追加以下测试（在最后一个 `it` 块之后，`})` 闭合之前）：

```typescript
  it("detects character state jump across 2+ levels", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: ["杨妙菲：健康"],
      relationshipChanges: [], knowledgeChanges: [],
      foreshadowingChanges: [], newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: ["杨妙菲：重伤"],
      relationshipChanges: [], knowledgeChanges: [],
      foreshadowingChanges: [], newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    expect(report.results.length).toBeGreaterThan(0)
    const jump = report.results.find(r => r.type === "character_jump")
    expect(jump).toBeDefined()
    expect(jump!.severity).toBe("blocking")
    expect(jump!.message).toContain("杨妙菲")
    expect(jump!.chapters).toEqual([1, 2])
  })

  it("does not flag gradual state change", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: ["杨妙菲：健康"],
      relationshipChanges: [], knowledgeChanges: [],
      foreshadowingChanges: [], newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: ["杨妙菲：轻伤"],
      relationshipChanges: [], knowledgeChanges: [],
      foreshadowingChanges: [], newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    const jumps = report.results.filter(r => r.type === "character_jump")
    expect(jumps.length).toBe(0)
  })

  it("handles non-standard state labels", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: ["张三：开心"],
      relationshipChanges: [], knowledgeChanges: [],
      foreshadowingChanges: [], newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: ["张三：悲伤"],
      relationshipChanges: [], knowledgeChanges: [],
      foreshadowingChanges: [], newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    const jumps = report.results.filter(r => r.type === "character_jump")
    expect(jumps.length).toBe(1)
    expect(jumps[0].severity).toBe("medium")
    expect(jumps[0].confidence).toBe(0.7)
  })
```

- [ ] **Step 2: 运行测试验证通过**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/fact-snapshot.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/fact-snapshot.test.ts
git commit -m "test: fact-snapshot 角色状态跳变检测测试"
```

### Task 1.5: 实现位置冲突 + 物品持有者 + 组织关系检测

**Files:**
- Modify: `src/lib/novel/fact-snapshot.ts`（替换 stub 函数）
- Modify: `src/lib/novel/fact-snapshot.test.ts`（新增测试）

- [ ] **Step 1: 替换 `checkLocationConflict` stub**

```typescript
function checkLocationConflict(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []
  const prevLocs = new Set(prev.locations)
  const currLocs = new Set(curr.locations)

  const prevCharLoc = extractCharacterLocations(prev)
  const currCharLoc = extractCharacterLocations(curr)

  for (const [charName, currLoc] of currCharLoc) {
    const prevLoc = prevCharLoc.get(charName)
    if (prevLoc && prevLoc !== currLoc) {
      const hasTransition = prev.events.some(e =>
        e.includes(charName) && (e.includes("前往") || e.includes("来到") || e.includes("移动") || e.includes("离开"))
      ) || curr.events.some(e =>
        e.includes(charName) && (e.includes("到达") || e.includes("来到"))
      )
      if (!hasTransition) {
        results.push({
          severity: "medium",
          type: "location_conflict",
          message: `角色"${charName}"从"${prevLoc}"移动到"${currLoc}"，但缺少移动事件`,
          evidenceA: `第${prev.chapterNumber}章：${charName}在${prevLoc}`,
          evidenceB: `第${curr.chapterNumber}章：${charName}在${currLoc}`,
          chapters: [prev.chapterNumber, curr.chapterNumber],
          confidence: 0.8,
          suggestion: `在第${prev.chapterNumber}章或第${curr.chapterNumber}章中增加角色移动的描述`,
        })
      }
    }
  }
  return results
}

function extractCharacterLocations(snapshot: ChapterSnapshot): Map<string, string> {
  const map = new Map<string, string>()
  if (!snapshot.characterDetails) return map
  for (const [name, detail] of Object.entries(snapshot.characterDetails)) {
    const location = snapshot.locations[0] || ""
    map.set(name, location)
  }
  return map
}
```

- [ ] **Step 2: 替换 `checkItemHolderChange` stub**

```typescript
function checkItemHolderChange(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []

  const prevHolders = extractItemHolders(prev)
  const currHolders = extractItemHolders(curr)

  for (const [itemName, currHolder] of currHolders) {
    const prevHolder = prevHolders.get(itemName)
    if (prevHolder && prevHolder !== currHolder) {
      const hasTransferEvent = prev.events.some(e =>
        e.includes(itemName) && (e.includes("给") || e.includes("交给") || e.includes("夺取") || e.includes("失去"))
      ) || curr.events.some(e =>
        e.includes(itemName) && (e.includes("获得") || e.includes("拿到") || e.includes("拾取"))
      )
      if (!hasTransferEvent) {
        results.push({
          severity: "medium",
          type: "item_holder_change",
          message: `物品"${itemName}"持有者从"${prevHolder}"变为"${currHolder}"，缺少转移事件`,
          evidenceA: `第${prev.chapterNumber}章：${itemName}由${prevHolder}持有`,
          evidenceB: `第${curr.chapterNumber}章：${itemName}由${currHolder}持有`,
          chapters: [prev.chapterNumber, curr.chapterNumber],
          confidence: 0.8,
          suggestion: `需要解释物品"${itemName}"如何从${prevHolder}转移到${currHolder}`,
        })
      }
    }
  }
  return results
}

function extractItemHolders(snapshot: ChapterSnapshot): Map<string, string> {
  const map = new Map<string, string>()
  if (!snapshot.itemDetails) return map
  for (const [name, detail] of Object.entries(snapshot.itemDetails)) {
    if (detail.holder) map.set(name, detail.holder)
  }
  return map
}
```

- [ ] **Step 3: 替换 `checkOrgFlip` stub**

```typescript
function checkOrgFlip(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []

  const prevOrgs = extractOrgLeaders(prev)
  const currOrgs = extractOrgLeaders(curr)

  for (const [orgName, currLeader] of currOrgs) {
    const prevLeader = prevOrgs.get(orgName)
    if (prevLeader && prevLeader !== currLeader) {
      const hasPowerChange = prev.events.some(e =>
        e.includes(orgName) && (e.includes("易主") || e.includes("夺权") || e.includes("换帅") || e.includes("推翻"))
      ) || curr.events.some(e =>
        e.includes(orgName) && (e.includes("新主") || e.includes("接任") || e.includes("上位"))
      )
      if (!hasPowerChange) {
        results.push({
          severity: "medium",
          type: "org_flip",
          message: `组织"${orgName}"领导者从"${prevLeader}"变为"${currLeader}"，缺少权力变更事件`,
          evidenceA: `第${prev.chapterNumber}章：${orgName}由${prevLeader}领导`,
          evidenceB: `第${curr.chapterNumber}章：${orgName}由${currLeader}领导`,
          chapters: [prev.chapterNumber, curr.chapterNumber],
          confidence: 0.8,
          suggestion: `需要解释组织"${orgName}"权力如何从${prevLeader}变更到${currLeader}`,
        })
      }
    }
  }
  return results
}

function extractOrgLeaders(snapshot: ChapterSnapshot): Map<string, string> {
  const map = new Map<string, string>()
  if (!snapshot.organizationDetails) return map
  for (const [name, detail] of Object.entries(snapshot.organizationDetails)) {
    if (detail.leader) map.set(name, detail.leader)
  }
  return map
}
```

- [ ] **Step 4: 添加对应测试用例**

在 `fact-snapshot.test.ts` 中追加：

```typescript
  it("detects location conflict without transition event", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: ["杨妙菲"], locations: ["北京"],
      organizations: [], items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
      characterDetails: { "杨妙菲": { identity: "修士", faction: "散修", goals: "修炼", arcChange: "无" } },
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: ["杨妙菲"], locations: ["上海"],
      organizations: [], items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
      characterDetails: { "杨妙菲": { identity: "修士", faction: "散修", goals: "修炼", arcChange: "无" } },
    }
    const report = await runFactCheck([snap1, snap2])
    const conflicts = report.results.filter(r => r.type === "location_conflict")
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it("detects item holder change without transfer event", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: ["神剑"], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
      itemDetails: { "神剑": { holder: "张三", previousHolders: "", abilities: "锋利", limitations: "", origin: "" } },
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: ["神剑"], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
      itemDetails: { "神剑": { holder: "李四", previousHolders: "张三", abilities: "锋利", limitations: "", origin: "" } },
    }
    const report = await runFactCheck([snap1, snap2])
    const changes = report.results.filter(r => r.type === "item_holder_change")
    expect(changes.length).toBeGreaterThan(0)
  })

  it("detects organization leader flip without power change event", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: ["天剑宗"],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
      organizationDetails: { "天剑宗": { leader: "王掌门", members: "", goals: "", resources: "" } },
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: ["天剑宗"],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
      organizationDetails: { "天剑宗": { leader: "李掌门", members: "", goals: "", resources: "" } },
    }
    const report = await runFactCheck([snap1, snap2])
    const flips = report.results.filter(r => r.type === "org_flip")
    expect(flips.length).toBeGreaterThan(0)
  })
```

- [ ] **Step 5: 运行测试**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/fact-snapshot.test.ts
```

Expected: 9 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/novel/fact-snapshot.ts src/lib/novel/fact-snapshot.test.ts
git commit -m "feat: fact-snapshot 位置冲突/物品持有者/组织关系检测"
```

### Task 1.6: 实现设定冲突 + 时间线冲突 + 关系反向 + 因果断裂

**Files:**
- Modify: `src/lib/novel/fact-snapshot.ts`（替换剩余 4 个 stub）
- Modify: `src/lib/novel/fact-snapshot.test.ts`（新增测试）

- [ ] **Step 1: 替换 `checkTimelineConflict` stub**

```typescript
function checkTimelineConflict(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []

  for (const prevEvent of prev.timelineEvents) {
    for (const currEvent of curr.timelineEvents) {
      const prevTime = extractTimeHint(prevEvent)
      const currTime = extractTimeHint(currEvent)
      if (prevTime && currTime && prevTime === currTime) {
        const isContradictory = checkTimelineContradiction(prevEvent, currEvent)
        if (isContradictory) {
          results.push({
            severity: "high",
            type: "timeline_conflict",
            message: `时间线冲突：同一时间点"${prevTime}"出现矛盾事件`,
            evidenceA: `第${prev.chapterNumber}章：${prevEvent}`,
            evidenceB: `第${curr.chapterNumber}章：${currEvent}`,
            chapters: [prev.chapterNumber, curr.chapterNumber],
            confidence: 0.9,
            suggestion: `请核对"${prevTime}"时间点的事件一致性`,
          })
        }
      }
    }
  }
  return results
}

function extractTimeHint(event: string): string | null {
  const match = event.match(/第[一二三四五六七八九十\d]+[天日月年]/)
  return match ? match[0] : null
}

function checkTimelineContradiction(a: string, b: string): boolean {
  const exclusivePairs = [
    ["出发", "到达"],
    ["死亡", "出现"],
    ["开始", "结束"],
    ["闭关", "外出"],
  ]
  for (const [w1, w2] of exclusivePairs) {
    if (a.includes(w1) && b.includes(w2)) return true
    if (a.includes(w2) && b.includes(w1)) return true
  }
  return false
}
```

- [ ] **Step 2: 替换 `checkSettingConflict` stub**

```typescript
function checkSettingConflict(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []

  for (const prevFact of prev.newCanonFacts) {
    for (const currFact of curr.newCanonFacts) {
      const prevSubject = extractFactSubject(prevFact)
      const currSubject = extractFactSubject(currFact)
      if (prevSubject && currSubject && prevSubject === currSubject) {
        if (areFactsContradictory(prevFact, currFact)) {
          results.push({
            severity: "high",
            type: "setting_conflict",
            message: `设定矛盾：关于"${prevSubject}"的描述在两章中不一致`,
            evidenceA: `第${prev.chapterNumber}章：${prevFact}`,
            evidenceB: `第${curr.chapterNumber}章：${currFact}`,
            chapters: [prev.chapterNumber, curr.chapterNumber],
            confidence: 0.85,
            suggestion: `请统一关于"${prevSubject}"的设定描述`,
          })
        }
      }
    }
  }
  return results
}

function extractFactSubject(fact: string): string | null {
  const match = fact.match(/^(.+?)(：|:|是|为|属于)/)
  return match ? match[1].trim() : fact.slice(0, 20).trim()
}

function areFactsContradictory(a: string, b: string): boolean {
  const negationPatterns = ["不是", "不再", "并非", "没有"]
  const affirmationPatterns = ["是", "属于", "拥有"]
  for (const neg of negationPatterns) {
    for (const aff of affirmationPatterns) {
      const aNegAff = a.includes(neg) && b.includes(aff)
      const bNegAff = b.includes(neg) && a.includes(aff)
      if (aNegAff || bNegAff) return true
    }
  }
  return false
}
```

- [ ] **Step 3: 替换 `checkRelationshipReversal` stub**

```typescript
function checkRelationshipReversal(
  prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []
  const prevRels = parseRelationships(prev.relationshipChanges)
  const currRels = parseRelationships(curr.relationshipChanges)

  const reversalPairs = [
    ["友好", "敌对"],
    ["信任", "怀疑"],
    ["爱慕", "仇恨"],
    ["同盟", "敌对"],
  ]

  for (const [pairKey, currStatus] of currRels) {
    const prevStatus = prevRels.get(pairKey)
    if (!prevStatus) continue
    for (const [positive, negative] of reversalPairs) {
      if (
        (prevStatus.includes(positive) && currStatus.includes(negative)) ||
        (prevStatus.includes(negative) && currStatus.includes(positive))
      ) {
        const hasTransitionEvent = prev.events.some(e =>
          e.includes("关系") || e.includes("背叛") || e.includes("决裂") || e.includes("和解")
        ) || curr.events.some(e =>
          e.includes("关系") || e.includes("背叛") || e.includes("决裂") || e.includes("和解")
        )
        if (!hasTransitionEvent) {
          results.push({
            severity: "medium",
            type: "relationship_reversal",
            message: `关系反转：${pairKey.replace("->", "与")}的关系从"${prevStatus}"变为"${currStatus}"，缺少过渡事件`,
            evidenceA: `第${prev.chapterNumber}章：${pairKey.replace("->", "与")}关系为${prevStatus}`,
            evidenceB: `第${curr.chapterNumber}章：${pairKey.replace("->", "与")}关系为${currStatus}`,
            chapters: [prev.chapterNumber, curr.chapterNumber],
            confidence: 0.75,
            suggestion: `需要解释这两个角色关系如何反转`,
          })
        }
        break
      }
    }
  }
  return results
}

function parseRelationships(changes: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const change of changes) {
    const parts = change.split(/[：:]/)
    if (parts.length >= 2) {
      map.set(parts[0].trim(), parts.slice(1).join(":").trim())
    }
  }
  return map
}
```

- [ ] **Step 4: 替换 `checkCausalityBreak` stub**

```typescript
function checkCausalityBreak(
  _prev: ChapterSnapshot,
  curr: ChapterSnapshot,
): FactCheckResult[] {
  const results: FactCheckResult[] = []
  if (!curr.eventDetails) return results

  for (const [eventName, detail] of Object.entries(curr.eventDetails)) {
    if (detail.cause && detail.cause.includes("参考") || detail.cause.includes("见")) {
      const causeMatch = detail.cause.match(/第(\d+)章/)
      if (causeMatch) {
        const causeChapter = parseInt(causeMatch[1], 10)
        const knownEvents = curr.events.filter(e => e !== eventName)
        if (!knownEvents.some(e => e.includes(detail.cause.split("：")[0] || ""))) {
          results.push({
            severity: "low",
            type: "causality_break",
            message: `事件"${eventName}"引用了可能不存在的前置事件：${detail.cause}`,
            evidenceA: `第${curr.chapterNumber}章：事件依赖第${causeChapter}章事件`,
            evidenceB: `当前快照中未找到匹配事件`,
            chapters: [causeChapter, curr.chapterNumber],
            confidence: 0.5,
            suggestion: `请确认第${causeChapter}章中是否存在对应前置事件`,
          })
        }
      }
    }
  }
  return results
}
```

- [ ] **Step 5: 添加设定冲突和时间线冲突测试**

在 `fact-snapshot.test.ts` 追加：

```typescript
  it("detects setting conflict with contradictory facts", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: ["神剑：是上古神器"],
      timelineEvents: [], conflicts: [], endingHook: "",
      graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: ["神剑：不是上古神器"],
      timelineEvents: [], conflicts: [], endingHook: "",
      graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    const conflicts = report.results.filter(r => r.type === "setting_conflict")
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it("detects timeline conflict with exclusive events", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: ["第一天：从北京出发"],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: ["第一天：到达北京"],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    const conflicts = report.results.filter(r => r.type === "timeline_conflict")
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it("returns rule engine time in report", async () => {
    const snap1: ChapterSnapshot = {
      chapterId: "chapter-1", chapterNumber: 1,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const snap2: ChapterSnapshot = {
      chapterId: "chapter-2", chapterNumber: 2,
      summary: "", characters: [], locations: [], organizations: [],
      items: [], events: [],
      characterStateChanges: [], relationshipChanges: [],
      knowledgeChanges: [], foreshadowingChanges: [],
      newCanonFacts: [], timelineEvents: [],
      conflicts: [], endingHook: "", graphNodes: [], graphEdges: [],
    }
    const report = await runFactCheck([snap1, snap2])
    expect(report.ruleEngineTime).toBeGreaterThanOrEqual(0)
  })
```

- [ ] **Step 6: 运行完整测试**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/fact-snapshot.test.ts
```

Expected: 12 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/novel/fact-snapshot.ts src/lib/novel/fact-snapshot.test.ts
git commit -m "feat: fact-snapshot 设定/时间线/关系/因果检测 + 完整测试"
```

### Task 1.7: 导出到 mod.ts + 验证全局测试

**Files:**
- Modify: `src/lib/novel/mod.ts`

- [ ] **Step 1: 在 mod.ts 中添加导出**

在 `mod.ts` 末尾追加：

```typescript
export { runFactCheck, type FactCheckResult, type FactCheckReport, type FactCheckOptions } from "./fact-snapshot"
```

- [ ] **Step 2: 运行全局测试和类型检查**

```bash
npm run test:mocks
npm run typecheck
```

Expected: 所有测试通过，类型检查无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/mod.ts
git commit -m "feat: fact-snapshot 导出到 mod.ts"
```

### Task 1.8: 合并到 master

- [ ] **Step 1: 合并**

```bash
git checkout master
git merge feature/fact-snapshot-engine
```

- [ ] **Step 2: 验证**

```bash
npm run test:mocks
npm run typecheck
```

Expected: 所有通过

- [ ] **Step 3: 清理**

```bash
git branch -d feature/fact-snapshot-engine
git worktree remove .worktrees/fact-snapshot-engine --force
```

---

## 模块 2：六维审稿打分

**分支:** `feature/review-scoring`
**工作树:** `.worktrees/review-scoring`

### Task 2.1: 搭建分支和工作树

- [ ] **Step 1: 创建分支和工作树**

```bash
git checkout master
git checkout -b feature/review-scoring
git worktree add .worktrees/review-scoring feature/review-scoring
cd .worktrees/review-scoring
```

### Task 2.2: 编写测试（空结果 → 全满分）

**Files:**
- Create: `src/lib/novel/review-scoring.test.ts`

- [ ] **Step 1: 编写测试文件**

```typescript
import { describe, it, expect } from "vitest"
import { scoreReviewResults } from "./review-scoring"
import type { NovelReviewResult } from "./review-adapter"

describe("review-scoring", () => {
  it("returns full score for empty results", () => {
    const report = scoreReviewResults([])
    expect(report.totalScore).toBe(100)
    expect(report.totalIssues).toBe(0)
    expect(report.severity).toBe("excellent")
    expect(report.dimensions.length).toBe(6)
    for (const dim of report.dimensions) {
      expect(dim.score).toBe(100)
      expect(dim.issueCount).toBe(0)
    }
  })

  it("subtracts correct amount for single error", () => {
    const results: NovelReviewResult[] = [{
      severity: "error",
      type: "character_consistency",
      message: "人设崩坏",
      evidence: "第3章第5段",
      relatedMemory: "",
      suggestion: "修正",
    }]
    const report = scoreReviewResults(results)
    expect(report.totalIssues).toBe(1)
    const charDim = report.dimensions.find(d => d.key === "character")
    expect(charDim).toBeDefined()
    expect(charDim!.score).toBe(80) // 100 - 20 for 1 error
    expect(charDim!.issueCount).toBe(1)
    expect(report.totalScore).toBeLessThan(100)
  })

  it("handles mixed severity types correctly", () => {
    const results: NovelReviewResult[] = [
      { severity: "error", type: "timeline", message: "时间线错误", evidence: "", relatedMemory: "", suggestion: "" },
      { severity: "warning", type: "plot", message: "略微水文", evidence: "", relatedMemory: "", suggestion: "" },
      { severity: "info", type: "style", message: "句式建议", evidence: "", relatedMemory: "", suggestion: "" },
    ]
    const report = scoreReviewResults(results)
    expect(report.totalIssues).toBe(3)
    const factsDim = report.dimensions.find(d => d.key === "facts")
    const plotDim = report.dimensions.find(d => d.key === "plot")
    expect(factsDim!.score).toBe(80) // 100 - 20
    expect(plotDim!.score).toBe(90) // 100 - 10
  })

  it("does not go below 0 for any dimension", () => {
    const results: NovelReviewResult[] = Array.from({ length: 10 }, (_, i) => ({
      severity: "error" as const,
      type: "character_consistency",
      message: `问题${i}`,
      evidence: "",
      relatedMemory: "",
      suggestion: "",
    }))
    const report = scoreReviewResults(results)
    const charDim = report.dimensions.find(d => d.key === "character")
    expect(charDim!.score).toBe(0)
  })

  it("classifies severity levels correctly", () => {
    expect(scoreReviewResults([]).severity).toBe("excellent")

    const oneError: NovelReviewResult[] = [
      { severity: "error", type: "timeline", message: "错误", evidence: "", relatedMemory: "", suggestion: "" },
    ]
    const goodReport = scoreReviewResults(oneError)
    expect(goodReport.severity).toBe("good")

    const manyErrors: NovelReviewResult[] = Array.from({ length: 6 }, (_, i) => ({
      severity: "error" as const,
      type: "timeline",
      message: `错误${i}`,
      evidence: "",
      relatedMemory: "",
      suggestion: "",
    }))
    const fairReport = scoreReviewResults(manyErrors)
    expect(fairReport.severity).toBe("fair")

    const tooManyErrors: NovelReviewResult[] = Array.from({ length: 12 }, (_, i) => ({
      severity: "error" as const,
      type: "timeline",
      message: `错误${i}`,
      evidence: "",
      relatedMemory: "",
      suggestion: "",
    }))
    const poorReport = scoreReviewResults(tooManyErrors)
    expect(poorReport.severity).toBe("poor")
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/review-scoring.test.ts
```

Expected: FAIL

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/review-scoring.test.ts
git commit -m "test: review-scoring 打分和评级测试"
```

### Task 2.3: 实现六维打分模块

**Files:**
- Create: `src/lib/novel/review-scoring.ts`

- [ ] **Step 1: 编写实现**

```typescript
import type { NovelReviewResult } from "./review-adapter"

export interface DimensionScore {
  key: string
  labelKey: string
  score: number
  weight: number
  issueCount: number
  issues: NovelReviewResult[]
}

export interface ReviewScoreReport {
  dimensions: DimensionScore[]
  totalScore: number
  totalIssues: number
  severity: "excellent" | "good" | "fair" | "poor"
  antiHallucinationWarnings: string[]
}

const REVIEW_DIMENSION_MAP: Record<string, string> = {
  "是否违背总大纲": "plot",
  "是否违背分卷大纲": "plot",
  "是否违背章节目标": "plot",
  "下一章推进建议是否被忽略或反向推进": "plot",
  "是否剧情水文": "plot",
  "是否人设崩坏": "character",
  "是否人物动机不一致": "character",
  "是否角色知道了不该知道的信息": "character",
  "是否能力体系崩坏": "world",
  "是否新增未登记设定": "world",
  "是否缺少章节钩子": "pacing",
  "是否时间线错误": "facts",
  "是否地点错误": "facts",
  "是否伏笔遗忘": "facts",
  "是否提前泄露秘密": "facts",
  "本章必须完成项是否已完成": "compliance",
  "本章避免违背项是否存在违背": "compliance",
}

const DIMENSION_WEIGHTS: Record<string, number> = {
  plot: 0.20,
  character: 0.15,
  world: 0.10,
  pacing: 0.15,
  facts: 0.25,
  compliance: 0.15,
}

const DIMENSION_LABEL_KEYS: Record<string, string> = {
  plot: "novel.scoring.dimension.plot",
  character: "novel.scoring.dimension.character",
  world: "novel.scoring.dimension.world",
  pacing: "novel.scoring.dimension.pacing",
  facts: "novel.scoring.dimension.facts",
  compliance: "novel.scoring.dimension.compliance",
}

const SEVERITY_DEDUCTION: Record<string, number> = {
  error: 20,
  warning: 10,
  info: 5,
}

export function scoreReviewResults(
  results: NovelReviewResult[],
  options?: { enableAntiHallucination?: boolean },
): ReviewScoreReport {
  const dimensionIssues: Record<string, NovelReviewResult[]> = {}
  for (const key of Object.keys(DIMENSION_WEIGHTS)) {
    dimensionIssues[key] = []
  }

  for (const result of results) {
    const typeLabel = resolveTypeLabel(result.type)
    const dim = REVIEW_DIMENSION_MAP[typeLabel] || "facts"
    if (dimensionIssues[dim]) {
      dimensionIssues[dim].push(result)
    }
  }

  const dimensions: DimensionScore[] = []
  let weightedSum = 0

  for (const key of Object.keys(DIMENSION_WEIGHTS)) {
    const issues = dimensionIssues[key] || []
    const deduction = issues.reduce((sum, issue) => {
      return sum + (SEVERITY_DEDUCTION[issue.severity] || 5)
    }, 0)
    const score = Math.max(0, 100 - deduction)
    dimensions.push({
      key,
      labelKey: DIMENSION_LABEL_KEYS[key],
      score,
      weight: DIMENSION_WEIGHTS[key],
      issueCount: issues.length,
      issues,
    })
    weightedSum += score * DIMENSION_WEIGHTS[key]
  }

  const antiHallucinationWarnings = options?.enableAntiHallucination
    ? runAntiHallucinationChecks(results)
    : []

  return {
    dimensions,
    totalScore: Math.round(weightedSum),
    totalIssues: results.length,
    severity: classifySeverity(weightedSum),
    antiHallucinationWarnings,
  }
}

function resolveTypeLabel(type: string): string {
  const directMatch = REVIEW_DIMENSION_MAP[type]
  if (directMatch) return type

  const lower = type.toLowerCase()
  if (lower.includes("character") || lower.includes("consistency")) return "是否人设崩坏"
  if (lower.includes("timeline")) return "是否时间线错误"
  if (lower.includes("plot") || lower.includes("outline")) return "是否违背章节目标"
  if (lower.includes("setting") || lower.includes("world")) return "是否能力体系崩坏"
  if (lower.includes("foreshadowing")) return "是否伏笔遗忘"
  if (lower.includes("style")) return "是否剧情水文"
  return type
}

function classifySeverity(totalScore: number): "excellent" | "good" | "fair" | "poor" {
  if (totalScore >= 90) return "excellent"
  if (totalScore >= 75) return "good"
  if (totalScore >= 60) return "fair"
  return "poor"
}

function runAntiHallucinationChecks(results: NovelReviewResult[]): string[] {
  const warnings: string[] = []
  const absoluteWords = ["必然", "一定", "绝对", "肯定", "显然"]

  for (const result of results) {
    if (!result.evidence || result.evidence.trim().length < 5) {
      warnings.push(`证据缺失：问题"${result.message.slice(0, 40)}"的证据字段为空或过短`)
    }
    for (const word of absoluteWords) {
      if (result.message.includes(word) && !result.evidence.includes(word)) {
        warnings.push(`过度推断：问题"${result.message.slice(0, 40)}"使用了确定性词汇"${word}"但证据中未体现`)
      }
    }
  }
  return warnings
}
```

- [ ] **Step 2: 运行测试**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/review-scoring.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/review-scoring.ts
git commit -m "feat: review-scoring 六维打分 + 防幻觉规则"
```

### Task 2.4: 导出 + 验证全局测试

**Files:**
- Modify: `src/lib/novel/mod.ts`

- [ ] **Step 1: 添加到 mod.ts**

```typescript
export { scoreReviewResults, type DimensionScore, type ReviewScoreReport } from "./review-scoring"
```

- [ ] **Step 2: 运行全局测试和类型检查**

```bash
npm run test:mocks
npm run typecheck
```

Expected: 全部通过

- [ ] **Step 3: Commit + 合并**

```bash
git add src/lib/novel/mod.ts
git commit -m "feat: review-scoring 导出到 mod.ts"
git checkout master
git merge feature/review-scoring
npm run test:mocks
npm run typecheck
git branch -d feature/review-scoring
git worktree remove .worktrees/review-scoring --force
```

---

## 模块 3：Dashboard 风险聚合面板

**分支:** `feature/dashboard-view`
**工作树:** `.worktrees/dashboard-view`

### Task 3.1: 搭建分支和工作树

- [ ] **Step 1:**

```bash
git checkout master
git checkout -b feature/dashboard-view
git worktree add .worktrees/dashboard-view feature/dashboard-view
cd .worktrees/dashboard-view
```

### Task 3.2: 创建 Dashboard 组件

**Files:**
- Create: `src/components/dashboard/dashboard-view.tsx`

- [ ] **Step 1: 编写组件**

```typescript
import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import type { LintResult } from "@/lib/lint"

type DashSeverity = "blocking" | "high" | "medium" | "low"

interface DashItem {
  severity: DashSeverity
  source: "review" | "lint"
  message: string
  detail: string
  evidence?: string
  suggestion?: string
}

const SEVERITY_CONFIG: Record<DashSeverity, { icon: typeof AlertTriangle; labelKey: string; color: string; bgColor: string }> = {
  blocking: { icon: AlertOctagon, labelKey: "dashboard.severity.blocking", color: "text-red-600 dark:text-red-400", bgColor: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950" },
  high: { icon: ShieldAlert, labelKey: "dashboard.severity.high", color: "text-orange-600 dark:text-orange-400", bgColor: "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950" },
  medium: { icon: AlertTriangle, labelKey: "dashboard.severity.medium", color: "text-amber-600 dark:text-amber-400", bgColor: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" },
  low: { icon: Info, labelKey: "dashboard.severity.low", color: "text-blue-600 dark:text-blue-400", bgColor: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" },
}

function mapReviewSeverity(severity: NovelReviewResult["severity"]): DashSeverity {
  switch (severity) {
    case "error": return "high"
    case "warning": return "medium"
    case "info": return "low"
    default: return "medium"
  }
}

function mapLintSeverity(severity: LintResult["severity"]): DashSeverity {
  switch (severity) {
    case "warning": return "medium"
    case "info": return "low"
    default: return "medium"
  }
}

export function DashboardView() {
  const { t } = useTranslation()
  const reviewRun = useWikiStore((s) => s.reviewRun)
  const lintRun = useWikiStore((s) => s.lintRun)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    blocking: false,
    high: false,
    medium: false,
    low: true,
  })

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const items = useMemo((): DashItem[] => {
    const dashItems: DashItem[] = []

    if (reviewRun?.results) {
      for (const r of reviewRun.results) {
        dashItems.push({
          severity: mapReviewSeverity(r.severity),
          source: "review",
          message: r.message,
          detail: r.type,
          evidence: r.evidence,
          suggestion: r.suggestion,
        })
      }
    }

    if (lintRun?.results) {
      for (const r of lintRun.results) {
        dashItems.push({
          severity: mapLintSeverity(r.severity),
          source: "lint",
          message: r.detail,
          detail: r.page,
        })
      }
    }

    return dashItems.sort((a, b) => {
      const order: Record<string, number> = { blocking: 0, high: 1, medium: 2, low: 3 }
      return order[a.severity] - order[b.severity]
    })
  }, [reviewRun?.results, lintRun?.results])

  const grouped = useMemo(() => {
    const groups: Record<DashSeverity, DashItem[]> = {
      blocking: [],
      high: [],
      medium: [],
      low: [],
    }
    for (const item of items) {
      groups[item.severity].push(item)
    }
    return groups
  }, [items])

  const noIssues = items.length === 0 && !reviewRun?.running && !lintRun?.running

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("dashboard.title")}</h2>
        {items.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-red-500">{grouped.blocking.length} {t("dashboard.severity.blocking")}</span>
            <span className="text-orange-500">{grouped.high.length} {t("dashboard.severity.high")}</span>
            <span className="text-amber-500">{grouped.medium.length} {t("dashboard.severity.medium")}</span>
            <span className="text-blue-500">{grouped.low.length} {t("dashboard.severity.low")}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {noIssues ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Info className="h-8 w-8 text-muted-foreground/30" />
            <p>{t("dashboard.noIssues")}</p>
            <p className="text-xs">{t("dashboard.noIssuesHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3">
            {(["blocking", "high", "medium", "low"] as DashSeverity[]).map((severity) => {
              const group = grouped[severity]
              if (group.length === 0) return null
              const config = SEVERITY_CONFIG[severity]
              const Icon = config.icon
              const isCollapsed = collapsed[severity]
              return (
                <div key={severity} className="mb-2">
                  <button
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 ${config.color}`}
                    onClick={() => toggleCollapse(severity)}
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <Icon className="h-4 w-4" />
                    <span>{t(config.labelKey)}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">{group.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="mt-1 space-y-1 pl-8">
                      {group.map((item, i) => (
                        <div key={i} className={`rounded-md border p-2 text-sm ${config.bgColor}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">[{item.source === "review" ? t("dashboard.source.review") : t("dashboard.source.lint")}]</span>
                            <span className="truncate text-xs text-muted-foreground">{item.detail}</span>
                          </div>
                          <p className="mt-1 text-xs">{item.message}</p>
                          {item.evidence && (
                            <p className="mt-1 text-xs text-muted-foreground italic">「{item.evidence}」</p>
                          )}
                          {item.suggestion && (
                            <p className="mt-1 text-xs text-green-700 dark:text-green-400">{item.suggestion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/dashboard-view.tsx
git commit -m "feat: Dashboard 风险聚合面板组件"
```

### Task 3.3: 注册 Dashboard 到侧栏导航

**Files:**
- Search: 侧栏导航注册位置

需要先查找侧栏导航组件的位置来添加 Dashboard 入口。

```bash
# 查找侧栏导航
grep -r "LintView\|ReviewView" src/components/ --include="*.tsx" -l
```

然后根据找到的导航组件添加 Dashboard 入口。具体修改取决于现有导航结构，在此步骤中动态确定。

### Task 3.4: 添加 i18n keys

**Files:**
- Modify: `src/i18n/zh.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: 中文翻译**

```json
"dashboard": {
  "title": "Dashboard",
  "noIssues": "暂无问题",
  "noIssuesHint": "运行审稿或连贯性检查后，结果将显示在此处",
  "severity": {
    "blocking": "阻断级",
    "high": "高风险",
    "medium": "中风险",
    "low": "低风险"
  },
  "source": {
    "review": "审稿",
    "lint": "检查"
  }
}
```

- [ ] **Step 2: 英文翻译**

```json
"dashboard": {
  "title": "Dashboard",
  "noIssues": "No issues found",
  "noIssuesHint": "Run review or lint to see results here",
  "severity": {
    "blocking": "Blocking",
    "high": "High Risk",
    "medium": "Medium Risk",
    "low": "Low Risk"
  },
  "source": {
    "review": "Review",
    "lint": "Lint"
  }
}
```

### Task 3.5: 验证 + 合并

- [ ] **Step 1: 运行类型检查和测试**

```bash
npm run typecheck
npm run test:mocks
```

Expected: 全部通过

- [ ] **Step 2: 合并回 master**

```bash
git checkout master
git merge feature/dashboard-view
npm run test:mocks
npm run typecheck
git branch -d feature/dashboard-view
git worktree remove .worktrees/dashboard-view --force
```

---

## 模块 4：伏笔债务追踪

**分支:** `feature/foreshadowing-debt`
**工作树:** `.worktrees/foreshadowing-debt`

### Task 4.1: 搭建分支

```bash
git checkout master
git checkout -b feature/foreshadowing-debt
git worktree add .worktrees/foreshadowing-debt feature/foreshadowing-debt
cd .worktrees/foreshadowing-debt
```

### Task 4.2: 编写测试

**Files:**
- Create: `src/lib/novel/foreshadowing-debt.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from "vitest"
import { analyzeForeshadowingDebt } from "./foreshadowing-debt"
import { createEmptyForeshadowingStore, type ForeshadowingStore } from "./foreshadowing-tracker"

describe("foreshadowing-debt", () => {
  it("returns full score for empty store", () => {
    const store = createEmptyForeshadowingStore()
    const report = analyzeForeshadowingDebt(store, 10)
    expect(report.debtScore).toBe(100)
    expect(report.totalUnresolved).toBe(0)
    expect(report.criticalCount).toBe(0)
    expect(report.warningCount).toBe(0)
  })

  it("marks recently planted as normal", () => {
    const store: ForeshadowingStore = {
      items: [{
        id: "fs-1", name: "神秘人物", description: "出现神秘人物",
        status: "planted", plantedChapter: 8, advancedChapters: [],
        relatedCharacters: [], relatedEvents: [], notes: "",
      }],
      lastUpdated: new Date().toISOString(),
    }
    const report = analyzeForeshadowingDebt(store, 10)
    const item = report.items[0]
    expect(item.debtLevel).toBe("normal")
  })

  it("marks stale planted as critical", () => {
    const store: ForeshadowingStore = {
      items: [{
        id: "fs-1", name: "神秘人物", description: "出现神秘人物",
        status: "planted", plantedChapter: 1, advancedChapters: [],
        relatedCharacters: [], relatedEvents: [], notes: "",
      }],
      lastUpdated: new Date().toISOString(),
    }
    const report = analyzeForeshadowingDebt(store, 20)
    expect(report.items[0].debtLevel).toBe("critical")
    expect(report.criticalCount).toBe(1)
  })

  it("marks stale advanced as warning", () => {
    const store: ForeshadowingStore = {
      items: [{
        id: "fs-2", name: "王国秘密", description: "王国隐藏的秘密",
        status: "advanced", plantedChapter: 1, advancedChapters: [5],
        relatedCharacters: [], relatedEvents: [], notes: "",
      }],
      lastUpdated: new Date().toISOString(),
    }
    const report = analyzeForeshadowingDebt(store, 30)
    expect(report.items[0].debtLevel).toBe("warning")
    expect(report.warningCount).toBe(1)
  })

  it("handles resolved items correctly", () => {
    const store: ForeshadowingStore = {
      items: [{
        id: "fs-3", name: "已回收伏笔", description: "已完成",
        status: "resolved", plantedChapter: 1, advancedChapters: [3],
        resolvedChapter: 5, relatedCharacters: [], relatedEvents: [], notes: "",
      }],
      lastUpdated: new Date().toISOString(),
    }
    const report = analyzeForeshadowingDebt(store, 30)
    expect(report.totalUnresolved).toBe(0)
    expect(report.debtScore).toBe(100)
  })

  it("accepts custom thresholds", () => {
    const store: ForeshadowingStore = {
      items: [{
        id: "fs-1", name: "测试", description: "测试伏笔",
        status: "planted", plantedChapter: 1, advancedChapters: [],
        relatedCharacters: [], relatedEvents: [], notes: "",
      }],
      lastUpdated: new Date().toISOString(),
    }
    const defaultReport = analyzeForeshadowingDebt(store, 4)
    expect(defaultReport.items[0].debtLevel).toBe("normal")

    const customReport = analyzeForeshadowingDebt(store, 4, { plantedStale: 2 })
    expect(customReport.items[0].debtLevel).toBe("critical")
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/foreshadowing-debt.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/foreshadowing-debt.test.ts
git commit -m "test: foreshadowing-debt 债务追踪测试"
```

### Task 4.3: 实现伏笔债务分析

**Files:**
- Create: `src/lib/novel/foreshadowing-debt.ts`

- [ ] **Step 1: 编写实现**

```typescript
import type { ForeshadowingStore } from "./foreshadowing-tracker"

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
  debtScore: number
  thresholds: { plantedStale: number; advancedStale: number; densityLimit: number }
}

export interface ForeshadowingDebtOptions {
  plantedStale?: number
  advancedStale?: number
  densityLimit?: number
}

const DEFAULT_PLANTED_STALE = 5
const DEFAULT_ADVANCED_STALE = 10
const DEFAULT_DENSITY_LIMIT = 5

export function analyzeForeshadowingDebt(
  store: ForeshadowingStore,
  currentChapter: number,
  options?: ForeshadowingDebtOptions,
): ForeshadowingDebtReport {
  const plantedStale = options?.plantedStale ?? DEFAULT_PLANTED_STALE
  const advancedStale = options?.advancedStale ?? DEFAULT_ADVANCED_STALE
  const densityLimit = options?.densityLimit ?? DEFAULT_DENSITY_LIMIT

  const unresolved = store.items.filter((item) => item.status !== "resolved")

  const items: ForeshadowingDebtItem[] = unresolved.map((item) => {
    const chaptersSincePlanted = currentChapter - item.plantedChapter
    const lastAdvancedChapter = item.advancedChapters.length > 0
      ? Math.max(...item.advancedChapters)
      : undefined
    const chaptersSinceAdvanced = lastAdvancedChapter
      ? currentChapter - lastAdvancedChapter
      : undefined

    let debtLevel: "critical" | "warning" | "normal" = "normal"

    if (item.status === "planted" && chaptersSincePlanted >= plantedStale) {
      debtLevel = "critical"
    } else if (item.status === "advanced" && chaptersSinceAdvanced && chaptersSinceAdvanced >= advancedStale) {
      debtLevel = "warning"
    }

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      status: item.status,
      plantedChapter: item.plantedChapter,
      lastAdvancedChapter,
      chaptersSincePlanted,
      chaptersSinceAdvanced,
      debtLevel,
    }
  })

  const criticalCount = items.filter((item) => item.debtLevel === "critical").length
  const warningCount = items.filter((item) => item.debtLevel === "warning").length

  let debtScore = 100
  debtScore -= criticalCount * 15
  debtScore -= warningCount * 5
  debtScore -= Math.max(0, unresolved.length - 5) * 2
  debtScore = Math.max(0, debtScore)

  return {
    items,
    totalUnresolved: unresolved.length,
    criticalCount,
    warningCount,
    debtScore,
    thresholds: { plantedStale, advancedStale, densityLimit },
  }
}
```

- [ ] **Step 2: 运行测试**

```bash
npm run test:mocks -- --reporter=verbose src/lib/novel/foreshadowing-debt.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/foreshadowing-debt.ts
git commit -m "feat: foreshadowing-debt 伏笔债务追踪分析"
```

### Task 4.4: 导出 + 验证 + 合并

**Files:**
- Modify: `src/lib/novel/mod.ts`

- [ ] **Step 1: 导出**

```typescript
export { analyzeForeshadowingDebt, type ForeshadowingDebtItem, type ForeshadowingDebtReport, type ForeshadowingDebtOptions } from "./foreshadowing-debt"
```

- [ ] **Step 2: 全局验证**

```bash
npm run test:mocks
npm run typecheck
```

Expected: 全部通过

- [ ] **Step 3: 合并**

```bash
git add src/lib/novel/mod.ts
git commit -m "feat: foreshadowing-debt 导出到 mod.ts"
git checkout master
git merge feature/foreshadowing-debt
npm run test:mocks
npm run typecheck
git branch -d feature/foreshadowing-debt
git worktree remove .worktrees/foreshadowing-debt --force
```

---

## 收尾检查

全部 4 个模块合并完成后：

- [ ] **最终验证**

```bash
git checkout master
npm run test:mocks
npm run typecheck
```

Expected: 所有测试通过，类型检查无错误

- [ ] **清理所有 worktree**

```bash
git worktree list
git worktree remove <path> --force  # 逐个清理残留
```