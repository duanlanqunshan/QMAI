// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/i18n"
import { useWikiStore } from "@/stores/wiki-store"
import { EmbeddingSection } from "./embedding-section"
import { RerankSection } from "./rerank-section"
import type { SettingsDraft } from "../settings-types"

const modelListMocks = vi.hoisted(() => ({
  fetchEmbeddingModelList: vi.fn(),
  fetchRerankModelList: vi.fn(),
}))

const modelTestMocks = vi.hoisted(() => ({
  testSettingsEmbeddingModel: vi.fn(),
  testSettingsRerankModel: vi.fn(),
}))

vi.mock("@/lib/settings-model-list", () => ({
  fetchEmbeddingModelList: modelListMocks.fetchEmbeddingModelList,
  fetchRerankModelList: modelListMocks.fetchRerankModelList,
}))

vi.mock("@/lib/settings-model-test", () => ({
  testSettingsEmbeddingModel: modelTestMocks.testSettingsEmbeddingModel,
  testSettingsRerankModel: modelTestMocks.testSettingsRerankModel,
}))

let host: HTMLDivElement
let root: Root

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function createDraft(): SettingsDraft {
  return {
    provider: "custom",
    apiKey: "main-key",
    model: "main-model",
    ollamaUrl: "http://localhost:11434",
    customEndpoint: "https://api.siliconflow.cn/v1",
    maxContextSize: 131072,
    apiMode: "chat_completions",
    reasoning: { mode: "auto" },
    embeddingEnabled: true,
    embeddingEndpoint: "https://api.siliconflow.cn/v1/embeddings",
    embeddingApiKey: "emb-key",
    embeddingModel: "",
    embeddingOutputDimensionality: undefined,
    embeddingMaxChunkChars: undefined,
    embeddingOverlapChunkChars: undefined,
    rerankConfig: {
      enabled: true,
      useMainLlm: false,
      provider: "custom",
      apiKey: "rerank-key",
      model: "",
      ollamaUrl: "http://localhost:11434",
      customEndpoint: "https://api.siliconflow.cn/v1/rerank",
      apiMode: "chat_completions",
      maxCandidates: 12,
    },
    multimodalEnabled: false,
    multimodalUseMainLlm: true,
    multimodalProvider: "openai",
    multimodalApiKey: "",
    multimodalModel: "",
    multimodalOllamaUrl: "http://localhost:11434",
    multimodalCustomEndpoint: "",
    multimodalApiMode: "chat_completions",
    multimodalConcurrency: 2,
    outputLanguage: "auto",
    maxHistoryMessages: 20,
    proxyEnabled: false,
    proxyUrl: "",
    proxyBypassLocal: true,
    clipServerEnabled: false,
    clipServerPort: 8765,
    scheduledImportEnabled: false,
    scheduledImportPath: "",
    scheduledImportInterval: 5,
    sourceWatchConfig: {
      enabled: false,
      autoIngest: false,
      includeExtensions: [],
      excludeExtensions: [],
      excludeDirs: [],
      excludeGlobs: [],
      maxFileSizeMb: 10,
    },
    revisionFeedbackWindowConfig: {
      currentChapterIncludeShouldImprove: true,
      previousChapterCarryEnabled: true,
      lookbackChapterCount: 2,
      lookbackIncludeMustFixOnly: false,
    },
    novelConfig: {
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
    },
    uiLanguage: "zh",
  }
}

describe("embedding and rerank model list loading", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    useWikiStore.setState({
      llmConfig: {
        provider: "custom",
        apiKey: "main-key",
        model: "main-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "https://api.siliconflow.cn/v1",
        maxContextSize: 131072,
        apiMode: "chat_completions",
        reasoning: { mode: "auto" },
      },
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

  it("loads embedding models even when the model field is empty", async () => {
    const draft = createDraft()
    const setDraft = ((_: keyof SettingsDraft, __: SettingsDraft[keyof SettingsDraft]) => undefined) as (
      key: keyof SettingsDraft,
      value: SettingsDraft[keyof SettingsDraft],
    ) => void
    modelListMocks.fetchEmbeddingModelList.mockResolvedValue({
      models: ["BAAI/bge-m3", "Qwen/Qwen3-Embedding-4B"],
    })

    await act(async () => {
      root.render(<EmbeddingSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    const openButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("启用向量搜索"),
    )
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error("embedding open button not found")
    }

    await act(async () => {
      openButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await flush()

    const testButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("测试模型"),
    )
    if (!(testButton instanceof HTMLButtonElement)) {
      throw new Error("embedding test button not found")
    }

    await act(async () => {
      testButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    await flush()

    expect(modelTestMocks.testSettingsEmbeddingModel).not.toHaveBeenCalled()
    expect(modelListMocks.fetchEmbeddingModelList).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "https://api.siliconflow.cn/v1/embeddings",
      apiKey: "emb-key",
      model: "",
    }))
    expect(host.textContent).toContain("已拉取 2 个模型")
  })

  it("loads rerank models even when the model field is empty", async () => {
    const draft = createDraft()
    const setDraft = ((_: keyof SettingsDraft, __: SettingsDraft[keyof SettingsDraft]) => undefined) as (
      key: keyof SettingsDraft,
      value: SettingsDraft[keyof SettingsDraft],
    ) => void
    modelListMocks.fetchRerankModelList.mockResolvedValue({
      models: ["Qwen/Qwen3-Reranker-4B", "Qwen/Qwen3-Reranker-8B"],
    })

    await act(async () => {
      root.render(<RerankSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    const openButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("启用重排"),
    )
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error("rerank open button not found")
    }

    await act(async () => {
      openButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await flush()

    const testButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("测试模型"),
    )
    if (!(testButton instanceof HTMLButtonElement)) {
      throw new Error("rerank test button not found")
    }

    await act(async () => {
      testButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    await flush()

    expect(modelTestMocks.testSettingsRerankModel).not.toHaveBeenCalled()
    expect(modelListMocks.fetchRerankModelList).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "custom",
        apiKey: "main-key",
        model: "main-model",
      }),
      expect.objectContaining({
        customEndpoint: "https://api.siliconflow.cn/v1/rerank",
        apiKey: "rerank-key",
        model: "",
      }),
    )
    expect(host.textContent).toContain("已拉取 2 个模型")
  })
})
