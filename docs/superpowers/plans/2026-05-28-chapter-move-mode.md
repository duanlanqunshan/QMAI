# Chapter Long-Press Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild chapter movement so a selected chapter can be long-pressed and dragged to a new vertical position, while keeping normal click-open behavior and preserving titles and file paths.

**Architecture:** Keep the rewrite scoped to `knowledge-tree.tsx` and its focused regression test. Replace the current swap-style drag behavior with insert-style reorder logic that recalculates `chapter_number` for the reordered chapter list. Preserve existing rename, delete, and context-menu flows.

**Tech Stack:** React 19 + TypeScript + Vitest + Zustand + react-i18next

---

## File Map

- Modify: `src/components/layout/knowledge-tree.tsx`
  - Owns chapter tree rendering, selected state, long-press pointer flow, drag feedback, and chapter reorder writes.
- Modify: `src/components/layout/knowledge-tree.long-press.test.tsx`
  - Owns focused regression coverage for click, long-press entry, drag reorder, and right-click compatibility.
- Modify: `src/i18n/zh.json`
  - Only if a new Chinese hint string is needed for drag feedback.
- Modify: `src/i18n/en.json`
  - Only if the matching English key is needed.

---

### Task 1: Rewrite the focused tests around the new long-press reorder behavior

**Files:**
- Modify: `src/components/layout/knowledge-tree.long-press.test.tsx`
- Test: `src/components/layout/knowledge-tree.long-press.test.tsx`

- [ ] **Step 1: Keep the base fixtures and helpers, but replace move-mode assertions with reorder assertions**

Retain the existing fixture style, mocked filesystem, and pointer-event helper. Replace the move-mode tests with these drag-reorder expectations:

```typescript
it("opens a chapter on click when not dragging", async () => {
  await click(getPageButton(chapterAPath))

  expect(useWikiStore.getState().selectedFile).toBe(chapterAPath)
  expect(mocks.writeFile).not.toHaveBeenCalled()
})

it("does not start moving before the chapter is selected", async () => {
  const pageButtonA = getPageButton(chapterAPath)
  const pageButtonB = getPageButton(chapterBPath)
  const treeContainer = getTreeContainer()

  vi.spyOn(document, "elementFromPoint").mockReturnValue(pageButtonB)

  await act(async () => {
    pageButtonA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
    vi.advanceTimersByTime(320)
    treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 48 }))
    window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 48 }))
    await Promise.resolve()
  })

  expect(mocks.writeFile).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Add a failing test that defines insert-style reorder instead of swap-style move mode**

Add a new core test that states the intended behavior after the rewrite:

```typescript
it("reorders chapters after a selected chapter is long-pressed and dragged", async () => {
  const pageButtonA = getPageButton(chapterAPath)
  const pageButtonB = getPageButton(chapterBPath)
  const treeContainer = getTreeContainer()

  await click(pageButtonA)
  vi.spyOn(document, "elementFromPoint").mockReturnValue(pageButtonB)

  await act(async () => {
    pageButtonA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 8, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
    vi.advanceTimersByTime(320)
    treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 8, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 48 }))
    window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 8, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 48 }))
    await Promise.resolve()
  })

  expect(mocks.writeFile).toHaveBeenCalled()
  expect(fileContents[chapterAPath]).toContain(`title: ${titleA}`)
  expect(fileContents[chapterBPath]).toContain(`title: ${titleB}`)
  const rowsAfterReorder = Array.from(host.querySelectorAll<HTMLElement>("[data-page-path]"))
    .map((node) => node.textContent?.trim() ?? "")
  expect(rowsAfterReorder[0]).toContain(titleB)
  expect(rowsAfterReorder[1]).toContain(titleA)
})
```

- [ ] **Step 3: Keep rollback and right-click regressions, but remove the old move-mode button assertions**

Delete any expectation about a visible `移动` button or move-mode toggling. Keep:

```typescript
it("rolls back writes if reorder persistence fails", async () => {
  // keep the same failure fixture style, but assert original file contents remain unchanged
})

