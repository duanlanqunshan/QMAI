import { describe, expect, it } from "vitest"
import {
  clampChatHeight,
  clampSidebarWidth,
  getConversationTabTitle,
  isWorkspaceView,
  sortConversationsByUpdatedAt,
} from "./workspace-layout"

describe("workspace-layout", () => {
  it("treats wiki as the writing workspace view", () => {
    expect(isWorkspaceView("wiki")).toBe(true)
    expect(isWorkspaceView("settings")).toBe(false)
    expect(isWorkspaceView("graph")).toBe(false)
  })

  it("clamps sidebar width into the supported range", () => {
    expect(clampSidebarWidth(120)).toBe(150)
    expect(clampSidebarWidth(260)).toBe(260)
    expect(clampSidebarWidth(520)).toBe(400)
  })

  it("clamps chat panel height into the supported range", () => {
    expect(clampChatHeight(120)).toBe(180)
    expect(clampChatHeight(280)).toBe(280)
    expect(clampChatHeight(900)).toBe(520)
  })

  it("formats conversation titles for horizontal tabs", () => {
    expect(getConversationTabTitle("这是一个很长很长很长的历史对话标题", 10)).toBe("这是一个很长很长很…")
    expect(getConversationTabTitle("短标题", 10)).toBe("短标题")
  })

  it("sorts conversations by newest activity first", () => {
    const sorted = sortConversationsByUpdatedAt([
      { id: "a", title: "旧会话", createdAt: 1, updatedAt: 10, deAiMode: false },
      { id: "b", title: "新会话", createdAt: 2, updatedAt: 30, deAiMode: false },
      { id: "c", title: "中间会话", createdAt: 3, updatedAt: 20, deAiMode: false },
    ])

    expect(sorted.map((item) => item.id)).toEqual(["b", "c", "a"])
  })
})
