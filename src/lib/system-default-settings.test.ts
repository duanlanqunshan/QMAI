import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { useChatStore } from "@/stores/chat-store"
import { useWikiStore } from "@/stores/wiki-store"

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8")

describe("system default settings", () => {
  it("defaults AI output language to Chinese", () => {
    expect(useWikiStore.getState().outputLanguage).toBe("Chinese")
  })

  it("defaults chat history length to 20 messages", () => {
    expect(useChatStore.getState().maxHistoryMessages).toBe(20)
  })

  it("removes image captioning, web search, and output preferences from settings navigation", () => {
    const settingsView = read("../components/settings/settings-view.tsx")

    expect(settingsView).not.toContain("id: \"multimodal\"")
    expect(settingsView).not.toContain("id: \"web-search\"")
    expect(settingsView).not.toContain("id: \"output\"")
    expect(settingsView).not.toContain("MultimodalSection")
    expect(settingsView).not.toContain("WebSearchSection")
    expect(settingsView).not.toContain("OutputSection")
  })
})
