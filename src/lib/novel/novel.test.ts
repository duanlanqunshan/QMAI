import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, it, expect, vi, beforeEach } from "vitest"
import i18n from "@/i18n"
import {
  buildContextPack,
  contextPackToPrompt,
  type ContextPack,
} from "./context-engine"
import {
  bindCharacterAura,
  BUILT_IN_CHARACTER_AURAS,
  buildCharacterAuraContext,
  CHARACTER_AURA_RESEARCH_FILES,
  loadCharacterAuraResearchDocument,
  loadCharacterAuraSkillDocument,
  createCustomCharacterAura,
  createCustomCharacterAuraSkill,
  deleteCustomCharacterAura,
  listCharacterAuras,
  updateCustomCharacterAura,
} from "./character-aura"
import { useWikiStore, DEFAULT_NOVEL_CONFIG } from "@/stores/wiki-store"
import type { ChapterSnapshot } from "./chapter-ingest"

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  writeFileAtomic: vi.fn(),
  createDirectory: vi.fn(),
  fileExists: vi.fn(),
  listDirectory: vi.fn(),
}))

vi.mock("@/lib/search", () => ({
  searchWiki: vi.fn(),
  tokenizeQuery: (query: string) => query.split(/\s+/).filter(Boolean),
}))

vi.mock("@/lib/tauri-fetch", () => ({
  getHttpFetch: vi.fn(),
}))

vi.mock("@/lib/llm-client", () => ({
  streamChat: vi.fn(),
}))

vi.mock("@/lib/embedding", () => ({
  searchByEmbedding: vi.fn(),
  embedPage: vi.fn(),
}))

vi.mock("@/lib/graph-relevance", () => ({
  buildRetrievalGraph: vi.fn(async () => ({ nodes: new Map() })),
  getRelatedNodes: vi.fn(() => []),
}))

vi.mock("./chapter-ingest", () => ({
  listSnapshots: vi.fn(async () => []),
  loadSnapshot: vi.fn(async () => null),
}))

vi.mock("./revision-feedback", () => ({
  loadRevisionFeedbackForContext: vi.fn(async () => ({ mustFix: [], shouldImprove: [], carryToNextChapter: [] })),
  buildRevisionDirectives: vi.fn(() => ""),
}))

vi.mock("./character-cognition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./character-cognition")>()
  return {
    ...actual,
    loadCognitionState: vi.fn(async () => null),
    cognitionToContextText: vi.fn(() => ""),
  }
})

vi.mock("./volume", () => ({
  getChapterVolumes: vi.fn(() => []),
}))

vi.mock("./graph-adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./graph-adapter")>()
  return {
    ...actual,
    writePatchFieldsToWiki: vi.fn(async (...args: Parameters<typeof actual.writePatchFieldsToWiki>) => {
      return actual.writePatchFieldsToWiki(...args)
    }),
  }
})

import { readFile, writeFileAtomic, listDirectory, createDirectory, writeFile, fileExists } from "@/commands/fs"
import { searchWiki } from "@/lib/search"
import { searchByEmbedding } from "@/lib/embedding"
import { buildRetrievalGraph, getRelatedNodes } from "@/lib/graph-relevance"
import { listSnapshots, loadSnapshot } from "./chapter-ingest"
import { getHttpFetch } from "@/lib/tauri-fetch"
import { streamChat } from "@/lib/llm-client"

import { writePatchFieldsToWiki } from "./graph-adapter"

const mockReadFile = vi.mocked(readFile)
const mockWriteFileAtomic = vi.mocked(writeFileAtomic)
const mockWriteFile = vi.mocked(writeFile)
const mockListDirectory = vi.mocked(listDirectory)
const mockCreateDirectory = vi.mocked(createDirectory)
const mockFileExists = vi.mocked(fileExists)
const mockSearchWiki = vi.mocked(searchWiki)
const mockSearchByEmbedding = vi.mocked(searchByEmbedding)
const mockBuildRetrievalGraph = vi.mocked(buildRetrievalGraph)
const mockGetRelatedNodes = vi.mocked(getRelatedNodes)
const mockListSnapshots = vi.mocked(listSnapshots)
const mockLoadSnapshot = vi.mocked(loadSnapshot)
const mockGetHttpFetch = vi.mocked(getHttpFetch)
const mockStreamChat = vi.mocked(streamChat)
const mockWritePatchFieldsToWiki = vi.mocked(writePatchFieldsToWiki)

const REVISION_WINDOW_CONFIG = {
  currentChapterIncludeShouldImprove: false,
  previousChapterCarryEnabled: false,
  lookbackChapterCount: 1,
  lookbackIncludeMustFixOnly: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  useWikiStore.setState({
    novelMode: true,
    novelConfig: DEFAULT_NOVEL_CONFIG,
    revisionFeedbackWindowConfig: REVISION_WINDOW_CONFIG,
    embeddingConfig: {
      enabled: false,
      endpoint: "",
      apiKey: "",
      model: "",
    },
  })
})

describe("snapshot-history", () => {
  it("保存编辑后的快照前会备份旧版本", async () => {
    const { saveEditedSnapshot } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    mockCreateDirectory.mockReset()
    mockWriteFileAtomic.mockReset()
    mockReadFile.mockReset()
    mockFileExists.mockReset()
    mockFileExists.mockResolvedValue(true)
    mockReadFile.mockResolvedValue(JSON.stringify({ chapterNumber: 3, summary: "旧摘要" }))

    const snapshot: ChapterSnapshot = {
      chapterId: "chapter-3",
      chapterNumber: 3,
      summary: "新摘要",
      characters: [],
      locations: [],
      organizations: [],
      items: [],
      events: [],
      characterStateChanges: [],
      relationshipChanges: [],
      knowledgeChanges: [],
      foreshadowingChanges: [],
      newCanonFacts: [],
      timelineEvents: [],
      conflicts: [],
      endingHook: "",
      graphNodes: [],
      graphEdges: [],
    }

    await saveEditedSnapshot("/project", snapshot)

    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/.novel/snapshots/history/003")
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      expect.stringMatching(/\/project\/\.novel\/snapshots\/history\/003\/\d{4}-\d{2}-\d{2}T/),
      JSON.stringify({ chapterNumber: 3, summary: "旧摘要" }),
    )
  })

  it("恢复历史快照会把历史版本写回当前快照", async () => {
    const { restoreSnapshotHistory } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    mockCreateDirectory.mockReset()
    mockWriteFileAtomic.mockReset()
    mockReadFile.mockReset()
    const historySnapshot = {
      chapterId: "chapter-3",
      chapterNumber: 3,
      summary: "历史摘要",
      characters: [],
      locations: [],
      organizations: [],
      items: [],
      events: [],
      characterStateChanges: [],
      relationshipChanges: [],
      knowledgeChanges: [],
      foreshadowingChanges: [],
      newCanonFacts: [],
      timelineEvents: [],
      conflicts: [],
      endingHook: "",
      graphNodes: [],
      graphEdges: [],
    }
    mockReadFile.mockResolvedValue(JSON.stringify(historySnapshot))

    const restored = await restoreSnapshotHistory("/project", 3, "2026-05-22T09-30-00-000Z.snapshot.json")

    expect(restored.summary).toBe("历史摘要")
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/.novel/snapshots/003.snapshot.json",
      JSON.stringify(historySnapshot, null, 2),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/.novel/snapshots/003.snapshot.md",
      expect.stringContaining("历史摘要"),
    )
  })
})

  it("normalizes malformed legacy snapshot arrays when loading from disk", async () => {
    const { loadSnapshot } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    mockReadFile.mockReset()
    mockReadFile.mockResolvedValue(JSON.stringify({
      chapterId: "chapter-4",
      chapterNumber: 4,
      summary: "legacy snapshot",
      characters: "林烬",
      locations: null,
      organizations: ["巡夜司", 7],
      items: { broken: true },
      events: ["黑塔密谈"],
      characterStateChanges: "",
      relationshipChanges: ["林烬->SUSPECTS->太子"],
      knowledgeChanges: { broken: true },
      foreshadowingChanges: "推进伏笔：黑玉令来源",
      newCanonFacts: undefined,
      timelineEvents: 9,
      conflicts: ["主线冲突升级"],
      endingHook: 123,
      graphNodes: null,
      graphEdges: "character:林烬->KNOWS->secret:旧案",
    }))

    const loaded = await loadSnapshot("/project", 4)

    expect(loaded).not.toBeNull()
    expect(loaded).toMatchObject({
      chapterId: "chapter-4",
      chapterNumber: 4,
      summary: "legacy snapshot",
      characters: ["林烬"],
      locations: [],
      organizations: ["巡夜司", "7"],
      items: [],
      events: ["黑塔密谈"],
      characterStateChanges: [],
      relationshipChanges: ["林烬->SUSPECTS->太子"],
      knowledgeChanges: [],
      foreshadowingChanges: ["推进伏笔：黑玉令来源"],
      newCanonFacts: [],
      timelineEvents: ["9"],
      conflicts: ["主线冲突升级"],
      endingHook: "123",
      graphNodes: [],
      graphEdges: ["character:林烬->KNOWS->secret:旧案"],
    })
  })

