// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import "@/i18n"
import { EmbeddingSection } from "./embedding-section"
import { RerankSection } from "./rerank-section"
import type { SettingsDraft } from "../settings-types"

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
    apiKey: "",
    model: "",
    ollamaUrl: "http://localhost:11434",
    customEndpoint: "",
    maxContextSize: 131072,
    apiMode: "chat_completions",
    reasoning: { mode: "auto" },
    embeddingEnabled: false,
    embeddingEndpoint: "",
    embeddingApiKey: "",
    embeddingModel: "",
    embeddingOutputDimensionality: undefined,
    embeddingMaxChunkChars: undefined,
    embeddingOverlapChunkChars: undefined,
    rerankConfig: {
      enabled: false,
      useMainLlm: true,
      provider: "custom",
      apiKey: "",
      model: "",
      ollamaUrl: "http://localhost:11434",
      customEndpoint: "",
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

describe("settings enable-expand behavior", () => {
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it("expands embedding without enabling it when clicking the main label area", async () => {
    let draft = createDraft()
    const setDraft = ((key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => {
      draft = { ...draft, [key]: value }
    }) as (key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => void

    await act(async () => {
      root.render(<EmbeddingSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    const buttons = Array.from(host.querySelectorAll("button"))
    const mainButton = buttons.find((node) => node.textContent?.includes("启用向量搜索"))
    if (!(mainButton instanceof HTMLButtonElement)) {
      throw new Error("embedding main button not found")
    }

    await act(async () => {
      mainButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })

    await act(async () => {
      root.render(<EmbeddingSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    expect(draft.embeddingEnabled).toBe(false)
    expect(host.textContent).toContain("接口地址")
  })

  it("closes embedding stably when clicking the main label area again", async () => {
    let draft = createDraft()
    const setDraft = ((key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => {
      draft = { ...draft, [key]: value }
    }) as (key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => void

    await act(async () => {
      root.render(<EmbeddingSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    let mainButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("启用向量搜索"),
    )
    if (!(mainButton instanceof HTMLButtonElement)) {
      throw new Error("embedding main button not found")
    }
    const openedEmbeddingButton = mainButton

    await act(async () => {
      openedEmbeddingButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      root.render(<EmbeddingSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    mainButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("启用向量搜索"),
    )
    if (!(mainButton instanceof HTMLButtonElement)) {
      throw new Error("embedding main button not found after open")
    }

    await act(async () => {
      mainButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      root.render(<EmbeddingSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    expect(draft.embeddingEnabled).toBe(false)
    expect(host.textContent).not.toContain("接口地址")
  })

  it("expands rerank without enabling it when clicking the main label area", async () => {
    let draft = createDraft()
    const setDraft = ((key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => {
      draft = { ...draft, [key]: value }
    }) as (key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => void

    await act(async () => {
      root.render(<RerankSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    const buttons = Array.from(host.querySelectorAll("button"))
    const mainButton = buttons.find((node) => node.textContent?.includes("启用重排"))
    if (!(mainButton instanceof HTMLButtonElement)) {
      throw new Error("rerank main button not found")
    }

    await act(async () => {
      mainButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })

    await act(async () => {
      root.render(<RerankSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    expect(draft.rerankConfig.enabled).toBe(false)
    expect(host.textContent).toContain("复用主模型")
  })

  it("closes rerank stably when clicking the main label area again", async () => {
    let draft = createDraft()
    const setDraft = ((key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => {
      draft = { ...draft, [key]: value }
    }) as (key: keyof SettingsDraft, value: SettingsDraft[keyof SettingsDraft]) => void

    await act(async () => {
      root.render(<RerankSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    let mainButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("启用重排"),
    )
    if (!(mainButton instanceof HTMLButtonElement)) {
      throw new Error("rerank main button not found")
    }
    const openedRerankButton = mainButton

    await act(async () => {
      openedRerankButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      root.render(<RerankSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    mainButton = Array.from(host.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("启用重排"),
    )
    if (!(mainButton instanceof HTMLButtonElement)) {
      throw new Error("rerank main button not found after open")
    }

    await act(async () => {
      mainButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      root.render(<RerankSection draft={draft} setDraft={setDraft} />)
    })
    await flush()

    expect(draft.rerankConfig.enabled).toBe(false)
    expect(host.textContent).not.toContain("复用主模型")
  })
})
