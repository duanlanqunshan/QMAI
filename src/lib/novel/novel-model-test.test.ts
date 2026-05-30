import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LlmConfig, NovelConfig } from "@/stores/wiki-store"

vi.mock("@/lib/llm-client", () => ({
  streamChat: vi.fn(),
}))

import { streamChat } from "@/lib/llm-client"
import { testNovelModel } from "@/lib/novel/novel-model-test"

const baseLlmConfig: LlmConfig = {
  provider: "openai",
  apiKey: "test-key",
  model: "main-model",
  ollamaUrl: "http://localhost:11434",
  customEndpoint: "https://example.com/v1/chat/completions",
  maxContextSize: 4096,
  reasoning: { mode: "auto" },
}

const baseNovelConfig: NovelConfig = {
  contextTokenBudget: 0,
  recentSummaryWindow: 8,
  searchTopK: 5,
  autoIngestOnSave: true,
  autoExtractOnImport: true,
  reviewBeforeSave: false,
  writingModel: "",
  reviewModel: "",
  summaryModel: "",
  extractModel: "",
}

describe("testNovelModel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses the task-specific model when configured", async () => {
    vi.mocked(streamChat).mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("写作模型测试成功")
      callbacks.onDone()
    })

    const result = await testNovelModel(
      baseLlmConfig,
      { ...baseNovelConfig, writingModel: "novel-writing-model" },
      "writing",
    )

    expect(vi.mocked(streamChat).mock.calls[0]?.[0].model).toBe("novel-writing-model")
    expect(result).toEqual({
      model: "novel-writing-model",
      content: "写作模型测试成功",
      usedFallbackModel: false,
    })
  })

  it("falls back to the main model when the novel model is empty", async () => {
    vi.mocked(streamChat).mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("摘要模型测试成功")
      callbacks.onDone()
    })

    const result = await testNovelModel(baseLlmConfig, baseNovelConfig, "summary")

    expect(vi.mocked(streamChat).mock.calls[0]?.[0].model).toBe("main-model")
    expect(result.usedFallbackModel).toBe(true)
  })

  it("throws when the model returns empty content", async () => {
    vi.mocked(streamChat).mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onDone()
    })

    await expect(testNovelModel(baseLlmConfig, baseNovelConfig, "review")).rejects.toThrow(
      "模型已连接，但没有返回可用内容。",
    )
  })
})