describe("structured-memory-rag-export", () => {
  it("同步记忆时会导出结构化记忆页面供 RAG 检索", async () => {
    const { syncSnapshotToMemory } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    mockCreateDirectory.mockReset()
    mockWriteFileAtomic.mockReset()
    mockWriteFile.mockReset()
    mockReadFile.mockReset()
    mockFileExists.mockReset()
    mockFileExists.mockResolvedValue(false)
    mockReadFile.mockRejectedValue(new Error("missing"))

    const snapshot: ChapterSnapshot = {
      chapterId: "chapter-8",
      chapterNumber: 8,
      summary: "杨妙菲在雨夜听见竹哨声。",
      characters: ["杨妙菲"],
      locations: ["院里"],
      organizations: [],
      items: ["竹哨"],
      events: ["竹哨声响起"],
      characterStateChanges: ["杨妙菲：重伤"],
      relationshipChanges: [],
      knowledgeChanges: ["杨妙菲不知道竹哨引来的存在身份"],
      foreshadowingChanges: ["新增伏笔：竹哨 - 会引来非人的存在"],
      newCanonFacts: [],
      timelineEvents: ["雨夜逃亡"],
      conflicts: [],
      endingHook: "非人的存在出现",
      graphNodes: ["杨妙菲:character"],
      graphEdges: ["杨妙菲->USES->竹哨"],
    }

    await syncSnapshotToMemory("/project", snapshot)

    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/wiki/memory")
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/chapter-snapshots.md",
      expect.stringContaining("杨妙菲在雨夜听见竹哨声。"),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/character-cognition.md",
      expect.stringContaining("竹哨引来的存在身份"),
    )
    const characterStatesWrite = mockWriteFileAtomic.mock.calls.find(
      ([path]) => path === "/project/wiki/memory/character-states.md",
    )
    expect(characterStatesWrite?.[1]).toContain("### 杨妙菲")
    expect(characterStatesWrite?.[1]).toContain("- 当前状态：重伤")
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/character-states.md",
      expect.stringContaining("- 当前状态：重伤"),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/foreshadowing-tracker.md",
      expect.stringContaining("竹哨 - 会引来非人的存在"),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/timeline.md",
      expect.stringContaining("雨夜逃亡"),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/canon-facts.md",
      expect.any(String),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/wiki/memory/conflicts.md",
      expect.any(String),
    )
  })

  it("草稿章节摄取不会写入正式 Wiki、图谱、索引或上下文记忆", async () => {
    const { ingestChapter } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    useWikiStore.setState({
      novelMode: true,
      llmConfig: {
        provider: "custom",
        apiKey: "",
        model: "local-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "http://localhost:1234/v1/chat/completions",
        maxContextSize: 204800,
      },
    })
    mockReadFile.mockResolvedValue([
      "---",
      "type: chapter",
      "title: 草稿章",
      "chapter_number: 9",
      "chapter_status: draft",
      "---",
      "",
      "草稿正文。",
    ].join("\n"))

    const result = await ingestChapter("/project", "/project/wiki/chapters/chapter-9.md")

    expect(result.snapshot).toBeNull()
    expect(mockStreamChat).not.toHaveBeenCalled()
    expect(mockWriteFileAtomic).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockCreateDirectory).not.toHaveBeenCalled()
  })

  it("final 章节摄取会落地共享 Wiki patch 和索引文本输出结构", async () => {
    const { ingestChapter } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    useWikiStore.setState({
      novelMode: true,
      llmConfig: {
        provider: "custom",
        apiKey: "",
        model: "local-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "http://localhost:1234/v1/chat/completions",
        maxContextSize: 204800,
      },
    })
    mockReadFile.mockImplementation(async (path) => {
      if (path === "/project/wiki/chapters/chapter-12.md") {
        return [
          "---",
          "type: chapter",
          "title: 黑塔回响",
          "chapter_number: 12",
          "chapter_status: final",
          "---",
          "",
          "林烬在黑塔发现太子隐藏的旧案线索。",
        ].join("\n")
      }
      throw new Error("missing")
    })
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken(JSON.stringify({
        chapterId: "chapter-12",
        chapterNumber: 12,
        summary: "林烬在黑塔发现太子隐藏的旧案线索。",
        characters: ["林烬", "太子"],
        locations: ["黑塔"],
        organizations: ["巡夜司"],
        items: ["黑玉令"],
        events: ["黑塔密谈"],
        characterStateChanges: ["林烬：确认太子与旧案有关"],
        relationshipChanges: ["林烬->SUSPECTS->太子"],
        knowledgeChanges: ["林烬知道太子与旧案有关"],
        foreshadowingChanges: ["推进伏笔：黑玉令来源"],
        newCanonFacts: ["黑塔只允许巡夜司进入"],
        timelineEvents: ["子夜：林烬潜入黑塔"],
        conflicts: ["林烬与太子的暗线冲突升级"],
        endingHook: "黑玉令在墙中发出回响。",
        graphNodes: ["secret:黑玉令真相"],
        graphEdges: ["event:黑塔密谈->REVEALS->secret:黑玉令真相"],
      }))
      callbacks.onDone()
    })

    const result = await ingestChapter("/project", "/project/wiki/chapters/chapter-12.md")

    expect(result.snapshot?.chapterNumber).toBe(12)
    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/.novel/chapter-ingest-output")
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/.novel/chapter-ingest-output/012.output.json",
      expect.stringContaining('"wikiUpdatePatch"'),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/.novel/chapter-ingest-output/012.wiki-patch.json",
      expect.stringContaining('"sharedWiki": true'),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/.novel/chapter-ingest-output/012.search-index.json",
      expect.stringContaining("林烬在黑塔发现太子隐藏的旧案线索。"),
    )
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/.novel/chapter-ingest-output/012.vector-index.json",
      expect.stringContaining("黑塔只允许巡夜司进入"),
    )
  })

  it("ingestChapter 在写入快照和 ingest 输出后将 wikiUpdatePatch 落地为实体页面字段", async () => {
    const { ingestChapter } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    useWikiStore.setState({
      novelMode: true,
      llmConfig: {
        provider: "custom",
        apiKey: "",
        model: "local-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "http://localhost:1234/v1/chat/completions",
        maxContextSize: 204800,
      },
    })
    let wikiPatchContent = ""
    mockReadFile.mockImplementation(async (path) => {
      if (path === "/project/wiki/chapters/chapter-12.md") {
        return [
          "---",
          "type: chapter",
          "title: 黑塔回响",
          "chapter_number: 12",
          "chapter_status: final",
          "---",
          "",
          "林烬在黑塔发现太子隐藏的旧案线索。",
        ].join("\n")
      }
      if (path === "/project/.novel/chapter-ingest-output/012.wiki-patch.json") {
        return wikiPatchContent
      }
      throw new Error("missing")
    })
    mockWriteFileAtomic.mockImplementation(async (filePath, content) => {
      if (filePath === "/project/.novel/chapter-ingest-output/012.wiki-patch.json") {
        wikiPatchContent = content
      }
    })
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken(JSON.stringify({
        chapterId: "chapter-12",
        chapterNumber: 12,
        summary: "林烬在黑塔发现太子隐藏的旧案线索。",
        characters: ["林烬", "太子"],
        locations: ["黑塔"],
        organizations: ["巡夜司"],
        items: ["黑玉令"],
        events: ["黑塔密谈"],
        characterStateChanges: ["林烬：确认太子与旧案有关"],
        relationshipChanges: ["林烬->SUSPECTS->太子"],
        knowledgeChanges: ["林烬知道太子与旧案有关"],
        foreshadowingChanges: ["推进伏笔：黑玉令来源"],
        newCanonFacts: ["黑塔只允许巡夜司进入"],
        timelineEvents: ["子夜：林烬潜入黑塔"],
        conflicts: ["林烬与太子的暗线冲突升级"],
        endingHook: "黑玉令在墙中发出回响。",
        graphNodes: ["secret:黑玉令真相"],
        graphEdges: ["event:黑塔密谈->REVEALS->secret:黑玉令真相"],
      }))
      callbacks.onDone()
    })

    await ingestChapter("/project", "/project/wiki/chapters/chapter-12.md")

    expect(mockWritePatchFieldsToWiki).toHaveBeenCalledWith(
      "/project",
      expect.objectContaining({
        sharedWiki: true,
        entries: expect.arrayContaining([
          expect.objectContaining({ entryId: "character:林烬", entryType: "character" }),
          expect.objectContaining({ entryId: "chapter:12", entryType: "chapter" }),
        ]),
      }),
    )
  })

  it("ingestOutline 只提取初始记忆，不再拆写细化大纲文件", async () => {
    const { ingestOutline } = await vi.importActual<typeof import("./chapter-ingest")>("./chapter-ingest")
    useWikiStore.setState({
      novelMode: true,
      llmConfig: {
        provider: "custom",
        apiKey: "",
        model: "local-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "http://localhost:1234/v1/chat/completions",
        maxContextSize: 204800,
      },
    })
    mockReadFile.mockImplementation(async (path) => {
      if (path === "/project/wiki/outlines/story-outline.md") {
        return [
          "---",
          "type: outline",
          'title: "故事大纲"',
          "---",
          "",
          "# 故事大纲",
          "",
          "林烬奉命调查黑玉令与旧案。",
        ].join("\n")
      }
      throw new Error(`missing ${path}`)
    })
    mockStreamChat.mockImplementation(async (_config, messages, callbacks) => {
      const userPrompt = String(messages[1]?.content ?? "")
      expect(userPrompt).not.toContain('"storyOutline"')
      expect(userPrompt).not.toContain('"worldbuilding"')
      callbacks.onToken(JSON.stringify({
        chapterId: "outline-init",
        chapterNumber: 0,
        summary: "林烬奉命调查黑玉令与旧案。",
        characters: ["林烬"],
        locations: ["皇城"],
        organizations: ["巡夜司"],
        items: ["黑玉令"],
        events: ["旧案重启"],
        characterStateChanges: ["林烬：奉命进京查案"],
        relationshipChanges: ["林烬->SERVES->巡夜司"],
        knowledgeChanges: [],
        foreshadowingChanges: ["新增伏笔：黑玉令来源"],
        newCanonFacts: ["黑塔只允许巡夜司进入"],
        timelineEvents: ["旧案重启当夜：林烬接令"],
        conflicts: ["林烬与旧案幕后势力对立"],
        endingHook: "",
        graphNodes: ["character:林烬"],
        graphEdges: ["character:林烬->AFFILIATED_WITH->organization:巡夜司"],
      }))
      callbacks.onDone()
    })

    const snapshot = await ingestOutline("/project", "/project/wiki/outlines/story-outline.md")
    const writtenPaths = mockWriteFileAtomic.mock.calls.map(([filePath]) => String(filePath))

    expect(snapshot?.chapterNumber).toBe(0)
    expect(writtenPaths.some((filePath) => filePath.includes("/wiki/outlines/"))).toBe(false)
    expect(writtenPaths.some((filePath) => filePath.endsWith("/worldbuilding.md"))).toBe(false)
  })

  it("上下文包会综合更新后的章节快照、Wiki 检索和图谱邻域", async () => {
    const chapter11: ChapterSnapshot = {
      chapterId: "chapter-11",
      chapterNumber: 11,
      summary: "林烬取得黑玉令并怀疑太子。",
      characters: ["林烬", "太子"],
      locations: ["黑塔"],
      organizations: [],
      items: ["黑玉令"],
      events: ["黑塔密谈"],
      characterStateChanges: ["林烬：持有黑玉令"],
      relationshipChanges: ["林烬->SUSPECTS->太子"],
      knowledgeChanges: ["林烬知道太子与旧案有关"],
      foreshadowingChanges: ["推进伏笔：黑玉令来源"],
      newCanonFacts: ["黑塔只允许巡夜司进入"],
      timelineEvents: ["子夜：林烬进入黑塔"],
      conflicts: [],
      endingHook: "黑玉令在墙中发出回响。",
      graphNodes: [],
      graphEdges: [],
    }
    const chapter12: ChapterSnapshot = {
      ...chapter11,
      chapterId: "chapter-12",
      chapterNumber: 12,
      summary: "林烬追查黑玉令的铸造记录。",
      characterStateChanges: ["林烬：掌握黑玉令来自巡夜司旧库"],
      foreshadowingChanges: ["未回收伏笔：黑玉令来源"],
      timelineEvents: ["次日：林烬进入巡夜司旧库"],
      endingHook: "旧库账册缺失了太子签押的一页。",
    }
    mockListSnapshots.mockResolvedValue([11, 12])
    mockLoadSnapshot.mockImplementation(async (_projectPath, chapterNumber) => {
      if (chapterNumber === 11) return chapter11
      if (chapterNumber === 12) return chapter12
      return null
    })
    mockSearchWiki.mockImplementation(async (_projectPath, query) => {
      if (query.includes("关键词索引")) return [{ path: "/project/wiki/memory/chapter-snapshots.md", title: "章节快照记忆", snippet: "黑玉令索引文本", score: 1, titleMatch: true, images: [] }]
      return [{ path: "/project/wiki/entities/林烬.md", title: "林烬", snippet: "共享 Wiki：林烬掌握黑玉令来自巡夜司旧库", score: 1, titleMatch: true, images: [] }]
    })
    const linJinNode = { id: "character:林烬", title: "林烬", type: "entity", path: "/project/wiki/entities/林烬.md", sources: [], outLinks: new Set<string>(), inLinks: new Set<string>() }
    const blackTokenNode = { id: "item:黑玉令", title: "黑玉令", type: "entity", path: "/project/wiki/entities/黑玉令.md", sources: [], outLinks: new Set<string>(), inLinks: new Set<string>() }
    mockBuildRetrievalGraph.mockResolvedValue({
      nodes: new Map([
        [linJinNode.id, linJinNode],
        [blackTokenNode.id, blackTokenNode],
      ]),
      dataVersion: 1,
    })
    mockGetRelatedNodes.mockReturnValue([
      { node: blackTokenNode, relevance: 0.9 },
    ])
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "/project/wiki/entities/黑玉令.md") return "# 黑玉令\n\n图谱邻域：黑玉令来自巡夜司旧库。"
      throw new Error(`missing ${filePath}`)
    })

    const pack = await buildContextPack("/project", "写第13章，林烬继续追查黑玉令", 13)

    expect(pack.recentSummaries).toEqual(["第11章：林烬取得黑玉令并怀疑太子。", "第12章：林烬追查黑玉令的铸造记录。"])
    expect(pack.previousChapterEnding).toBe("旧库账册缺失了太子签押的一页。")
    expect(pack.characterStates).toContain("林烬：掌握黑玉令来自巡夜司旧库")
    expect(pack.foreshadowingStates).toContain("黑玉令来源")
    expect(pack.searchResults).toContain("共享 Wiki：林烬掌握黑玉令来自巡夜司旧库")
    expect(pack.searchResults).toContain("黑玉令索引文本")
    expect(pack.graphSearchResults).toContain("图谱邻域：黑玉令来自巡夜司旧库")
  })
})