it("keeps desktop right-click page menus working", async () => {
  // keep the current contextmenu regression
})
```

- [ ] **Step 4: Run the focused test file and confirm it fails for the right reason**

Run:

```powershell
npx vitest run src/components/layout/knowledge-tree.long-press.test.tsx
```

Expected: FAIL because the current implementation still behaves like the older drag/swap code and does not yet satisfy the new reorder expectation.

---

### Task 2: Rebuild `knowledge-tree.tsx` around selected long-press reorder

**Files:**
- Modify: `src/components/layout/knowledge-tree.tsx`
- Test: `src/components/layout/knowledge-tree.long-press.test.tsx`

- [ ] **Step 1: Keep click-open behavior explicit and isolate drag entry to the selected row**

In `src/components/layout/knowledge-tree.tsx`, keep a dedicated click path:

```typescript
const handlePageClick = useCallback((pagePath: string) => {
  setArmedPath(null)
  if (renamingPath === pagePath) return
  setSelectedFile(pagePath)
}, [renamingPath, setSelectedFile])
```

Ensure pointer-based drag entry still returns early unless:

```typescript
if (event.button !== 0 || selectedFile !== pagePath || isDragging) return
```

- [ ] **Step 2: Replace swap-style reorder with insert-style reorder computation**

Add a small helper in `knowledge-tree.tsx` for ordered chapter paths:

```typescript
function reorderChapterPaths(paths: string[], sourcePath: string, targetPath: string): string[] {
  const current = [...paths]
  const sourceIndex = current.indexOf(sourcePath)
  const targetIndex = current.indexOf(targetPath)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current

  const [moved] = current.splice(sourceIndex, 1)
  current.splice(targetIndex, 0, moved)
  return current
}
```

Then replace the current two-file swap function with an insert-style reorder function:

```typescript
const executeChapterReorder = useCallback(async (sourcePath: string, targetPath: string) => {
  if (!project || sourcePath === targetPath) return

  const chapterPages = effectivePages
    .filter((page) => page.type === "chapter")
    .sort((left, right) => (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0))

  const reorderedPaths = reorderChapterPaths(
    chapterPages.map((page) => page.path),
    sourcePath,
    targetPath,
  )

  if (reorderedPaths.every((path, index) => path === chapterPages[index]?.path)) return

  const originalContents = new Map<string, string>()
  const writes = reorderedPaths.map(async (path, index) => {
    const content = await readFile(path)
    originalContents.set(path, content)
    return { path, content, chapterNumber: index + 1 }
  })

  const resolvedWrites = await Promise.all(writes)
  const applied: string[] = []
  try {
    for (const item of resolvedWrites) {
      await writeFile(item.path, updateChapterNumberContent(item.content, item.chapterNumber))
      applied.push(item.path)
    }
  } catch (error) {
    for (const path of applied.reverse()) {
      const original = originalContents.get(path)
      if (original) await writeFile(path, original)
    }
    throw error
  }

  await loadPages()
  const tree = await listDirectory(normalizePath(project.path))
  setFileTree(tree)
  bumpDataVersion()
}, [project, effectivePages, updateChapterNumberContent, loadPages, setFileTree, bumpDataVersion])
```

- [ ] **Step 3: Keep the pointer chain, but make its job only “start drag, track target, finish reorder”**

Use the existing timer-based entry structure, but point the finish logic to the new reorder function:

```typescript
const finishDragInteraction = useCallback(() => {
  if (dragTimerRef.current) {
    clearTimeout(dragTimerRef.current)
    dragTimerRef.current = null
  }

  const sourcePath = dragSourceRef.current
  const hoverPath = dragHoverRef.current

  removeGlobalPointerListenersRef.current?.()
  removeGlobalPointerListenersRef.current = null
  activePointerIdRef.current = null
  pendingPointerPositionRef.current = null
  dragSourceRef.current = null
  dragHoverRef.current = null
  setIsDragging(false)
  setDragSource(null)
  setDragHover(null)

  if (sourcePath && hoverPath && sourcePath !== hoverPath) {
    void executeChapterReorder(sourcePath, hoverPath)
  }
}, [executeChapterReorder])
```

- [ ] **Step 4: Render drag feedback for source and destination without adding new controls**

Keep the row-based rendering, but use row classes only for drag feedback:

```typescript
const isDragSource = dragSource === normalizedPath
const isDragHover = dragHover === normalizedPath && dragHover !== dragSource

className={`group flex items-center gap-1 rounded-md ${
  isSelected ? "qm-selected" : "qm-hover"
} ${isDragSource ? "opacity-60 ring-2 ring-primary/50" : ""} ${
  isDragHover ? "ring-2 ring-emerald-500/60" : ""
}`}
```

Do not add a move-mode button, extra toolbar, or any new click-only move UI.

- [ ] **Step 5: Preserve rename, delete, right-click, and text-selection guards**

Keep:

```typescript
const handlePageContextMenu = useCallback((event: React.MouseEvent, pagePath: string) => {
  if (filterType === "chapter" && lastPointerTypeRef.current !== "mouse") {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  openPageMenu(event, pagePath)
}, [filterType, openPageMenu])
```

Keep the existing `selectstart` prevention on chapter rows and ensure `startRenamePage` still clears any in-flight drag state before opening the rename input.

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```powershell
npx vitest run src/components/layout/knowledge-tree.long-press.test.tsx
```

Expected: PASS

---

### Task 3: Regression verification and local UI confirmation

**Files:**
- Verify: `src/components/layout/knowledge-tree.tsx`
- Verify: `src/components/layout/knowledge-tree.long-press.test.tsx`

- [ ] **Step 1: Run the mocked regression suite**

Run:

```powershell
npm run test:mocks
```

Expected: PASS

- [ ] **Step 2: Run the type checker**

Run:

```powershell
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Start the local app and verify the chapter list in browser**

Run the dev server:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite listens on `http://127.0.0.1:1420/`.

Then open the local UI and verify:

1. 单击章节仍然打开章节
2. 只有已选中的章节长按才进入拖动
3. 拖动后顺序变化符合落位
4. 右键菜单仍可用

---

## Spec Coverage Check

- 点击保持打开章节：Task 1 Step 1, Task 2 Step 1
- 只有已选中章节可长按拖动：Task 1 Step 1, Task 2 Step 1
- 拖动后按新顺序重排编号：Task 1 Step 2, Task 2 Step 2
- 不改标题和路径：Task 1 Step 2, Task 2 Step 2
- 保持右键菜单和其他旧功能：Task 1 Step 3, Task 2 Step 5
- 本地页面验证：Task 3 Step 3

## Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders remain.
- Each verification step has an explicit command.
- Code-touch steps name the exact file and include the intended logic.

## Type Consistency Check

- `executeChapterReorder`, `dragSource`, `dragHover`, and `handlePageClick` are used consistently.
- The plan does not introduce a move-mode state or button, matching the approved design.
