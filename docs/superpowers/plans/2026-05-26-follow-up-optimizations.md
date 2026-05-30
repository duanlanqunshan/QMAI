# Follow-up Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three follow-up optimizations: LLM deep analysis for fact-snapshot, Dashboard integration with fact-check and foreshadowing debt, and configurable review scoring weights.

**Architecture:** Three independent modules. Optimization 1 adds a `verifyFactCheckLlm` function as a post-processing layer over `runFactCheck`. Optimization 2 adds local state computation in dashboard-view to aggregate fact check and foreshadowing debt reports. Optimization 3 adds an `options` parameter to `scoreReviewResults` for weight customization.

**Tech Stack:** TypeScript, Vitest, React + Zustand

---

## Pre-requisite: Fix merge conflict in mod.ts

### Task 0: Fix merge conflict in `src/lib/novel/mod.ts`

**Files:**
- Modify: `src/lib/novel/mod.ts`:40-43

- [ ] **Step 1: Fix the merge conflict**

At line 40-43 of `src/lib/novel/mod.ts`, replace the merge conflict markers:

```typescript
<<<<<<< HEAD
export { analyzeForeshadowingDebt, type ForeshadowingDebtItem, type ForeshadowingDebtReport, type ForeshadowingDebtOptions } from "./foreshadowing-debt"
=======
>>>>>>> feature/soul-module
```

Replace with:

```typescript
export { analyzeForeshadowingDebt, type ForeshadowingDebtItem, type ForeshadowingDebtReport, type ForeshadowingDebtOptions } from "./foreshadowing-debt"
```

- [ ] **Step 2: Verify no other conflicts**

Run: `cd e:\QMAI; git diff --check`

- [ ] **Step 3: Verify typecheck**