describe("character-aura", () => {
  it("在当前小说项目内创建、编辑和删除自定义灵魂", async () => {
    mockReadFile.mockRejectedValue(new Error("missing"))
    mockWriteFileAtomic.mockResolvedValue(undefined)

    const created = await createCustomCharacterAura("/project", {
      name: "冷面谋士",
      sourceNote: "用户原创人物气质",
      corpus: "说话克制，重视证据。",
      styleDescription: "短句、留白、反问少。",
      behaviorRules: "先观察，再判断。",
      boundaries: "不得替代人物小传，不得违背正史规则。",
      notes: "适合军师角色。",
    })

    expect(created.builtIn).toBe(false)
    expect(mockWriteFileAtomic).toHaveBeenLastCalledWith(
      "/project/.qmai/character-aura.json",
      expect.stringContaining("冷面谋士"),
    )

    mockReadFile.mockResolvedValue(JSON.stringify({ customAuras: [created], bindings: [] }))
    const updated = await updateCustomCharacterAura("/project", created.id, { styleDescription: "语气冷静，判断精准。" })
    expect(updated.styleDescription).toBe("语气冷静，判断精准。")

    mockReadFile.mockResolvedValue(JSON.stringify({ customAuras: [updated], bindings: [{ characterName: "林烬", auraId: created.id }] }))
    const afterDelete = await deleteCustomCharacterAura("/project", created.id)
    expect(afterDelete.customAuras).toHaveLength(0)
    expect(afterDelete.bindings).toHaveLength(0)
  })

  it("绑定灵魂前要求人物存在小传或设定", async () => {
    mockReadFile.mockRejectedValue(new Error("missing"))
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockSearchWiki.mockResolvedValue([])

    await expect(bindCharacterAura("/project", { characterName: "林烬", auraId: "builtin-qin-shihuang" }))
      .rejects.toThrow("请先在大纲中添加人物小传或人物设定")

    expect(mockWriteFileAtomic).not.toHaveBeenCalled()

    mockSearchWiki.mockResolvedValue([
      { path: "/project/wiki/outlines/character-briefs.md", title: "人物小传", snippet: "林烬：谨慎，持有黑玉令。", score: 1, titleMatch: true, images: [] },
    ])
    mockReadFile.mockImplementation(async (path) => {
      if (path.endsWith("character-aura.json")) throw new Error("missing")
      if (path.endsWith("character-briefs.md")) return "# 人物小传\n\n林烬：谨慎，持有黑玉令。"
      return ""
    })

    const store = await bindCharacterAura("/project", { characterName: "林烬", auraId: "builtin-qin-shihuang" })
    expect(store.bindings).toEqual([{ characterName: "林烬", auraId: "builtin-qin-shihuang" }])
  })

  it("绑定灵魂前会校验 auraId 必须存在", async () => {
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockSearchWiki.mockResolvedValue([
      { path: "/project/wiki/outlines/character-briefs.md", title: "人物小传", snippet: "林烬：谨慎，持有黑玉令。", score: 1, titleMatch: true, images: [] },
    ])
    mockReadFile.mockImplementation(async (path) => {
      if (path.endsWith("character-aura.json")) return JSON.stringify({ customAuras: [], bindings: [] })
      if (path.endsWith("character-briefs.md")) return "# 人物小传\n\n林烬：谨慎，持有黑玉令。"
      return ""
    })

    await expect(bindCharacterAura("/project", { characterName: "林烬", auraId: "missing-aura" }))
      .rejects.toThrow("请选择有效的角色灵魂")

    expect(mockWriteFileAtomic).not.toHaveBeenCalled()
  })

  it("同一个小说人物改绑时保留原有绑定顺序", async () => {
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockSearchWiki.mockResolvedValue([
      { path: "/project/wiki/outlines/character-briefs.md", title: "人物小传", snippet: "杨墨：冷静。", score: 1, titleMatch: true, images: [] },
    ])
    mockReadFile.mockImplementation(async (path) => {
      if (path.endsWith("character-aura.json")) {
        return JSON.stringify({
          customAuras: [],
          bindings: [
            { characterName: "安伯", auraId: "builtin-qin-shihuang" },
            { characterName: "杨墨", auraId: "builtin-li-shimin" },
            { characterName: "方兴", auraId: "builtin-li-si" },
          ],
        })
      }
      if (path.endsWith("character-briefs.md")) return "# 人物小传\n\n杨墨：冷静。"
      return ""
    })

    const store = await bindCharacterAura("/project", { characterName: "杨墨", auraId: "builtin-lv-shu" })

    expect(store.bindings).toEqual([
      { characterName: "安伯", auraId: "builtin-qin-shihuang" },
      { characterName: "杨墨", auraId: "builtin-lv-shu" },
      { characterName: "方兴", auraId: "builtin-li-si" },
    ])
  })

  it("旧自定义灵魂数据仍可读取并与内置人物灵魂同列展示", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      customAuras: [{
        id: "custom-1",
        builtIn: false,
        name: "江湖浪客",
        sourceNote: "原创",
        corpus: "说话爽朗直白。",
        styleDescription: "爽朗直白",
        behaviorRules: "重情重义",
        boundaries: "不冒充真人",
        notes: "适合江湖角色。",
        createdAt: 1,
        updatedAt: 1,
      }],
      bindings: [],
    }))

    const auras = await listCharacterAuras("/project")
    expect(auras.some((aura) => aura.builtIn && aura.name === "秦始皇")).toBe(true)
    expect(auras.some((aura) => !aura.builtIn && aura.name === "江湖浪客" && aura.expressionDna === undefined)).toBe(true)
  })

  it("列出内置人物灵魂第一批人物姓名和分类", async () => {
    mockReadFile.mockRejectedValue(new Error("missing"))

    const names = BUILT_IN_CHARACTER_AURAS.map((aura) => aura.name)
    expect(names).toEqual(expect.arrayContaining(["秦始皇", "李世民", "李斯", "赵高", "张良", "乔布斯", "马斯克", "张一鸣", "芒格", "张雪峰", "孙宇晨", "费曼", "塔勒布", "纳瓦尔", "保罗·格雷厄姆", "安德烈·卡帕西", "伊利亚·苏茨凯弗", "野兽先生", "武则天", "诸葛亮"]))
    expect(BUILT_IN_CHARACTER_AURAS.length).toBeGreaterThanOrEqual(20)
    expect(BUILT_IN_CHARACTER_AURAS.every((aura) => Boolean(aura.category))).toBe(true)
  })

  it("内置人物灵魂包含女娲式五层结构和诚实边界", () => {
    const qin = BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === "秦始皇")

    expect(qin?.expressionDna).toContain("表达特征")
    expect(qin?.mentalModel).toContain("心智模型")
    expect(qin?.decisionHeuristics).toContain("决策启发式")
    expect(qin?.valueAntiPatterns).toContain("价值观反模式")
    expect(qin?.honestyBoundaries).toContain("诚实边界")
  })

  it("内置人物灵魂都对应真实女娲灵魂文件夹", () => {
    const requiredResearchFiles = ["01-writings.md", "02-conversations.md", "03-expression-dna.md", "04-external-views.md", "05-decisions.md", "06-timeline.md"]
    const requiredSkillSections = ["## 角色扮演规则", "## 回答工作流", "## 身份卡", "## 核心心智模型", "## 决策启发式", "## 表达特征", "## 人物时间线", "## 价值观与反模式", "## 诚实边界", "## 研究文件索引", "## 绑定到小说角色时的使用方式", "## 质量校验清单"]

    for (const aura of BUILT_IN_CHARACTER_AURAS) {
      expect(aura.skillFolder, `${aura.name} 缺少灵魂文件夹路径`).toBeTruthy()
      const folder = resolve(process.cwd(), aura.skillFolder ?? "")
      const skillFile = resolve(folder, "SKILL.md")
      const researchFolder = resolve(folder, "references", "research")
      expect(existsSync(skillFile), `${aura.name} 缺少 SKILL.md`).toBe(true)
      expect(existsSync(researchFolder), `${aura.name} 缺少 references/research 资料目录`).toBe(true)
      for (const researchFile of requiredResearchFiles) {
        expect(existsSync(resolve(researchFolder, researchFile)), `${aura.name} 缺少 ${researchFile}`).toBe(true)
      }
      const skill = readFileSync(skillFile, "utf8")
      expect(skill).toContain("---")
      for (const section of requiredSkillSections) {
        expect(skill, `${aura.name} 缺少 ${section}`).toContain(section)
      }
    }
  })

  it("内置人物灵魂研究文件不是占位内容", () => {
    const placeholderPatterns = [
      "当前内置版本只写入压缩摘要",
      "后续可继续补充",
      "本目录用于保存",
    ]

    for (const aura of BUILT_IN_CHARACTER_AURAS) {
      const folder = resolve(process.cwd(), aura.skillFolder ?? "")
      for (const researchFile of CHARACTER_AURA_RESEARCH_FILES) {
        const filePath = resolve(folder, "references", "research", researchFile.fileName)
        const content = readFileSync(filePath, "utf8")
        expect(content.length, `${aura.name} 的 ${researchFile.fileName} 内容过短`).toBeGreaterThan(500)
        for (const pattern of placeholderPatterns) {
          expect(content, `${aura.name} 的 ${researchFile.fileName} 仍包含占位文案：${pattern}`).not.toContain(pattern)
        }
        expect(content, `${aura.name} 的 ${researchFile.fileName} 缺少创作用途`).toContain("创作用途")
        expect(content, `${aura.name} 的 ${researchFile.fileName} 缺少边界说明`).toMatch(/边界|禁止|不用于|不等同/)
      }
    }
  })

  it("人物灵魂相关文案不出现英文字符", () => {
    const englishPattern = /[A-Za-z]/

    for (const aura of BUILT_IN_CHARACTER_AURAS) {
      expect(aura.name, `${aura.id} 的人物名称仍含英文`).not.toMatch(englishPattern)
      expect(aura.sourceNote, `${aura.name} 的来源说明仍含英文`).not.toMatch(englishPattern)
      expect(aura.corpus, `${aura.name} 的人物概述仍含英文`).not.toMatch(englishPattern)
      expect(aura.styleDescription, `${aura.name} 的表达描述仍含英文`).not.toMatch(englishPattern)
      expect(aura.behaviorRules, `${aura.name} 的行为规则仍含英文`).not.toMatch(englishPattern)
      expect(aura.boundaries, `${aura.name} 的边界说明仍含英文`).not.toMatch(englishPattern)
      expect(aura.notes, `${aura.name} 的备注仍含英文`).not.toMatch(englishPattern)
      expect(aura.expressionDna ?? "", `${aura.name} 的表达特征仍含英文`).not.toMatch(englishPattern)
      expect(aura.mentalModel ?? "", `${aura.name} 的心智模型仍含英文`).not.toMatch(englishPattern)
      expect(aura.decisionHeuristics ?? "", `${aura.name} 的决策启发仍含英文`).not.toMatch(englishPattern)
      expect(aura.valueAntiPatterns ?? "", `${aura.name} 的反模式仍含英文`).not.toMatch(englishPattern)
      expect(aura.honestyBoundaries ?? "", `${aura.name} 的诚实边界仍含英文`).not.toMatch(englishPattern)
    }
  })

  it("五个核心人物灵魂具备明显差异化特征", () => {
    const focusNames = ["秦始皇", "李世民", "张良", "乔布斯", "芒格"]
    const requiredMarkers: Record<string, string[]> = {
      秦始皇: ["统一", "法度", "标准化"],
      李世民: ["纳谏", "民心", "用人"],
      张良: ["借势", "退路", "退场"],
      乔布斯: ["体验", "极简", "挑剔"],
      芒格: ["反向", "避蠢", "长期主义"],
    }

    const snapshots = new Map<string, { expression: string; model: string; decision: string }>()

    for (const name of focusNames) {
      const aura = BUILT_IN_CHARACTER_AURAS.find((item) => item.name === name)
      expect(aura, `缺少核心人物：${name}`).toBeTruthy()
      expect(aura?.expressionDna, `${name} 缺少表达特征`).toBeTruthy()
      expect(aura?.mentalModel, `${name} 缺少心智模型`).toBeTruthy()
      expect(aura?.decisionHeuristics, `${name} 缺少决策启发式`).toBeTruthy()

      for (const marker of requiredMarkers[name]) {
        const joined = [aura?.corpus, aura?.expressionDna, aura?.mentalModel, aura?.decisionHeuristics, aura?.valueAntiPatterns].join("\n")
        expect(joined, `${name} 缺少专属特征词：${marker}`).toContain(marker)
      }

      snapshots.set(name, {
        expression: aura?.expressionDna ?? "",
        model: aura?.mentalModel ?? "",
        decision: aura?.decisionHeuristics ?? "",
      })
    }

    const qin = snapshots.get("秦始皇")
    const li = snapshots.get("李世民")
    const zhang = snapshots.get("张良")
    const jobs = snapshots.get("乔布斯")
    const munger = snapshots.get("芒格")

    expect(qin?.expression).not.toBe(li?.expression)
    expect(qin?.model).not.toBe(li?.model)
    expect(zhang?.decision).not.toBe(qin?.decision)
    expect(jobs?.expression).not.toBe(munger?.expression)
    expect(jobs?.model).not.toBe(zhang?.model)
  })

  it("五个核心人物灵魂的关键章节不能复用同一套模板段落", () => {
    const focusAuras = ["秦始皇", "李世民", "张良", "乔布斯", "芒格"]
      .map((name) => BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === name))
      .filter(Boolean)

    expect(focusAuras).toHaveLength(5)

    const sectionTexts = {
      步骤一: [] as string[],
      步骤二: [] as string[],
      步骤三: [] as string[],
      时间线: [] as string[],
    }

    for (const aura of focusAuras) {
      const folder = resolve(process.cwd(), aura!.skillFolder ?? "")
      const skillText = readFileSync(resolve(folder, "SKILL.md"), "utf8")

      const stepOne = skillText.match(/### 步骤一：[\s\S]*?(?=### 步骤二：)/)?.[0] ?? ""
      const stepTwo = skillText.match(/### 步骤二：[\s\S]*?(?=### 步骤三：)/)?.[0] ?? ""
      const stepThree = skillText.match(/### 步骤三：[\s\S]*?(?=## 身份卡)/)?.[0] ?? ""
      const timeline = skillText.match(/## 人物时间线[\s\S]*?(?=## 价值观与反模式)/)?.[0] ?? ""

      sectionTexts.步骤一.push(stepOne.trim())
      sectionTexts.步骤二.push(stepTwo.trim())
      sectionTexts.步骤三.push(stepThree.trim())
      sectionTexts.时间线.push(timeline.trim())
    }

    expect(new Set(sectionTexts.步骤一).size, "步骤一仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.步骤二).size, "步骤二仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.步骤三).size, "步骤三仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.时间线).size, "人物时间线仍然是统一模板").toBe(5)
  })

  it("第二批核心人物灵魂具备明显差异化特征", () => {
    const focusNames = ["马斯克", "费曼", "武则天", "诸葛亮", "张一鸣"]
    const requiredMarkers: Record<string, string[]> = {
      马斯克: ["第一性原理", "物理极限", "可重复使用"],
      费曼: ["亲手推导", "不满足于知道名字", "费曼学习法"],
      武则天: ["名分", "制衡", "女帝"],
      诸葛亮: ["鞠躬尽瘁", "隆中对", "北伐"],
      张一鸣: ["信息效率", "延迟满足感", "算法分发"],
    }

    const snapshots = new Map<string, { expression: string; model: string; decision: string }>()

    for (const name of focusNames) {
      const aura = BUILT_IN_CHARACTER_AURAS.find((item) => item.name === name)
      expect(aura, `缺少核心人物：${name}`).toBeTruthy()
      expect(aura?.expressionDna, `${name} 缺少表达特征`).toBeTruthy()
      expect(aura?.mentalModel, `${name} 缺少心智模型`).toBeTruthy()
      expect(aura?.decisionHeuristics, `${name} 缺少决策启发式`).toBeTruthy()

      for (const marker of requiredMarkers[name]) {
        const joined = [aura?.corpus, aura?.expressionDna, aura?.mentalModel, aura?.decisionHeuristics, aura?.valueAntiPatterns].join("\n")
        expect(joined, `${name} 缺少专属特征词：${marker}`).toContain(marker)
      }

      snapshots.set(name, {
        expression: aura?.expressionDna ?? "",
        model: aura?.mentalModel ?? "",
        decision: aura?.decisionHeuristics ?? "",
      })
    }

    const musk = snapshots.get("马斯克")
    const feynman = snapshots.get("费曼")
    const wu = snapshots.get("武则天")
    const zhuge = snapshots.get("诸葛亮")
    const zhang = snapshots.get("张一鸣")

    expect(musk?.expression).not.toBe(feynman?.expression)
    expect(musk?.model).not.toBe(feynman?.model)
    expect(wu?.decision).not.toBe(zhuge?.decision)
    expect(wu?.expression).not.toBe(zhang?.expression)
    expect(feynman?.model).not.toBe(zhuge?.model)
  })

  it("第二批核心人物灵魂的关键章节不能复用同一套模板段落", () => {
    const focusAuras = ["马斯克", "费曼", "武则天", "诸葛亮", "张一鸣"]
      .map((name) => BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === name))
      .filter(Boolean)

    expect(focusAuras).toHaveLength(5)

    const sectionTexts = {
      步骤一: [] as string[],
      步骤二: [] as string[],
      步骤三: [] as string[],
      时间线: [] as string[],
    }

    for (const aura of focusAuras) {
      const folder = resolve(process.cwd(), aura!.skillFolder ?? "")
      const skillText = readFileSync(resolve(folder, "SKILL.md"), "utf8")

      const stepOne = skillText.match(/### 步骤一：[\s\S]*?(?=### 步骤二：)/)?.[0] ?? ""
      const stepTwo = skillText.match(/### 步骤二：[\s\S]*?(?=### 步骤三：)/)?.[0] ?? ""
      const stepThree = skillText.match(/### 步骤三：[\s\S]*?(?=## 身份卡)/)?.[0] ?? ""
      const timeline = skillText.match(/## 人物时间线[\s\S]*?(?=## 价值观与反模式)/)?.[0] ?? ""

      sectionTexts.步骤一.push(stepOne.trim())
      sectionTexts.步骤二.push(stepTwo.trim())
      sectionTexts.步骤三.push(stepThree.trim())
      sectionTexts.时间线.push(timeline.trim())
    }

    expect(new Set(sectionTexts.步骤一).size, "第二批步骤一仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.步骤二).size, "第二批步骤二仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.步骤三).size, "第二批步骤三仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.时间线).size, "第二批人物时间线仍然是统一模板").toBe(5)
  })

  it("第三批核心人物灵魂具备明显差异化特征", () => {
    const focusNames = ["塔勒布", "纳瓦尔", "李斯", "赵高", "张雪峰"]
    const requiredMarkers: Record<string, string[]> = {
      塔勒布: ["反脆弱", "黑天鹅", "尾部风险"],
      纳瓦尔: ["财富杠杆", "复利", "个人主权"],
      李斯: ["法家执行", "仕途焦虑", "制度设计"],
      赵高: ["指鹿为马", "信息操控", "恐惧治理"],
      张雪峰: ["就业导向", "家庭资源", "现实路径"],
    }

    const snapshots = new Map<string, { expression: string; model: string; decision: string }>()

    for (const name of focusNames) {
      const aura = BUILT_IN_CHARACTER_AURAS.find((item) => item.name === name)
      expect(aura, `缺少核心人物：${name}`).toBeTruthy()
      expect(aura?.expressionDna, `${name} 缺少表达特征`).toBeTruthy()
      expect(aura?.mentalModel, `${name} 缺少心智模型`).toBeTruthy()
      expect(aura?.decisionHeuristics, `${name} 缺少决策启发式`).toBeTruthy()

      for (const marker of requiredMarkers[name]) {
        const joined = [aura?.corpus, aura?.expressionDna, aura?.mentalModel, aura?.decisionHeuristics, aura?.valueAntiPatterns].join("\n")
        expect(joined, `${name} 缺少专属特征词：${marker}`).toContain(marker)
      }

      snapshots.set(name, {
        expression: aura?.expressionDna ?? "",
        model: aura?.mentalModel ?? "",
        decision: aura?.decisionHeuristics ?? "",
      })
    }

    const taleb = snapshots.get("塔勒布")
    const naval = snapshots.get("纳瓦尔")
    const lisi = snapshots.get("李斯")
    const zhaogao = snapshots.get("赵高")
    const zhangxuefeng = snapshots.get("张雪峰")

    expect(taleb?.expression).not.toBe(naval?.expression)
    expect(taleb?.model).not.toBe(naval?.model)
    expect(lisi?.decision).not.toBe(zhaogao?.decision)
    expect(lisi?.expression).not.toBe(zhangxuefeng?.expression)
    expect(zhaogao?.model).not.toBe(zhangxuefeng?.model)
  })

  it("第四批子批次A（地面烟火）人物灵魂具备明显差异化特征", () => {
    const focusNames = ["吕树", "鲁迅", "萧峰", "曹操", "范闲", "李白"]
    const requiredMarkers: Record<string, string[]> = {
      吕树: ["吐槽", "薅羊毛", "系统"],
      鲁迅: ["横眉冷对", "精神胜利法", "铁屋子"],
      萧峰: ["降龙十八掌", "义字当先", "塞外牛羊"],
      曹操: ["宁可我负天下人", "求贤若渴", "青梅煮酒"],
      范闲: ["穿越", "庆余年", "人间清醒"],
      李白: ["仰天大笑", "斗酒", "谪仙人"],
    }

    const snapshots = new Map<string, { expression: string; model: string; decision: string }>()

    for (const name of focusNames) {
      const aura = BUILT_IN_CHARACTER_AURAS.find((item) => item.name === name)
      expect(aura, `缺少核心人物：${name}`).toBeTruthy()
      expect(aura?.expressionDna, `${name} 缺少表达特征`).toBeTruthy()
      expect(aura?.mentalModel, `${name} 缺少心智模型`).toBeTruthy()
      expect(aura?.decisionHeuristics, `${name} 缺少决策启发式`).toBeTruthy()

      for (const marker of requiredMarkers[name]) {
        const joined = [aura?.corpus, aura?.expressionDna, aura?.mentalModel, aura?.decisionHeuristics, aura?.valueAntiPatterns].join("\n")
        expect(joined, `${name} 缺少专属特征词：${marker}`).toContain(marker)
      }

      snapshots.set(name, {
        expression: aura?.expressionDna ?? "",
        model: aura?.mentalModel ?? "",
        decision: aura?.decisionHeuristics ?? "",
      })
    }

    const lv = snapshots.get("吕树")
    const lu = snapshots.get("鲁迅")
    const xf = snapshots.get("萧峰")
    const cc = snapshots.get("曹操")
    const fx = snapshots.get("范闲")
    const lb = snapshots.get("李白")

    expect(lv?.expression).not.toBe(lu?.expression)
    expect(lv?.model).not.toBe(cc?.model)
    expect(xf?.decision).not.toBe(cc?.decision)
    expect(fx?.expression).not.toBe(lb?.expression)
    expect(lu?.model).not.toBe(lb?.model)
  })

  it("第四批子批次B（精神殿堂）人物灵魂具备明显差异化特征", () => {
    const focusNames = ["庄子", "王阳明", "哪吒", "二郎神", "孙悟空"]
    const requiredMarkers: Record<string, string[]> = {
      庄子: ["逍遥游", "齐物论", "蝴蝶梦"],
      王阳明: ["知行合一", "致良知", "心中贼"],
      哪吒: ["我命由我不由天", "混天绫", "莲花化身"],
      二郎神: ["听调不听宣", "八九玄功", "灌江口"],
      孙悟空: ["大闹天宫", "七十二变", "齐天大圣"],
    }

    const snapshots = new Map<string, { expression: string; model: string; decision: string }>()

    for (const name of focusNames) {
      const aura = BUILT_IN_CHARACTER_AURAS.find((item) => item.name === name)
      expect(aura, `缺少核心人物：${name}`).toBeTruthy()
      expect(aura?.expressionDna, `${name} 缺少表达特征`).toBeTruthy()
      expect(aura?.mentalModel, `${name} 缺少心智模型`).toBeTruthy()
      expect(aura?.decisionHeuristics, `${name} 缺少决策启发式`).toBeTruthy()

      for (const marker of requiredMarkers[name]) {
        const joined = [aura?.corpus, aura?.expressionDna, aura?.mentalModel, aura?.decisionHeuristics, aura?.valueAntiPatterns].join("\n")
        expect(joined, `${name} 缺少专属特征词：${marker}`).toContain(marker)
      }

      snapshots.set(name, {
        expression: aura?.expressionDna ?? "",
        model: aura?.mentalModel ?? "",
        decision: aura?.decisionHeuristics ?? "",
      })
    }

    const zz = snapshots.get("庄子")
    const wym = snapshots.get("王阳明")
    const nz = snapshots.get("哪吒")
    const els = snapshots.get("二郎神")
    const swk = snapshots.get("孙悟空")

    expect(zz?.expression).not.toBe(wym?.expression)
    expect(nz?.model).not.toBe(els?.model)
    expect(swk?.decision).not.toBe(zz?.decision)
    expect(nz?.expression).not.toBe(swk?.expression)
    expect(els?.model).not.toBe(wym?.model)
  })

  it("第四批子批次C（众生相）人物灵魂具备明显差异化特征", () => {
    const focusNames = ["苏轼", "韩非", "张小凡", "陈平安", "王熙凤"]
    const requiredMarkers: Record<string, string[]> = {
      苏轼: ["一蓑烟雨", "赤壁", "东坡肉"],
      韩非: ["法不阿贵", "术以知奸", "五蠹"],
      张小凡: ["诛仙", "天地不仁", "草庙村"],
      陈平安: ["赔钱货", "剑来", "道理人情"],
      王熙凤: ["机关算尽", "嘴甜心苦", "凤辣子"],
    }

    const snapshots = new Map<string, { expression: string; model: string; decision: string }>()

    for (const name of focusNames) {
      const aura = BUILT_IN_CHARACTER_AURAS.find((item) => item.name === name)
      expect(aura, `缺少核心人物：${name}`).toBeTruthy()
      expect(aura?.expressionDna, `${name} 缺少表达特征`).toBeTruthy()
      expect(aura?.mentalModel, `${name} 缺少心智模型`).toBeTruthy()
      expect(aura?.decisionHeuristics, `${name} 缺少决策启发式`).toBeTruthy()

      for (const marker of requiredMarkers[name]) {
        const joined = [aura?.corpus, aura?.expressionDna, aura?.mentalModel, aura?.decisionHeuristics, aura?.valueAntiPatterns].join("\n")
        expect(joined, `${name} 缺少专属特征词：${marker}`).toContain(marker)
      }

      snapshots.set(name, {
        expression: aura?.expressionDna ?? "",
        model: aura?.mentalModel ?? "",
        decision: aura?.decisionHeuristics ?? "",
      })
    }

    const ss = snapshots.get("苏轼")
    const hf = snapshots.get("韩非")
    const zxf = snapshots.get("张小凡")
    const cpa = snapshots.get("陈平安")
    const wxf = snapshots.get("王熙凤")

    expect(ss?.expression).not.toBe(hf?.expression)
    expect(wxf?.model).not.toBe(cpa?.model)
    expect(zxf?.decision).not.toBe(ss?.decision)
    expect(hf?.expression).not.toBe(wxf?.expression)
    expect(cpa?.model).not.toBe(zxf?.model)
  })

  it("第四批核心人物灵魂的关键章节不能复用同一套模板段落", () => {
    const focusAuras = [
      "吕树", "鲁迅", "萧峰", "曹操", "范闲", "李白",
      "庄子", "王阳明", "哪吒", "二郎神", "孙悟空",
      "苏轼", "韩非", "张小凡", "陈平安", "王熙凤",
    ]
      .map((name) => BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === name))
      .filter(Boolean)

    expect(focusAuras).toHaveLength(16)

    const sectionTexts = {
      步骤一: [] as string[],
      步骤二: [] as string[],
      步骤三: [] as string[],
      时间线: [] as string[],
    }

    for (const aura of focusAuras) {
      const folder = resolve(process.cwd(), aura!.skillFolder ?? "")
      const skillText = readFileSync(resolve(folder, "SKILL.md"), "utf8")

      const stepOne = skillText.match(/### 步骤一：[\s\S]*?(?=### 步骤二：)/)?.[0] ?? ""
      const stepTwo = skillText.match(/### 步骤二：[\s\S]*?(?=### 步骤三：)/)?.[0] ?? ""
      const stepThree = skillText.match(/### 步骤三：[\s\S]*?(?=## 身份卡)/)?.[0] ?? ""
      const timeline = skillText.match(/## 人物时间线[\s\S]*?(?=## 价值观与反模式)/)?.[0] ?? ""

      sectionTexts.步骤一.push(stepOne.trim())
      sectionTexts.步骤二.push(stepTwo.trim())
      sectionTexts.步骤三.push(stepThree.trim())
      sectionTexts.时间线.push(timeline.trim())
    }

    expect(new Set(sectionTexts.步骤一).size, "第四批步骤一仍然是统一模板").toBe(16)
    expect(new Set(sectionTexts.步骤二).size, "第四批步骤二仍然是统一模板").toBe(16)
    expect(new Set(sectionTexts.步骤三).size, "第四批步骤三仍然是统一模板").toBe(16)
    expect(new Set(sectionTexts.时间线).size, "第四批人物时间线仍然是统一模板").toBe(16)
  })

  it("第三批核心人物灵魂的关键章节不能复用同一套模板段落", () => {
    const focusAuras = ["塔勒布", "纳瓦尔", "李斯", "赵高", "张雪峰"]
      .map((name) => BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === name))
      .filter(Boolean)

    expect(focusAuras).toHaveLength(5)

    const sectionTexts = {
      步骤一: [] as string[],
      步骤二: [] as string[],
      步骤三: [] as string[],
      时间线: [] as string[],
    }

    for (const aura of focusAuras) {
      const folder = resolve(process.cwd(), aura!.skillFolder ?? "")
      const skillText = readFileSync(resolve(folder, "SKILL.md"), "utf8")

      const stepOne = skillText.match(/### 步骤一：[\s\S]*?(?=### 步骤二：)/)?.[0] ?? ""
      const stepTwo = skillText.match(/### 步骤二：[\s\S]*?(?=### 步骤三：)/)?.[0] ?? ""
      const stepThree = skillText.match(/### 步骤三：[\s\S]*?(?=## 身份卡)/)?.[0] ?? ""
      const timeline = skillText.match(/## 人物时间线[\s\S]*?(?=## 价值观与反模式)/)?.[0] ?? ""

      sectionTexts.步骤一.push(stepOne.trim())
      sectionTexts.步骤二.push(stepTwo.trim())
      sectionTexts.步骤三.push(stepThree.trim())
      sectionTexts.时间线.push(timeline.trim())
    }

    expect(new Set(sectionTexts.步骤一).size, "第三批步骤一仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.步骤二).size, "第三批步骤二仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.步骤三).size, "第三批步骤三仍然是统一模板").toBe(5)
    expect(new Set(sectionTexts.时间线).size, "第三批人物时间线仍然是统一模板").toBe(5)
  })

  it("读取内置人物灵魂文件夹中的 SKILL.md 文档", async () => {
    const qin = BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === "秦始皇")
    expect(qin).toBeTruthy()
    mockReadFile.mockResolvedValue("# 秦始皇 · 角色灵魂操作系统\n\n## 角色扮演规则\n\n## 研究文件索引")

    const document = await loadCharacterAuraSkillDocument(qin!)

    expect(mockReadFile).toHaveBeenCalledWith("NvwaSKILL/examples/qin-shihuang-perspective/SKILL.md")
    expect(document).toContain("# 秦始皇 · 角色灵魂操作系统")
    expect(document).toContain("## 角色扮演规则")
    expect(document).toContain("## 研究文件索引")
  })

  it("读取内置人物灵魂文件夹中的研究文件", async () => {
    const qin = BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === "秦始皇")
    expect(qin).toBeTruthy()
    expect(CHARACTER_AURA_RESEARCH_FILES.map((file) => file.fileName)).toEqual(["01-writings.md", "02-conversations.md", "03-expression-dna.md", "04-external-views.md", "05-decisions.md", "06-timeline.md"])
    mockReadFile.mockResolvedValue("# 秦始皇 - 著作、史料与系统思考")

    const document = await loadCharacterAuraResearchDocument(qin!, "01-writings.md")

    expect(mockReadFile).toHaveBeenCalledWith("NvwaSKILL/examples/qin-shihuang-perspective/references/research/01-writings.md")
    expect(document).toContain("秦始皇")
  })

  it("读取灵魂文档时相对路径失败会尝试工作区绝对路径", async () => {
    const liSi = BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === "李斯")
    expect(liSi).toBeTruthy()
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "NvwaSKILL/examples/li-si-perspective/SKILL.md") throw new Error("relative path failed")
      if (filePath.endsWith("/NvwaSKILL/examples/li-si-perspective/SKILL.md") || filePath.endsWith("\\NvwaSKILL\\examples\\li-si-perspective\\SKILL.md")) return "# 李斯 · 角色灵魂操作系统"
      throw new Error("missing")
    })

    const document = await loadCharacterAuraSkillDocument(liSi!)

    expect(document).toContain("李斯")
    expect(mockReadFile).toHaveBeenCalledWith("NvwaSKILL/examples/li-si-perspective/SKILL.md")
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining("NvwaSKILL"))
  })

  it("浏览器侧读取灵魂文档时会使用传入项目路径补全内置文件绝对路径", async () => {
    const qin = BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === "秦始皇")
    expect(qin).toBeTruthy()
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "NvwaSKILL/examples/qin-shihuang-perspective/SKILL.md") throw new Error("relative path failed")
      if (filePath === "/workspace/NvwaSKILL/examples/qin-shihuang-perspective/SKILL.md") return "# 秦始皇 · 角色灵魂操作系统"
      throw new Error(`unexpected read: ${filePath}`)
    })

    const document = await loadCharacterAuraSkillDocument(qin!, "/workspace")

    expect(document).toContain("秦始皇")
    expect(mockReadFile).toHaveBeenCalledWith("NvwaSKILL/examples/qin-shihuang-perspective/SKILL.md")
    expect(mockReadFile).toHaveBeenCalledWith("/workspace/NvwaSKILL/examples/qin-shihuang-perspective/SKILL.md")
  })

  it("浏览器侧读取研究文件时会使用传入项目路径补全内置 Skill 绝对路径", async () => {
    const qin = BUILT_IN_CHARACTER_AURAS.find((aura) => aura.name === "秦始皇")
    expect(qin).toBeTruthy()
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "NvwaSKILL/examples/qin-shihuang-perspective/references/research/01-writings.md") throw new Error("relative path failed")
      if (filePath === "/workspace/NvwaSKILL/examples/qin-shihuang-perspective/references/research/01-writings.md") return "# 秦始皇 - 著作、史料与系统思考"
      throw new Error(`unexpected read: ${filePath}`)
    })

    const document = await loadCharacterAuraResearchDocument(qin!, "01-writings.md", "/workspace")

    expect(document).toContain("秦始皇")
    expect(mockReadFile).toHaveBeenCalledWith("NvwaSKILL/examples/qin-shihuang-perspective/references/research/01-writings.md")
    expect(mockReadFile).toHaveBeenCalledWith("/workspace/NvwaSKILL/examples/qin-shihuang-perspective/references/research/01-writings.md")
  })

  it("本地生成自定义灵魂文档目录和六个研究文件", async () => {
    useWikiStore.setState({
      llmConfig: {
        provider: "openai",
        apiKey: "",
        model: "",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "",
        maxContextSize: 204800,
      },
    })
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "/project/.qmai/character-aura.json") throw new Error("missing")
      if (filePath === "E:/资料/角色分析.md") return "本地文档正文：角色从低谷重新崛起，重视师徒关系和伙伴承诺。"
      if (filePath === "E:/资料/对话摘录.txt") return "本地对话摘录：语气倔强，面对压迫时先忍耐观察，再寻找反击时机。"
      if (filePath === "E:/资料/缺失资料.md") throw new Error("file missing")
      throw new Error("unexpected read")
    })
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockCreateDirectory.mockResolvedValue(undefined)
    mockStreamChat.mockReset()
    mockGetHttpFetch.mockResolvedValue((async (url: string) => {
      if (url === "https://example.com/role-analysis") {
        return new Response("<article>网页分析：少年在低谷后反扑，格外重视尊严与承诺。</article>", { status: 200 })
      }
      if (url === "https://example.com/dialogue") {
        return new Response("<article>网页对话：说话不绕弯，受压时先忍住，再找机会翻盘。</article>", { status: 200 })
      }
      return new Response("missing", { status: 404 })
    }) as typeof fetch)

    const progressLog: string[] = []

    const created = await createCustomCharacterAuraSkill("/project", {
      name: "萧炎式少年",
      category: "小说角色",
      corpus: "少年从低谷反弹，重情义，遇强不退。",
      sourceUrls: "https://example.com/role-analysis\nhttps://example.com/dialogue",
      localDocumentPaths: "E:/资料/角色分析.md\nE:/资料/对话摘录.txt\nE:/资料/缺失资料.md",
      generationPrompt: "强化少年在逆境中的倔强、义气和反击欲",
    }, {
      onProgress: (progress) => {
        progressLog.push(`${progress.step}/${progress.total}:${progress.stage}`)
      },
    })

    expect(created.builtIn).toBe(false)
    expect(created.skillFolder).toContain("/project/.qmai/character-auras/custom-")
    expect(created.sourceNote).toContain("基于用户资料整理出的自定义人物灵魂")
    expect(created.styleDescription).toContain("这个灵魂围绕「萧炎式少年」构建")
    expect(created.behaviorRules).toContain("写作行为规则")
    expect(created.boundaries).toContain("不照抄未授权文本")
    expect(created.notes).toContain("补充说明")
    expect(created.expressionDna).toContain("表达特征")
    expect(created.mentalModel).toContain("心智模型")
    expect(created.generationPrompt).toBe("强化少年在逆境中的倔强、义气和反击欲")
    expect(created.webSearchEnabled).toBe(false)
    expect(progressLog).toHaveLength(10)
    expect(progressLog[0]).toContain("准备资料")
    expect(progressLog[progressLog.length - 1]).toContain("保存结果")
    expect(mockCreateDirectory).toHaveBeenCalledWith(expect.stringContaining("/project/.qmai/character-auras/custom-"))
    expect(mockCreateDirectory).toHaveBeenCalledWith(expect.stringContaining("/references/research"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("萧炎式少年 · 自定义人物灵魂操作系统"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("## 生成工作流"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("强化少年在逆境中的倔强、义气和反击欲"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("## 工作流产出摘要"))
    for (const file of CHARACTER_AURA_RESEARCH_FILES) {
      expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining(`/references/research/${file.fileName}`), expect.any(String))
    }
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("https://example.com/dialogue"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("E:/资料/对话摘录.txt"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("本地文档正文：角色从低谷重新崛起"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("本地对话摘录：语气倔强"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("## 本地文档读取失败"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("E:/资料/缺失资料.md：读取失败"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("网页分析：少年在低谷后反扑"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("## AI 搜索网页正文"))
    expect(mockStreamChat).not.toHaveBeenCalled()
    expect(mockWriteFileAtomic).toHaveBeenCalledWith("/project/.qmai/character-aura.json", expect.stringContaining("萧炎式少年"))
  })

  it("生成自定义灵魂时会导入网页正文并记录失败网页", async () => {
    useWikiStore.setState({
      llmConfig: {
        provider: "openai",
        apiKey: "",
        model: "",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "",
        maxContextSize: 204800,
      },
    })
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "/project/.qmai/character-aura.json") throw new Error("missing")
      throw new Error(`unexpected read: ${filePath}`)
    })
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockCreateDirectory.mockResolvedValue(undefined)
    mockGetHttpFetch.mockResolvedValue((async (url: string) => {
      if (url === "https://example.com/ok") {
        return new Response("<html><head><title>无关</title><script>bad()</script></head><body><article><h1>人物访谈</h1><p>抓取到的网页正文：说话锋利，强调现实路径。</p></article></body></html>", { status: 200 })
      }
      return new Response("missing", { status: 404 })
    }) as typeof fetch)

    const created = await createCustomCharacterAuraSkill("/project", {
      name: "网页资料人物",
      category: "公开人物",
      corpus: "基础资料。",
      sourceUrls: "https://example.com/ok\nhttps://example.com/missing",
    })

    expect(created.sourceNote).toContain("基于用户资料整理出的自定义人物灵魂")
    expect(mockGetHttpFetch).toHaveBeenCalled()
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("## 网页资料正文"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("抓取到的网页正文：说话锋利"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("## 网页资料读取失败"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("https://example.com/missing：读取失败"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("https://example.com/ok"))
  })

  it("生成自定义灵魂时会按 6 步工作流调用模型并汇总字段", async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "/project/.qmai/character-aura.json") throw new Error("missing")
      throw new Error(`unexpected read: ${filePath}`)
    })
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockCreateDirectory.mockResolvedValue(undefined)
    mockGetHttpFetch.mockResolvedValue((async () => new Response("网页正文", { status: 200 })) as typeof fetch)
    useWikiStore.setState({
      llmConfig: {
        provider: "custom",
        apiKey: "",
        model: "distill-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "http://localhost:1234/v1/chat/completions",
        maxContextSize: 204800,
      },
    })
    let stageCall = 0
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      stageCall += 1
      if (stageCall <= 6) {
        const stageBodies = [
          "# 模型人物 - 公开资料\n\n## 核心结论\n- 模型生成的公开资料。\n\n## 证据线索\n- 网页正文。\n\n## 可写入小说的细节\n- 角色公开形象偏强势。\n\n## 未确认点\n- 仍需补充更多传记样本。",
          "# 模型人物 - 对话方式\n\n## 说话节奏\n- 短句、直接。\n\n## 常用表达策略\n- 先结论再理由。\n\n## 冲突中的说话方式\n- 会压缩情绪表达。\n\n## 示例句式\n- 先做，再解释。",
          "# 模型人物 - 表达特征\n\n## 词汇偏好\n- 模型生成的表达特征。\n\n## 情绪显影\n- 情绪通过停顿显现。\n\n## 叙事镜头感\n- 镜头喜欢落在动作细节。\n\n## 表达禁区\n- 避免无端抒情。",
          "# 模型人物 - 外部评价\n\n## 支持者视角\n- 被认为执行力强。\n\n## 对手视角\n- 被认为压迫感重。\n\n## 旁观者视角\n- 出场自带压场感。\n\n## 争议点\n- 手段与代价常被质疑。",
          "# 模型人物 - 决策记录\n\n## 核心优先级\n- 结果优先。\n\n## 高压下的选择\n- 会先稳住局面。\n\n## 典型取舍\n- 为长线目标牺牲短期舒适。\n\n## 失败代价\n- 不能失去控制权。",
          "# 模型人物 - 时间线\n\n## 起点\n- 从弱势处境起步。\n\n## 关键转折\n- 因重大冲突获得成长。\n\n## 关系变化\n- 与旧同伴关系反复拉扯。\n\n## 未来可延展线索\n- 尚有未兑现的承诺。",
        ]
        callbacks.onToken(stageBodies[stageCall - 1])
      } else {
        callbacks.onToken(JSON.stringify({
          sourceNote: "模型蒸馏来源说明",
          styleDescription: "模型生成的风格描述",
          behaviorRules: "模型生成的行为规则",
          boundaries: "模型生成的安全边界",
          notes: "模型生成的备注",
          expressionDna: "模型生成的表达特征",
          mentalModel: "模型生成的心智模型",
          decisionHeuristics: "模型生成的决策启发式",
          valueAntiPatterns: "模型生成的价值观反模式",
          honestyBoundaries: "模型生成的诚实边界",
        }))
      }
      callbacks.onDone()
    })

    const created = await createCustomCharacterAuraSkill("/project", {
      name: "模型人物",
      corpus: "用户资料。",
      sourceUrls: "https://example.com/model",
    })

    expect(created.sourceNote).toBe("模型蒸馏来源说明")
    expect(created.expressionDna).toBe("模型生成的表达特征")
    expect(mockStreamChat).toHaveBeenCalledTimes(7)
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("模型蒸馏来源说明"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("## 工作流产出摘要"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/03-expression-dna.md"), expect.stringContaining("模型生成的表达特征"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/06-timeline.md"), expect.stringContaining("未来可延展线索"))
  })

  it("灵魂汇总失败时会降级为结构化总结并写入降级说明", async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === "/project/.qmai/character-aura.json") throw new Error("missing")
      throw new Error(`unexpected read: ${filePath}`)
    })
    mockWriteFileAtomic.mockResolvedValue(undefined)
    mockCreateDirectory.mockResolvedValue(undefined)
    mockGetHttpFetch.mockResolvedValue((async () => new Response("网页正文", { status: 200 })) as typeof fetch)
    useWikiStore.setState({
      llmConfig: {
        provider: "custom",
        apiKey: "",
        model: "distill-model",
        ollamaUrl: "http://localhost:11434",
        customEndpoint: "http://localhost:1234/v1/chat/completions",
        maxContextSize: 204800,
      },
    })
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("不是 JSON")
      callbacks.onDone()
    })

    const created = await createCustomCharacterAuraSkill("/project", {
      name: "降级人物",
      corpus: "用户资料。",
      sourceUrls: "https://example.com/fallback",
    })

    expect(created.sourceNote).toContain("基于用户资料整理出的自定义人物灵魂")
    expect(created.sourceNote).toContain("灵魂汇总失败")
    expect(created.notes).toContain("补充说明")
    expect(mockStreamChat).toHaveBeenCalledTimes(7)
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/SKILL.md"), expect.stringContaining("灵魂汇总失败"))
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(expect.stringContaining("/references/research/01-writings.md"), expect.stringContaining("不是 JSON"))
  })

  it("构建上下文摘要时注入灵魂文档与研究文件压缩摘要", async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith("character-aura.json")) return JSON.stringify({ customAuras: [], bindings: [{ characterName: "嬴政", auraId: "builtin-qin-shihuang" }] })
      if (filePath.endsWith("SKILL.md")) return "# 秦始皇 · 角色灵魂操作系统\n\n## 角色扮演规则\n只能作为小说灵魂。\n\n## 核心心智模型\n大一统秩序模型：先消除多头规则，再建立可复制制度。\n\n## 决策启发式\n先收权，再定法，最后标准化执行。\n\n这是一段不应该完整进入上下文的长篇全文内容".repeat(20)
      if (filePath.endsWith("01-writings.md")) return "# 秦始皇 - 著作、史料与系统思考\n\n## 核心论点体系\n- 统一制度\n- 标准化治理\n\n不应该完整进入上下文的研究文件长篇内容".repeat(20)
      if (filePath.includes("references/research")) return "# 其他研究文件\n\n- 辅助摘要"
      throw new Error("missing")
    })

    const context = await buildCharacterAuraContext("/project", "嬴政登场")

    expect(context).toContain("灵魂文档压缩摘要")
    expect(context).toContain("研究文件压缩摘要")
    expect(context).toContain("秦始皇 · 角色灵魂操作系统")
    expect(context).toContain("统一制度")
    expect(context.length).toBeLessThan(4000)
    expect(context).not.toContain("不应该完整进入上下文的长篇全文内容不应该完整进入上下文")
    expect(context).not.toContain("不应该完整进入上下文的研究文件长篇内容不应该完整进入上下文")
  })

  it("非结构化 Skill 段落也会进入上下文压缩摘要", async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith("character-aura.json")) return JSON.stringify({ customAuras: [], bindings: [{ characterName: "嬴政", auraId: "builtin-qin-shihuang" }] })
      if (filePath.endsWith("SKILL.md")) return "秦始皇式灵魂强调先建立统一尺度，再压缩地方割裂带来的执行噪音。面对混乱场景时，角色会优先追问规则是否统一、命令是否能抵达基层、制度是否能被后人复制。"
      if (filePath.includes("references/research")) return "研究材料显示这种灵魂适合塑造强控制、重制度、追求长期秩序的角色，但不能把强权写成没有代价的万能答案。"
      throw new Error("missing")
    })

    const context = await buildCharacterAuraContext("/project", "嬴政登场")

    expect(context).toContain("灵魂文档压缩摘要")
    expect(context).toContain("秦始皇式灵魂强调先建立统一尺度")
    expect(context).toContain("研究文件压缩摘要")
    expect(context).toContain("研究材料显示这种灵魂适合塑造强控制")
  })

  it("灵魂文档读取失败时上下文明确提示已降级使用结构化字段", async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith("character-aura.json")) return JSON.stringify({ customAuras: [], bindings: [{ characterName: "嬴政", auraId: "builtin-qin-shihuang" }] })
      throw new Error("missing skill file")
    })

    const context = await buildCharacterAuraContext("/project", "嬴政登场")

    expect(context).toContain("灵魂文档读取失败，已降级使用结构化灵魂字段")
    expect(context).toContain("怎么说话 / 表达特征")
    expect(context).toContain("知道局限 / 诚实边界")
  })

  it("构建上下文摘要时读取结构化字段且不注入完整长篇内容", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ customAuras: [], bindings: [{ characterName: "林烬", auraId: "builtin-qin-shihuang" }] }))

    const context = await buildCharacterAuraContext("/project", "写林烬以秦始皇式魄力处理诸侯割据")

    expect(context).toContain("人物分类")
    expect(context).toContain("怎么说话")
    expect(context).toContain("怎么想")
    expect(context).toContain("怎么判断")
    expect(context).toContain("什么不做")
    expect(context).toContain("知道局限")
    expect(context).toContain("表达特征")
    expect(context).toContain("心智模型")
    expect(context).toContain("决策启发式")
    expect(context).toContain("价值观反模式")
    expect(context).toContain("诚实边界")
    expect(context).toContain("灵魂必须服从大纲、人物小传、角色认知和正史规则")
    expect(context.length).toBeLessThan(1400)
  })
  it("preview fallback matches the current bound aura without requiring the task to include the character name", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ customAuras: [], bindings: [{ characterName: "杨墨", auraId: "builtin-qin-shihuang" }] }))

    const context = await buildCharacterAuraContext("/project", "分析出当前角色", {
      fallbackAuraId: "builtin-qin-shihuang",
      previewMode: "writing",
    })

    expect(context).toContain("杨墨")
    expect(context).toContain("本次写作会怎样塑造")
    expect(context).toContain("会体现哪些风格影响")
    expect(context).toContain("只借用这类灵魂的气质、语气、判断方式和表达倾向")
    expect(context).not.toContain("秦始皇式特征")
    expect(context).not.toContain("统一度量")
    expect(context).not.toContain("统一制度")
    expect(context).not.toContain("标准化治理")
    expect(context).toContain("示例写法")
  })
})

