import { beforeEach, describe, expect, it } from "vitest"
import { useWikiStore } from "./wiki-store"

beforeEach(() => {
  useWikiStore.setState({ finalChapterSave: null, lintRun: null, reviewRun: null, searchPanelOpen: false })
})

describe("wiki-store finalChapterSave", () => {
  it("保存正式章节的状态在切换功能视图后仍然保留", () => {
    const store = useWikiStore.getState()

    store.setFinalChapterSave({
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      saving: true,
      phase: "saving",
    })
    store.setActiveView("settings")

    expect(useWikiStore.getState().finalChapterSave).toEqual({
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      saving: true,
      phase: "saving",
    })
  })

  it("清除旧保存状态后，同一章节后续操作可以使用新的本地状态", () => {
    const store = useWikiStore.getState()

    store.setFinalChapterSave({
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      saving: false,
      phase: "ingested",
      params: { chapter: 1 },
    })
    store.setFinalChapterSave(null)

    expect(useWikiStore.getState().finalChapterSave).toBeNull()
  })
})

describe("wiki-store long running novel checks", () => {
  it("开始检查后切换功能视图，检查状态仍然保留", () => {
    const store = useWikiStore.getState()

    store.setLintRun({
      runId: "lint-1",
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      running: true,
      hasRun: false,
      results: [],
    })
    store.setActiveView("settings")

    expect(useWikiStore.getState().lintRun).toEqual({
      runId: "lint-1",
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      running: true,
      hasRun: false,
      results: [],
    })
  })

  it("开始审稿后切换功能视图，审稿状态仍然保留", () => {
    const store = useWikiStore.getState()

    store.setReviewRun({
      runId: "review-1",
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      running: true,
      results: [],
    })
    store.setActiveView("search")

    expect(useWikiStore.getState().reviewRun).toEqual({
      runId: "review-1",
      projectPath: "/project-a",
      filePath: "/project-a/wiki/chapters/001.md",
      running: true,
      results: [],
    })
  })

  it("项目切换时清空保存、检查和审稿运行状态", () => {
    const store = useWikiStore.getState()

    store.setFinalChapterSave({ projectPath: "/project-a", filePath: "/project-a/wiki/chapters/001.md", saving: true, phase: "saving" })
    store.setLintRun({ runId: "lint-1", projectPath: "/project-a", running: true, hasRun: false, results: [] })
    store.setReviewRun({ runId: "review-1", projectPath: "/project-a", running: true, results: [] })
    store.clearTransientTaskState()

    expect(useWikiStore.getState().finalChapterSave).toBeNull()
    expect(useWikiStore.getState().lintRun).toBeNull()
    expect(useWikiStore.getState().reviewRun).toBeNull()
  })

  it("旧检查任务不能覆盖新检查任务", () => {
    const store = useWikiStore.getState()

    store.setLintRun({ runId: "lint-1", projectPath: "/project-a", running: true, hasRun: false, results: [] })
    store.setLintRun({ runId: "lint-2", projectPath: "/project-a", running: true, hasRun: false, results: [] })
    store.finishLintRun("lint-1", { running: false, hasRun: true, results: [], error: "旧检查失败" })

    expect(useWikiStore.getState().lintRun).toEqual({
      runId: "lint-2",
      projectPath: "/project-a",
      running: true,
      hasRun: false,
      results: [],
    })
  })

  it("旧审稿任务不能覆盖新审稿任务", () => {
    const store = useWikiStore.getState()

    store.setReviewRun({ runId: "review-1", projectPath: "/project-a", running: true, results: [] })
    store.setReviewRun({ runId: "review-2", projectPath: "/project-a", running: true, results: [] })
    store.finishReviewRun("review-1", { running: false, results: [], error: "旧审稿失败" })

    expect(useWikiStore.getState().reviewRun).toEqual({
      runId: "review-2",
      projectPath: "/project-a",
      running: true,
      results: [],
    })
  })

  it("检查和审稿失败状态可以保留给界面显示", () => {
    const store = useWikiStore.getState()

    store.setLintRun({ runId: "lint-1", projectPath: "/project-a", running: true, hasRun: false, results: [] })
    store.finishLintRun("lint-1", { running: false, hasRun: true, results: [], error: "检查失败，请稍后重试" })
    store.setReviewRun({ runId: "review-1", projectPath: "/project-a", running: true, results: [] })
    store.finishReviewRun("review-1", { running: false, results: [], error: "审稿失败，请稍后重试" })

    expect(useWikiStore.getState().lintRun?.error).toBe("检查失败，请稍后重试")
    expect(useWikiStore.getState().reviewRun?.error).toBe("审稿失败，请稍后重试")
  })
})

describe("wiki-store search panel", () => {
  it("keeps search panel state independent from activeView changes", () => {
    const store = useWikiStore.getState()

    store.setSearchPanelOpen(true)
    store.setActiveView("settings")

    expect(useWikiStore.getState().searchPanelOpen).toBe(true)
  })
})
