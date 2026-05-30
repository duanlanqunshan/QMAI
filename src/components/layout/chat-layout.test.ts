import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { getChapterToolbarOrder, getChatBarVisibility, getNextChatExpanded, shouldShowWritingChat } from "./chat-layout"

const chatPanelSource = readFileSync(resolve(__dirname, "..", "chat", "chat-panel.tsx"), "utf8")
const previewPanelSource = readFileSync(resolve(__dirname, "preview-panel.tsx"), "utf8")

describe("chat layout", () => {
  it("收起 AI 会话时不显示底部聊天栏", () => {
    expect(getChatBarVisibility(false)).toBe("hidden")
  })

  it("展开 AI 会话时显示原来的底部聊天窗口", () => {
    expect(getChatBarVisibility(true)).toBe("expanded")
  })

  it("左侧主导航 AI会话按钮可以切换打开和关闭", () => {
    expect(getNextChatExpanded(false)).toBe(true)
    expect(getNextChatExpanded(true)).toBe(false)
  })

  it("写作工作区收起 AI 会话时隐藏聊天面板", () => {
    expect(shouldShowWritingChat(false)).toBe(false)
    expect(shouldShowWritingChat(true)).toBe(true)
  })

  it("章节工具栏顺序按 AI会话 → 去AI味 → 章节状态排列", () => {
    expect(getChapterToolbarOrder()).toEqual(["ai-session", "de-ai", "chapter-status"])
  })

  it("预览面板源碼包含 handleDeAiSaveDraft 表明另存草稿存在", () => {
    expect(previewPanelSource).toContain("handleDeAiSaveDraft")
  })

  it("发送消息时接入去AI味默认模式", () => {
    expect(chatPanelSource).toContain("injectDeAiDirective")
    expect(chatPanelSource).toContain("deAiMode")
  })

  it("章节生成类对话会接入 QM-QUAI skill", () => {
    expect(chatPanelSource).toContain("buildQmQuaiSystemPrompt")
    expect(chatPanelSource).toContain('taskRoute.intent === "write_chapter"')
    expect(chatPanelSource).toContain('taskRoute.intent === "continue_chapter"')
    expect(chatPanelSource).toContain('taskRoute.intent === "rewrite_chapter"')
  })

  it("小说写作生成前会确认角色灵魂上下文", () => {
    expect(chatPanelSource).toContain("pendingSoulDialog")
    expect(chatPanelSource).toContain("本次写作将注入角色灵魂上下文")
    expect(chatPanelSource).toContain("contextPack.characterAuras")
    expect(chatPanelSource).toContain("DialogContent")
    expect(chatPanelSource).toContain("继续生成")
    expect(chatPanelSource).toContain("取消本次生成")
    expect(chatPanelSource).not.toContain("window.confirm")
    expect(chatPanelSource).toContain("已取消本次生成，角色灵魂上下文未发送给模型。")
  })

  it("预览面板中去AI味按钮出现在AI会话按钮后面", () => {
    const aiSessionIdx = previewPanelSource.indexOf("AI会话")
    const deAiIdx = previewPanelSource.lastIndexOf("去AI味")
    expect(aiSessionIdx).toBeGreaterThan(-1)
    expect(deAiIdx).toBeGreaterThan(-1)
    expect(deAiIdx).toBeGreaterThan(aiSessionIdx)
  })

  it("去AI味按钮点击后直接处理，不再显示下拉菜单项", () => {
    expect(previewPanelSource).toContain('onClick={() => void handleDeAiProcess()}')
    expect(previewPanelSource).not.toContain("处理当前内容")
    expect(previewPanelSource).not.toContain("设为默认")
  })
})