describe("context-engine character aura", () => {
  it("从共享 Wiki、图谱链路、最近章节和索引只读生成上下文包", async () => {
    const chapter2: ChapterSnapshot = {
      chapterId: "chapter-2",
      chapterNumber: 2,
      summary: "林烬在密林中发现黑玉令会回应竹哨声。",
      characters: ["林烬"],
      locations: ["密林"],
      organizations: [],
      items: ["黑玉令"],
      events: ["竹哨回应"],
      characterStateChanges: ["林烬：持有黑玉令且怀疑师兄未死"],
      relationshipChanges: [],
      knowledgeChanges: ["林烬不知道黑玉令真正来源"],
      foreshadowingChanges: ["新增伏笔：竹哨声 - 会引来非人的存在"],
      newCanonFacts: [],
      timelineEvents: ["第2章夜里：黑玉令第一次回应竹哨声"],
      conflicts: [],
      endingHook: "竹哨声从山谷另一端回应。",
      graphNodes: ["林烬:character", "黑玉令:item"],
      graphEdges: ["竹哨声->CAUSES->黑玉令回应", "竹哨声->ADVANCES_FORESHADOWING->非人存在"],
    }
    const chapter3: ChapterSnapshot = {
      ...chapter2,
      chapterId: "chapter-3",
      chapterNumber: 3,
      summary: "林烬追查师兄留下的线索。",
      endingHook: "师兄的旧印记出现在石门上。",
    }

    mockListDirectory.mockResolvedValue([])
    mockListSnapshots.mockResolvedValue([2, 3])
    mockLoadSnapshot.mockImplementation(async (_projectPath, chapterNumber) => {
      if (chapterNumber === 2) return chapter2
      if (chapterNumber === 3) return chapter3
      return null
    })
    mockSearchWiki.mockImplementation(async (_projectPath, query) => {
      if (query.includes("type:entity") && query.includes("character")) {
        return [{ path: "/project/wiki/entities/林烬.md", title: "林烬", snippet: "", score: 1, titleMatch: true, images: [] }]
      }
      if (query.includes("伏笔")) {
        return [{ path: "/project/wiki/memory/foreshadowing-tracker.md", title: "伏笔追踪记忆", snippet: "竹哨声", score: 1, titleMatch: true, images: [] }]
      }
      if (query.includes("timeline") || query.includes("时间线")) {
        return [{ path: "/project/wiki/memory/timeline.md", title: "时间线", snippet: "", score: 1, titleMatch: true, images: [] }]
      }
      if (query.includes("canon") || query.includes("正史")) {
        return [{ path: "/project/wiki/canon.md", title: "正史规则", snippet: "", score: 1, titleMatch: true, images: [] }]
      }
      if (query.includes("第4章") || query.includes("林烬")) {
        return [{ path: "/project/wiki/indexes/keyword.md", title: "关键词索引", snippet: "黑玉令 与 竹哨声 反复关联", score: 1, titleMatch: true, images: [] }]
      }
      return []
    })
    mockReadFile.mockImplementation(async (filePath) => {
      if (filePath.endsWith("林烬.md")) return "# 林烬\n\n当前状态：持有黑玉令，怀疑师兄未死。\n\n[[竹哨声]] [[黑玉令]]"
      if (filePath.endsWith("foreshadowing-tracker.md")) return "# 伏笔追踪记忆\n\n新增伏笔：竹哨声 - 会引来非人的存在。"
      if (filePath.endsWith("timeline.md")) return "# 时间线\n\n第2章夜里：黑玉令第一次回应竹哨声。"
      if (filePath.endsWith("canon.md")) return "正史规则：黑玉令不能主动复活死人。"
      if (filePath.endsWith("keyword.md")) return "# 关键词索引\n\n黑玉令 与 竹哨声 反复关联。"
      if (filePath.endsWith("black-jade.md")) return "# 黑玉令\n\n因果链：竹哨声导致黑玉令回应。"
      if (filePath.endsWith("foreshadow.md")) return "# 非人存在伏笔\n\n伏笔链路：竹哨声推进非人存在登场。"
      if (filePath.endsWith("vector-memory.md")) return "# 向量记忆\n\n林烬曾在第2章听见竹哨声。"
      throw new Error(`unexpected read: ${filePath}`)
    })
    mockBuildRetrievalGraph.mockResolvedValue({
      dataVersion: 0,
      nodes: new Map([
        ["竹哨声", { id: "竹哨声", title: "竹哨声", type: "foreshadowing", path: "/project/wiki/entities/foreshadow.md", sources: [], outLinks: new Set(), inLinks: new Set() }],
        ["black-jade", { id: "black-jade", title: "黑玉令", type: "item", path: "/project/wiki/entities/black-jade.md", sources: [], outLinks: new Set(), inLinks: new Set() }],
      ]),
    })
    mockGetRelatedNodes.mockImplementation((nodeId) => {
      if (nodeId === "竹哨声") {
        return [
          { node: { id: "black-jade", title: "黑玉令", type: "item", path: "/project/wiki/entities/black-jade.md", sources: [], outLinks: new Set(), inLinks: new Set() }, relevance: 4.2 },
          { node: { id: "foreshadow", title: "非人存在伏笔", type: "foreshadowing", path: "/project/wiki/entities/foreshadow.md", sources: [], outLinks: new Set(), inLinks: new Set() }, relevance: 3.8 },
        ]
      }
      return []
    })
    useWikiStore.setState({
      embeddingConfig: {
        enabled: true,
        endpoint: "http://localhost:11434/api/embeddings",
        apiKey: "",
        model: "nomic-embed-text",
      },
    })
    mockSearchByEmbedding.mockResolvedValue([{ id: "vector-memory", score: 0.91 }])

    const pack = await buildContextPack("/project", "写第4章，林烬继续追查竹哨声和黑玉令", 4)

    expect(pack.recentSummaries).toEqual([
      "第2章：林烬在密林中发现黑玉令会回应竹哨声。",
      "第3章：林烬追查师兄留下的线索。",
    ])
    expect(pack.previousChapterEnding).toContain("师兄的旧印记")
    expect(pack.characterStates).toContain("当前状态：持有黑玉令")
    expect(pack.foreshadowingStates).toContain("新增伏笔：竹哨声")
    expect(pack.timeline).toContain("第2章夜里：黑玉令第一次回应竹哨声")
    expect(pack.canonRules).toContain("黑玉令不能主动复活死人")
    expect(pack.searchResults).toContain("关键词索引")
    expect(pack.searchResults).toContain("向量记忆")
    expect(pack.graphSearchResults).toContain("黑玉令")
    expect(pack.graphSearchResults).toContain("因果链：竹哨声导致黑玉令回应")
    expect(pack.graphSearchResults).toContain("伏笔链路：竹哨声推进非人存在登场")
    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockWriteFileAtomic).not.toHaveBeenCalled()
    expect(mockCreateDirectory).not.toHaveBeenCalled()
  })

  it("构建上下文包时注入已绑定角色灵魂且不覆盖硬性规则", async () => {
    mockListDirectory.mockResolvedValue([])
    mockSearchWiki.mockImplementation(async (_projectPath, query) => {
      if (query.includes("canon") && query.includes("正史") && query.includes("rule") && query.includes("规则")) {
        return [{ path: "/project/wiki/canon.md", title: "正史规则", snippet: "", score: 1, titleMatch: true, images: [] }]
      }
      return []
    })
    mockReadFile.mockImplementation(async (path) => {
      if (path.endsWith("character-aura.json")) {
        return JSON.stringify({ customAuras: [], bindings: [{ characterName: "林烬", auraId: "builtin-qin-shihuang" }] })
      }
      if (path.endsWith("canon.md")) return "正史规则：林烬不能背叛师门。"
      return ""
    })

    const pack = await buildContextPack("/project", "写第2章，林烬进入皇城", 2)
    const prompt = contextPackToPrompt(pack)

    expect(pack.characterAuras).toContain("林烬")
    expect(pack.characterAuras).toContain("秦始皇")
    expect(prompt).toContain("## 角色灵魂")
    expect(prompt).toContain("灵魂必须服从大纲、人物小传、角色认知和正史规则")
    expect(prompt).toContain("正史规则：林烬不能背叛师门。")
  })

  it("contextPackToPrompt handles empty pack", () => {
    const pack: ContextPack = {
      task: "写作",
      chapterGoal: "",
      outline: "",
      recentSummaries: [],
      previousChapterEnding: "",
      characterStates: "",
      soulDoc: "",
      characterAuras: "",
      cognitionStates: "",
      foreshadowingStates: "",
      timeline: "",
      relatedSettings: "",
      canonRules: "",
      writingStyle: "",
      searchResults: "",
      graphSearchResults: "",
      mustDo: "",
      mustAvoid: "",
      nextChapterAdvice: "",
      revisionDirectives: "",
    }

    const prompt = contextPackToPrompt(pack)
    expect(prompt).toContain("写作")
    expect(prompt).not.toContain(i18n.t("novel.contextPack.currentChapterGoal"))
  })
})
