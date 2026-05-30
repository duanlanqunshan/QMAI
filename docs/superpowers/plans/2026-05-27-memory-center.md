# Memory Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the novel-mode primary `lint` entry with a memory-centered view that surfaces chapter snapshots, character state, cognition, foreshadowing, and timeline memory.

**Architecture:** Keep the existing `activeView: "lint"` store key so navigation and layout stay stable. In novel mode, route that view to a new `MemoryCenterView`; in non-novel mode, keep the existing wiki lint view unchanged. Reuse existing snapshot and memory export files instead of inventing a new storage format.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, i18next

---

### Task 1: Add memory-center data helpers

**Files:**
- Create: `src/lib/novel/memory-center.ts`
- Test: `src/lib/novel/memory-center.test.ts`

- [ ] **Step 1: Write failing tests for snapshot and markdown-memory shaping**

Add tests for:
- sorting snapshots newest-first
- trimming section bullet counts
- parsing `##` / `###` headed memory markdown into preview groups
- collecting quick stats from loaded snapshots and memory pages

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/lib/novel/memory-center.test.ts`
Expected: FAIL because `src/lib/novel/memory-center.ts` does not exist yet

- [ ] **Step 3: Implement the minimal helper module**

Create a small helper that:
- defines `MemoryCenterSnapshotCard`, `MemoryCenterSection`, and `MemoryCenterData`
- exposes pure helpers for snapshot-card building and markdown preview parsing
- exposes one async loader that reads snapshot JSONs and `wiki/memory/*.md`

- [ ] **Step 4: Re-run the focused test**

Run: `npx vitest run src/lib/novel/memory-center.test.ts`
Expected: PASS

### Task 2: Build the memory center view

**Files:**
- Create: `src/components/novel/memory-center-view.tsx`
- Test: `src/components/novel/memory-center-view.test.tsx`

- [ ] **Step 1: Write a failing source-level UI test**

Add checks that the new view:
- loads memory data with a dedicated loader
- renders snapshot, character-state, cognition, foreshadowing, and timeline sections
- provides open-file actions for memory pages

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/components/novel/memory-center-view.test.tsx`
Expected: FAIL because the component does not exist yet

- [ ] **Step 3: Implement the minimal React view**

Create a view that:
- loads memory data on mount from the current project path
- shows an overview row with counts
- renders recent snapshot cards
- renders preview sections for character state, cognition, foreshadowing, timeline, canon facts, and conflicts
- opens the backing memory file in the editor when the user clicks a button

- [ ] **Step 4: Re-run the focused test**

Run: `npx vitest run src/components/novel/memory-center-view.test.tsx`
Expected: PASS

### Task 3: Route novel-mode lint entry to memory center

**Files:**
- Modify: `src/components/layout/content-area.tsx`
- Modify: `src/components/layout/icon-sidebar.tsx`
- Modify: `src/i18n/zh.json`
- Modify: `src/i18n/en.json`
- Create: `src/components/layout/content-area.test.tsx`

- [ ] **Step 1: Write failing routing and label tests**

Add tests that assert:
- `ContentArea` switches the novel-mode `lint` slot to `MemoryCenterView`
- the novel navigation label for `lint` is no longer the continuity-check wording

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npx vitest run src/components/layout/content-area.test.tsx`
Expected: FAIL because the content area still renders `LintView` for `lint`

- [ ] **Step 3: Implement the routing and copy changes**

Make the smallest possible changes:
- lazy-load `MemoryCenterView`
- branch on `novelMode` only in the `lint` case
- update novel-mode nav/copy keys from continuity-check wording to memory-center wording

- [ ] **Step 4: Re-run the focused tests**

Run: `npx vitest run src/components/layout/content-area.test.tsx`
Expected: PASS

### Task 4: Regression verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests for the changed area**

Run: `npx vitest run src/lib/novel/memory-center.test.ts src/components/novel/memory-center-view.test.tsx src/components/layout/content-area.test.tsx`
Expected: PASS

- [ ] **Step 2: Run project typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run mock test baseline**

Run: `npm run test:mocks`
Expected: PASS
