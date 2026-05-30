import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useChatStore } from "./chat-store"

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    isStreaming: false,
    streamingContent: "",
    mode: "chat",
    ingestSource: null,
    maxHistoryMessages: 20,
  })
})

describe("chat-store", () => {
  it("createConversation 会为新会话设置 deAiMode 默认值 false", () => {
    const id = useChatStore.getState().createConversation()

    const conversation = useChatStore.getState().conversations.find((item) => item.id === id)

    expect(conversation).toBeTruthy()
    expect(conversation?.deAiMode).toBe(false)
  })

  it("setConversationDeAiMode 只更新目标会话的 deAiMode", () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValue(123456)

    const store = useChatStore.getState()
    const firstId = store.createConversation()
    const secondId = useChatStore.getState().createConversation()
    const beforeUpdate = useChatStore.getState().conversations
    const firstBeforeUpdate = beforeUpdate.find((item) => item.id === firstId)
    const secondBeforeUpdate = beforeUpdate.find((item) => item.id === secondId)

    nowSpy.mockReturnValue(234567)

    useChatStore.getState().setConversationDeAiMode(firstId, true)

    const conversations = useChatStore.getState().conversations
    const firstConversation = conversations.find((item) => item.id === firstId)
    const secondConversation = conversations.find((item) => item.id === secondId)

    expect(firstConversation?.deAiMode).toBe(true)
    expect(firstConversation?.updatedAt).toBe(234567)
    expect(secondConversation?.deAiMode).toBe(false)
    expect(secondConversation?.updatedAt).toBe(secondBeforeUpdate?.updatedAt)
    expect(firstBeforeUpdate?.updatedAt).toBe(123456)
  })

  it("切换当前会话不会改动任一会话的 deAiMode", () => {
    const store = useChatStore.getState()
    const firstId = store.createConversation()
    const secondId = useChatStore.getState().createConversation()

    useChatStore.getState().setConversationDeAiMode(firstId, true)
    const beforeSwitch = useChatStore.getState().conversations.map((conversation) => ({
      id: conversation.id,
      deAiMode: conversation.deAiMode,
    }))

    useChatStore.getState().setActiveConversation(firstId)

    expect(useChatStore.getState().activeConversationId).toBe(firstId)
    expect(useChatStore.getState().conversations.map((conversation) => ({
      id: conversation.id,
      deAiMode: conversation.deAiMode,
    }))).toEqual(beforeSwitch)
    expect(useChatStore.getState().conversations.find((conversation) => conversation.id === secondId)?.deAiMode).toBe(false)
  })

  it("重命名会话不会破坏 deAiMode", () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValue(100)

    const id = useChatStore.getState().createConversation()
    useChatStore.getState().setConversationDeAiMode(id, true)
    const beforeRename = useChatStore.getState().conversations.find((conversation) => conversation.id === id)

    nowSpy.mockReturnValue(200)
    useChatStore.getState().renameConversation(id, "新的会话标题")

    const renamedConversation = useChatStore.getState().conversations.find((conversation) => conversation.id === id)

    expect(renamedConversation?.title).toBe("新的会话标题")
    expect(renamedConversation?.deAiMode).toBe(true)
    expect(renamedConversation?.updatedAt).toBe(200)
    expect(beforeRename?.deAiMode).toBe(true)
  })

  it("删除其他会话不会破坏剩余会话的 deAiMode", () => {
    const store = useChatStore.getState()
    const firstId = store.createConversation()
    const secondId = useChatStore.getState().createConversation()

    useChatStore.getState().setConversationDeAiMode(firstId, true)
    useChatStore.getState().deleteConversation(secondId)

    const remainingConversation = useChatStore.getState().conversations.find((conversation) => conversation.id === firstId)

    expect(useChatStore.getState().conversations).toHaveLength(1)
    expect(remainingConversation?.deAiMode).toBe(true)
    expect(useChatStore.getState().activeConversationId).toBe(firstId)
  })
})
