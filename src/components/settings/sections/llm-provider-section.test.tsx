// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/i18n"
import { useWikiStore } from "@/stores/wiki-store"
import { LlmProviderSection } from "./llm-provider-section"

const modelListMocks = vi.hoisted(() => ({
  fetchLlmModelList: vi.fn(),
}))

const modelTestMocks = vi.hoisted(() => ({
  testSettingsLlmModel: vi.fn(),
}))

vi.mock("@/lib/settings-model-list", () => ({
  fetchLlmModelList: modelListMocks.fetchLlmModelList,
}))

vi.mock("@/lib/settings-model-test", () => ({
  testSettingsLlmModel: modelTestMocks.testSettingsLlmModel,
}))

let host: HTMLDivElement
let root: Root

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("LlmProviderSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    useWikiStore.setState({
      llmConfig: {
        provider: "custom",
        apiKey: "sk-test",
        model: "",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "https://api.siliconflow.cn/v1",
        maxContextSize: 131072,
        apiMode: "chat_completions",
        reasoning: { mode: "auto" },
      },
      providerConfigs: {
        custom: {
          apiKey: "sk-test",
          model: "",
          baseUrl: "https://api.siliconflow.cn/v1",
          apiMode: "chat_completions",
          maxContextSize: 131072,
          reasoning: { mode: "auto" },
        },
      },
      activePresetId: "custom",
    })
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  })

  it("loads models even when the model field is empty", async () => {
    modelTestMocks.testSettingsLlmModel.mockRejectedValue(new Error("请先填写模型名称后再测试。"))
    modelListMocks.fetchLlmModelList.mockResolvedValue({
      models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen3-32B"],
    })

    await act(async () => {
      root.render(<LlmProviderSection />)
    })
    await flush()

    const expandButton = host.querySelector("button")
    if (!(expandButton instanceof HTMLButtonElement)) {
      throw new Error("expand button not found")
    }

    await act(async () => {
      expandButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await flush()

    const testButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("测试模型"),
    )
    if (!(testButton instanceof HTMLButtonElement)) {
      throw new Error("test button not found")
    }

    await act(async () => {
      testButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    await flush()

    expect(modelTestMocks.testSettingsLlmModel).not.toHaveBeenCalled()
    expect(modelListMocks.fetchLlmModelList).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "sk-test",
      customEndpoint: "https://api.siliconflow.cn/v1",
      model: "",
      provider: "custom",
    }))
    expect(host.textContent).toContain("已拉取 2 个模型")
  })
})
