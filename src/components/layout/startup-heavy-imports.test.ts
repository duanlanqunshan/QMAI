import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sidebarPanelSource = readFileSync(resolve(__dirname, "sidebar-panel.tsx"), "utf8")
const knowledgeTreeSource = readFileSync(resolve(__dirname, "knowledge-tree.tsx"), "utf8")
const previewPanelSource = readFileSync(resolve(__dirname, "preview-panel.tsx"), "utf8")
const chatPanelSource = readFileSync(resolve(__dirname, "..", "chat", "chat-panel.tsx"), "utf8")

describe("startup heavy imports", () => {
  it("keeps memory-center out of the default sidebar startup path", () => {
    expect(sidebarPanelSource).not.toContain('import { loadMemoryCenterData')
    expect(sidebarPanelSource).toContain('import("@/lib/novel/memory-center")')
  })

  it("keeps chapter ingest out of the knowledge tree startup path", () => {
    expect(knowledgeTreeSource).not.toContain('import { deleteChapterSnapshots } from "@/lib/novel/chapter-ingest"')
    expect(knowledgeTreeSource).toContain('import("@/lib/novel/chapter-ingest")')
  })

  it("keeps chapter ingest and review modules out of the preview startup path", () => {
    expect(previewPanelSource).not.toContain('import { ingestChapter, ingestOutline } from "@/lib/novel/chapter-ingest"')
    expect(previewPanelSource).not.toContain('import { reviewChapter } from "@/lib/novel/review-adapter"')
    expect(previewPanelSource).not.toContain('import { SnapshotViewer } from "@/components/novel/snapshot-viewer"')
    expect(previewPanelSource).toContain('import("@/lib/novel/chapter-ingest")')
    expect(previewPanelSource).toContain('import("@/lib/novel/review-adapter")')
    expect(previewPanelSource).toContain('import("@/components/novel/snapshot-viewer")')
  })

  it("keeps novel context and ingest modules out of the chat startup path", () => {
    expect(chatPanelSource).not.toContain('import { buildContextPack, contextPackToPrompt } from "@/lib/novel/context-engine"')
    expect(chatPanelSource).not.toContain('import { ingestChapter } from "@/lib/novel/chapter-ingest"')
    expect(chatPanelSource).not.toContain('import { reviewChapter } from "@/lib/novel/review-adapter"')
    expect(chatPanelSource).toContain('import("@/lib/novel/context-engine")')
    expect(chatPanelSource).toContain('import("@/lib/novel/chapter-ingest")')
    expect(chatPanelSource).toContain('import("@/lib/novel/review-adapter")')
  })
})
