import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { createDirectory, readFile, writeFile } from "@/commands/fs"
import {
  applyDashboardInsertBeforeToMarkdown,
  applyDashboardRewriteToMarkdown,
  buildFactCheckInsertMessages,
  buildDashboardRewriteMessages,
  createEmptyDashboardIssueState,
  findChapterSelectionByEvidence,
  getDashboardIssueStorePath,
  loadDashboardIssueState,
  parseFactCheckInsertPlan,
  restoreDashboardRewriteInMarkdown,
  saveDashboardIssueState,
  sanitizeDashboardEvidence,
  type DashboardIssueRewriteBackup,
} from "./dashboard-issue-actions"

const mockCreateDirectory = vi.mocked(createDirectory)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

describe("dashboard-issue-actions", () => {
  beforeEach(() => {
    mockCreateDirectory.mockReset()
    mockReadFile.mockReset()
    mockWriteFile.mockReset()
  })

  it("sanitizes chapter prefixes and wrapping quotes from evidence", () => {
    expect(sanitizeDashboardEvidence("第2章： “她的身影如同流星划过夜空。” ")).toBe("她的身影如同流星划过夜空。")
  })

  it("finds the body selection from dashboard evidence", () => {
    const markdown = "# 第2章\n\n她的身影如同流星划过夜空，留下了一道耀眼的光芒。\n后文。"
    const selection = findChapterSelectionByEvidence(markdown, [
      "第2章：她的身影如同流星划过夜空，留下了一道耀眼的光芒。",
    ])

    expect(selection).not.toBeNull()
    expect(selection?.selection.text).toBe("她的身影如同流星划过夜空，留下了一道耀眼的光芒。")
  })

  it("replaces the matched dashboard snippet and preserves the heading", () => {
    const markdown = "# 第2章\n\n她的身影如同流星划过夜空，留下了一道耀眼的光芒。\n后文。"
    const anchor = findChapterSelectionByEvidence(markdown, ["她的身影如同流星划过夜空，留下了一道耀眼的光芒。"])
    const replaced = anchor
      ? applyDashboardRewriteToMarkdown(markdown, anchor, "她的身影掠过夜空，像一道转瞬即逝的寒星。")
      : null

    expect(replaced).toContain("# 第2章")
    expect(replaced).toContain("她的身影掠过夜空，像一道转瞬即逝的寒星。")
    expect(replaced).not.toContain("留下了一道耀眼的光芒")
  })

  it("preserves frontmatter when replacing a dashboard snippet", () => {
    const markdown = [
      "---",
      'title: "第2章"',
      "chapter_number: 2",
      "---",
      "",
      "# 第2章",
      "",
      "她的身影如同流星划过夜空，留下了一道耀眼的光芒。",
    ].join("\n")
    const anchor = findChapterSelectionByEvidence(markdown, ["她的身影如同流星划过夜空，留下了一道耀眼的光芒。"])
    const replaced = anchor
      ? applyDashboardRewriteToMarkdown(markdown, anchor, "她的身影掠过夜空，像一道转瞬即逝的寒星。")
      : null

    expect(replaced).toContain('title: "第2章"')
    expect(replaced).toContain("# 第2章")
    expect(replaced).toContain("她的身影掠过夜空，像一道转瞬即逝的寒星。")
  })

  it("restores the original snippet from a persisted backup", () => {
    const backup: DashboardIssueRewriteBackup = {
      itemId: "review|plot",
      targetPath: "E:/Novel/wiki/chapters/002.md",
      evidence: "她的身影如同流星划过夜空，留下了一道耀眼的光芒。",
      originalText: "她的身影如同流星划过夜空，留下了一道耀眼的光芒。",
      replacementText: "她的身影掠过夜空，像一道转瞬即逝的寒星。",
      updatedAt: "2026-05-26T00:00:00.000Z",
    }

    const restored = restoreDashboardRewriteInMarkdown(
      "# 第2章\n\n她的身影掠过夜空，像一道转瞬即逝的寒星。\n后文。",
      backup,
    )

    expect(restored).toContain("她的身影如同流星划过夜空，留下了一道耀眼的光芒。")
  })

  it("returns an empty state when persistence file is absent", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"))

    await expect(loadDashboardIssueState("E:/Novel")).resolves.toEqual(createEmptyDashboardIssueState())
  })

  it("creates .qmai and writes dashboard issue state", async () => {
    const state = {
      ignored: { "review|plot": true as const },
      rewrites: {},
    }
    mockCreateDirectory.mockResolvedValueOnce()
    mockWriteFile.mockResolvedValueOnce()

    await saveDashboardIssueState("E:/Novel", state)

    expect(mockCreateDirectory).toHaveBeenCalledWith("E:/Novel/.qmai")
    expect(mockWriteFile).toHaveBeenCalledWith(
      getDashboardIssueStorePath("E:/Novel"),
      JSON.stringify(state, null, 2),
    )
  })

  it("matches truncated evidence that ends with an ellipsis", () => {
    const markdown = "# 第2章\n\n她的身影如同流星划过夜空，留下一道耀眼的光芒。\n后文。"
    const selection = findChapterSelectionByEvidence(markdown, [
      "“她的身影如同流星划过夜空……”",
    ])

    expect(selection).not.toBeNull()
    expect(selection?.selection.text).toContain("她的身影如同流星划过夜空")
  })

  it("builds rewrite messages with the actual issue text and suggestion", () => {
    const messages = buildDashboardRewriteMessages(
      "时间氛围描写与主线清晨不一致",
      "把“夜空”改成白天意象",
      "她的身影如同流星划过夜空。",
    )

    expect(messages[1]?.content).toContain("时间氛围描写与主线清晨不一致")
    expect(messages[1]?.content).toContain("把“夜空”改成白天意象")
    expect(messages[1]?.content).toContain("她的身影如同流星划过夜空。")
  })
  it("builds factcheck insert messages from the issue and chapter body", () => {
    const messages = buildFactCheckInsertMessages(
      "character_jump",
      "角色状态跳变，缺少中间事件",
      "请补足状态变化支撑",
      "第1章：楚白仍在消沉",
      "第2章：楚白已决定养家",
      "楚白坐在灶前，沉默地看着火光。\n女儿缩在门边，不敢出声。",
    )

    expect(messages[0]?.content).toContain("只返回 JSON")
    expect(messages[1]?.content).toContain("问题类型：character_jump")
    expect(messages[1]?.content).toContain("第2章：楚白已决定养家")
    expect(messages[1]?.content).toContain("楚白坐在灶前")
  })

  it("parses factcheck insert plans returned by AI", () => {
    const plan = parseFactCheckInsertPlan(
      '{"anchorText":"女儿缩在门边，不敢出声。","insertText":"楚白看着女儿冻红的手，心里忽然像被针扎了一下。"}',
    )

    expect(plan).toEqual({
      anchorText: "女儿缩在门边，不敢出声。",
      insertText: "楚白看着女儿冻红的手，心里忽然像被针扎了一下。",
    })
  })

  it("inserts factcheck补写内容 before the chosen anchor", () => {
    const markdown = "# 第2章\n\n楚白坐在灶前，沉默地看着火光。\n女儿缩在门边，不敢出声。"
    const anchor = findChapterSelectionByEvidence(markdown, ["女儿缩在门边，不敢出声。"])
    const replaced = anchor
      ? applyDashboardInsertBeforeToMarkdown(
        markdown,
        anchor,
        "楚白看着女儿冻红的手，心里忽然一紧，第一次认真盘算起今后的活路。",
      )
      : null

    expect(replaced).toContain("楚白看着女儿冻红的手，心里忽然一紧，第一次认真盘算起今后的活路。")
    expect(replaced).toContain("女儿缩在门边，不敢出声。")
  })
})