Run: `cd e:\QMAI; npm run typecheck`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/novel/mod.ts
git commit -m "fix: resolve merge conflict in mod.ts"
```

---

## Optimization 1: fact-snapshot LLM Deep Analysis

### Task 1.1: Add `verifyFactCheckLlm` function to fact-snapshot.ts

**Files:**
- Modify: `src/lib/novel/fact-snapshot.ts`

- [ ] **Step 1: Add the function after line 448 (end of file)**

Append to `src/lib/novel/fact-snapshot.ts`:

```typescript
export async function verifyFactCheckLlm(
  results: FactCheckResult[],
  chapterContents: Record<number, string>,
  projectPath: string,
): Promise<FactCheckResult[]> {
  if (results.length === 0) return results

  const pendingResults = results.filter((r) => r.confidence < 1)
  if (pendingResults.length === 0) return results

  try {
    const { resolveNovelModel } = await import("./model-resolver")
    const { streamChat } = await import("@/lib/llm-client")
    const { useWikiStore } = await import("@/stores/wiki-store")

    const llmConfig = resolveNovelModel(
      useWikiStore.getState().llmConfig,
      useWikiStore.getState().novelConfig,
      "review",
    )
    const { hasUsableLlm } = await import("@/lib/has-usable-llm")
    if (!hasUsableLlm(llmConfig)) return results

    const pendingItems = pendingResults.slice(0, 5)
    const itemsText = pendingItems.map((item, i) => {
      const prevContent = chapterContents[item.chapters[0]]?.slice(0, 500) || "(无内容)"
      const currContent = chapterContents[item.chapters[1]]?.slice(0, 500) || "(无内容)"
      return `### ${i + 1}. ${item.message}
- 严重程度: ${item.severity}
- 类型: ${item.type}
- 证据A (第${item.chapters[0]}章): ${item.evidenceA}
- 证据B (第${item.chapters[1]}章): ${item.evidenceB}
- 章节${item.chapters[0]}内容片段: ${prevContent}
- 章节${item.chapters[1]}内容片段: ${currContent}`
    }).join("\n\n")

    const prompt = `请逐一审查以下规则引擎标记的可能矛盾项，判断是否确实是故事内容矛盾。

对于每一项，回复一个 JSON 数组，格式为：
[
  {"index": 1, "confirmed": true|false, "adjustedConfidence": 0.0-1.0, "note": "简要说明"}
]

注意：
- 只有在两个章节的原始内容确实存在事实矛盾时才确认
- 如果只是表述差异或视角不同，应标记为未确认
- 如果证据不足无法判断，应标记为未确认且置信度设为0.3以下

${itemsText}`

    const messages = [
      { role: "system" as const, content: "你是一个专业的小说事实核查员。请基于原文内容进行判断，不要推断或补全信息。" },
      { role: "user" as const, content: prompt },
    ]

    let response = ""
    await streamChat(llmConfig, messages, {
      onToken: (token: string) => { response += token },
      onDone: () => {},
      onError: (error: Error) => {
        console.error("[FactCheck LLM] Stream error:", error)
      },
    }, AbortSignal.timeout(60000))

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return results

    const verdicts = JSON.parse(jsonMatch[0])
    if (!Array.isArray(verdicts)) return results

    for (const verdict of verdicts) {
      const idx = verdict.index - 1
      if (idx >= 0 && idx < pendingItems.length) {
        const origIdx = results.indexOf(pendingItems[idx])
        if (origIdx >= 0) {
          results[origIdx] = {
            ...results[origIdx],
            confidence: typeof verdict.adjustedConfidence === "number"
              ? Math.max(0, Math.min(1, verdict.adjustedConfidence))
              : pendingItems[idx].confidence,
            suggestion: verdict.note
              ? `${pendingItems[idx].suggestion} [LLM: ${verdict.note}]`
              : pendingItems[idx].suggestion,
          }
        }
      }
    }

    return results
  } catch (err) {
    console.error("[FactCheck LLM] Failed:", err)
    return results
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd e:\QMAI; npm run typecheck`
Expected: Pass (or no new errors from this file)

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/fact-snapshot.ts
git commit -m "feat: add verifyFactCheckLlm for LLM-based fact check verification"
```

### Task 1.2: Add tests for verifyFactCheckLlm

**Files:**
- Modify: `src/lib/novel/fact-snapshot.test.ts`

- [ ] **Step 1: Add test for empty results**

Append after line 288 (end of `describe("fact-snapshot"` block), before the closing `})`:

```typescript
  it("verifyFactCheckLlm returns unchanged results when list is empty", async () => {
    const { verifyFactCheckLlm } = await import("./fact-snapshot")
    const verified = await verifyFactCheckLlm([], {}, "/fake/path")
    expect(verified).toEqual([])
  })

  it("verifyFactCheckLlm returns unchanged results when all confidence is 1", async () => {
    const { verifyFactCheckLlm } = await import("./fact-snapshot")
    const results = [{
      severity: "blocking" as const,
      type: "character_jump" as const,
      message: "测试",
      evidenceA: "A",
      evidenceB: "B",
      chapters: [1, 2] as [number, number],
      confidence: 1,
      suggestion: "建议",
    }]
    const verified = await verifyFactCheckLlm(results, {}, "/fake/path")
    expect(verified).toEqual(results)
  })

  it("verifyFactCheckLlm handles no usable LLM gracefully", async () => {
    const { verifyFactCheckLlm } = await import("./fact-snapshot")
    const results = [{
      severity: "medium" as const,
      type: "character_jump" as const,
      message: "测试",
      evidenceA: "A",
      evidenceB: "B",
      chapters: [1, 2] as [number, number],
      confidence: 0.7,
      suggestion: "建议",
    }]
    const verified = await verifyFactCheckLlm(results, { 1: "content", 2: "content" }, "/fake/path")
    expect(verified).toEqual(results)
  })
```

- [ ] **Step 2: Run tests**

Run: `cd e:\QMAI; npx vitest run src/lib/novel/fact-snapshot.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/fact-snapshot.test.ts
git commit -m "test: add tests for verifyFactCheckLlm"
```

### Task 1.3: Export from mod.ts

**Files:**
- Modify: `src/lib/novel/mod.ts`:37

- [ ] **Step 1: Update the export**

At line 37, change:
```typescript
export { runFactCheck, type FactCheckResult, type FactCheckReport, type FactCheckOptions } from "./fact-snapshot"
```

To:
```typescript
export { runFactCheck, verifyFactCheckLlm, type FactCheckResult, type FactCheckReport, type FactCheckOptions } from "./fact-snapshot"
```

- [ ] **Step 2: Verify typecheck**

Run: `cd e:\QMAI; npm run typecheck`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/mod.ts
git commit -m "feat: export verifyFactCheckLlm from mod.ts"
```

### Task 1.4: Full verification

- [ ] **Step 1: Run all mock tests**

Run: `cd e:\QMAI; npm run test:mocks`
Expected: All passing (no regressions)

- [ ] **Step 2: Run full typecheck**

Run: `cd e:\QMAI; npm run typecheck`
Expected: Pass

---

## Optimization 2: Dashboard Integration

### Task 2.1: Add fact check and foreshadowing debt sections to dashboard-view.tsx

**Files:**
- Modify: `src/components/dashboard/dashboard-view.tsx`

- [ ] **Step 1: Add imports**

After line 12, add:
```typescript
import { runFactCheck, type FactCheckResult, type FactCheckReport } from "@/lib/novel/fact-snapshot"
import { analyzeForeshadowingDebt, type ForeshadowingDebtItem, type ForeshadowingDebtReport } from "@/lib/novel/foreshadowing-debt"
import { loadSnapshot, listSnapshots } from "@/lib/novel/chapter-ingest"
import { loadForeshadowingTracker } from "@/lib/novel/foreshadowing-tracker"
import { useMemoizedAsync } from "@/hooks/use-memoized-async"
```

Wait - `useMemoizedAsync` may not exist. Let me check.

Actually, let me use `useEffect` + `useState`:

```typescript
import { useEffect, useState, useMemo, useCallback } from "react"
// ... existing imports ...
import { runFactCheck, type FactCheckReport } from "@/lib/novel/fact-snapshot"
import { analyzeForeshadowingDebt, type ForeshadowingDebtReport } from "@/lib/novel/foreshadowing-debt"
import { loadSnapshot, listSnapshots, type ChapterSnapshot } from "@/lib/novel/chapter-ingest"
import { loadForeshadowingTracker, type ForeshadowingStore } from "@/lib/novel/foreshadowing-tracker"
```

- [ ] **Step 2: Add state and effect for loading extra reports**

After the existing `useState` declarations (line ~59), add:

```typescript
  const [factReport, setFactReport] = useState<FactCheckReport | null>(null)
  const [debtReport, setDebtReport] = useState<ForeshadowingDebtReport | null>(null)
  const [extrasLoading, setExtrasLoading] = useState(false)

  useEffect(() => {
    const projectPath = useWikiStore.getState().project?.path
    if (!projectPath) return

    let cancelled = false
    setExtrasLoading(true)

    Promise.all([
      (async () => {
        try {
          const snapshots: ChapterSnapshot[] = []
          const snapshotFiles = await listSnapshots(projectPath)
          for (const file of snapshotFiles) {
            const snap = await loadSnapshot(projectPath, file)
            if (snap) snapshots.push(snap)
          }
          return await runFactCheck(snapshots)
        } catch { return null }
      })(),
      (async () => {
        try {
          const store_1: ForeshadowingStore = await loadForeshadowingTracker(projectPath)
          const chapters = Object.keys(
            useWikiStore.getState().project?.pages || {}
          ).filter((k) => k.startsWith("chapter")).length || 1
          return analyzeForeshadowingDebt(store_1, chapters)
        } catch { return null }
      })(),
    ]).then(([fact, debt]) => {
      if (cancelled) return
      setFactReport(fact)
      setDebtReport(debt)
      setExtrasLoading(false)
    })

    return () => { cancelled = true }
  }, [])
```

Hmm, this is getting complex. Let me simplify - just import what's needed. Let me also check if there's a simpler way to get chapter count.

Actually, let me simplify significantly. Instead of auto-loading, let me just add the display sections that show data if available. The data can be loaded later via a button or from wherever the review/lint runs are triggered. This is simpler and less risky.

Let me restructure. I'll add:
1. State fields for fact report and debt report
2. A "refresh" effect that loads both
3. UI sections to display them

But the auto-loading from disk is complex. Let me go with even simpler: just add the state and display, and provide a manual refresh button. This way no async disk I/O in the component.

Actually, you know what, the simplest approach that actually works: use local state + useEffect with a single loader. Let me keep it really simple:

```tsx
const [factReport, setFactReport] = useState<FactCheckReport | null>(null)
const [debtReport, setDebtReport] = useState<ForeshadowingDebtReport | null>(null)
const [extrasLoading, setExtrasLoading] = useState(false)

const loadExtras = useCallback(async () => {
  const projectPath = useWikiStore.getState().project?.path
  if (!projectPath) return
  setExtrasLoading(true)
  try {
    const snapshots: ChapterSnapshot[] = []
    const snapshotFiles = await listSnapshots(projectPath)
    for (const file of snapshotFiles) {
      const snap = await loadSnapshot(projectPath, file)
      if (snap) snapshots.push(snap)
    }
    const fact = await runFactCheck(snapshots)
    setFactReport(fact)
    
    const store = await loadForeshadowingTracker(projectPath)
    const debt = analyzeForeshadowingDebt(store, snapshots.length || 1)
    setDebtReport(debt)
  } catch (e) {
    console.error("[Dashboard] Failed to load extras:", e)
  } finally {
    setExtrasLoading(false)
  }
}, [])
```

This loads data from disk, which is async. But it's a view component, and this is fine.

Actually wait, I realize I need to be careful. The `listSnapshots` and `loadSnapshot` are Tauri commands that might not work in mock tests. Let me check if there are mock wrappers...

Looking at the test setup in the project, there are mocks for commands. So the functions should work in test context too.

Let me simplify this further. I'll add:
1. Auto-load on mount (useEffect with empty deps)
2. Display sections if data is available
3. An empty state if no data

Let me now write the actual code:

```tsx
import { useEffect, useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import type { LintResult } from "@/lib/lint"
import { runFactCheck, type FactCheckReport } from "@/lib/novel/fact-snapshot"
import { analyzeForeshadowingDebt, type ForeshadowingDebtReport } from "@/lib/novel/foreshadowing-debt"
import { loadSnapshot, listSnapshots, type ChapterSnapshot } from "@/lib/novel/chapter-ingest"
import { loadForeshadowingTracker, type ForeshadowingStore } from "@/lib/novel/foreshadowing-tracker"
```

Then after the existing state...

```tsx
const [factReport, setFactReport] = useState<FactCheckReport | null>(null)
const [debtReport, setDebtReport] = useState<ForeshadowingDebtReport | null>(null)
const [extrasLoading, setExtrasLoading] = useState(false)
const [extrasError, setExtrasError] = useState(false)

const loadExtras = useCallback(async () => {
  const projectPath = useWikiStore.getState().project?.path
  if (!projectPath) return
  setExtrasLoading(true)
  setExtrasError(false)
  try {
    const snapshots: ChapterSnapshot[] = []
    const snapshotFiles = await listSnapshots(projectPath)
    for (const file of snapshotFiles) {
      const snap = await loadSnapshot(projectPath, file)
      if (snap) snapshots.push(snap)
    }
    const fact = await runFactCheck(snapshots)
    setFactReport(fact)

    const store_1: ForeshadowingStore = await loadForeshadowingTracker(projectPath)
    const debt = analyzeForeshadowingDebt(store_1, snapshots.length || 1)
    setDebtReport(debt)
  } catch {
    setExtrasError(true)
  } finally {
    setExtrasLoading(false)
  }
}, [])

useEffect(() => {
  loadExtras()
}, [loadExtras])
```

Then for the display, after the existing noIssues block, I add sections for fact check and foreshadowing.

OK, this is getting too detailed for a plan. Let me simplify the plan and just write the full code, then execute.

Let me write a concise plan that covers the essentials, and have the sub-agents fill in the details.

Actually, let me just write the plan in a reasonable level of detail, save it, and start executing.</think>

<｜DSML｜tool_calls>
<｜DSML｜invoke name="TodoWrite">
<｜DSML｜parameter name="todos" string="false">[{"id": "0", "status": "in_progress", "priority": "high", "content": "Task 0: 修复 mod.ts 合并冲突"}, {"id": "1", "status": "pending", "priority": "high", "content": "Task 1: fact-snapshot LLM 深度分析 (verifyFactCheckLlm)"}, {"id": "2", "status": "pending", "priority": "high", "content": "Task 2: Dashboard 联动 (fact-check + foreshadowing)"}, {"id": "3", "status": "pending", "priority": "medium", "content": "Task 3: 六维打分权重配置化"}, {"id": "4", "status": "pending", "priority": "high", "content": "全局验证：npm run test:mocks + typecheck"}]