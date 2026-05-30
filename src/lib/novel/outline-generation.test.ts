import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(),
  fileExists: vi.fn(),
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock("@/lib/llm-client", () => ({
  streamChat: vi.fn(),
}))

vi.mock("@/lib/search", () => ({
  searchWiki: vi.fn(),
}))

vi.mock("./chapter-ingest", () => ({
  ingestOutline: vi.fn(),
}))

vi.mock("./context-engine", () => ({
  buildContextPack: vi.fn(),
}))

import { createDirectory, fileExists, listDirectory, readFile, writeFile } from "@/commands/fs"
import { streamChat } from "@/lib/llm-client"
import { searchWiki } from "@/lib/search"
import { useOutlineGenerationStore } from "@/stores/outline-generation-store"
import { useWikiStore, type LlmConfig } from "@/stores/wiki-store"
import { buildContextPack } from "./context-engine"
import {
  buildOutlineGenerationPrompt,
  generateOutlineFile,
  generateOutlineRefinementSectionFile,
  generateOutlineRefinementFiles,
  hasOutlineForRefinement,
  runOutlineRefinementTask,
} from "./outline-generation"

const mockCreateDirectory = vi.mocked(createDirectory)
const mockFileExists = vi.mocked(fileExists)
const mockListDirectory = vi.mocked(listDirectory)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockStreamChat = vi.mocked(streamChat)
const mockSearchWiki = vi.mocked(searchWiki)
const mockBuildContextPack = vi.mocked(buildContextPack)

const TEST_LLM_CONFIG: LlmConfig = {
  provider: "custom",
  apiKey: "",
  model: "test-model",
  ollamaUrl: "http://localhost:11434",
  customEndpoint: "http://localhost:1234/v1/chat/completions",
  maxContextSize: 32768,
}

describe("outline refinement generation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFileExists.mockResolvedValue(false)
    mockListDirectory.mockResolvedValue([])
    mockReadFile.mockResolvedValue("")
    useWikiStore.getState().setOutputLanguage("Chinese")
    useOutlineGenerationStore.setState({ tasks: [], panelOpen: false })
  })

  it("generates six outline files with separate llm calls", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "细化第一卷",
      chapterGoal: "",
      outline: "# 总大纲\n林烬进京调查黑玉令。",
      recentSummaries: ["第12章：林烬确认太子和旧案有关。"],
      previousChapterEnding: "",
      characterStates: "第12章：林烬负伤但掌握新线索",
      soulDoc: "",
      characterAuras: "",
      cognitionStates: "林烬仍不知道黑玉令真正来历",
      foreshadowingStates: "未回收伏笔：黑玉令来源",
      timeline: "第12章：子夜潜入黑塔",
      relatedSettings: "巡夜司、黑塔、旧案卷宗",
      canonRules: "黑塔只允许巡夜司进入",
      writingStyle: "",
      searchResults: "共享 Wiki：黑玉令与巡夜司旧库有关",
      graphSearchResults: "图谱邻域：太子与旧案线索相连",
      mustDo: "",
      mustAvoid: "",
      nextChapterAdvice: "",
      revisionDirectives: "",
    })
    const sectionContents = [
      "## 第13章\n- 目标：追查旧库账册",
      "## 林烬\n- 动机：查明旧案",
      "## 巡夜司\n- 目标：封锁真相",
      "## 黑玉令\n- 代价：反噬寿命",
      "## 黑玉令来源\n- 第13章推进",
      "## 黑塔旧库\n- 作用：藏匿账册",
    ]
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken(sectionContents[mockStreamChat.mock.calls.length - 1] ?? "")
      callbacks.onDone()
    })

    const result = await generateOutlineRefinementFiles("/project", TEST_LLM_CONFIG, "细化第一卷主线冲突")

    expect(mockStreamChat).toHaveBeenCalledTimes(6)
    const prompt = String(mockStreamChat.mock.calls[0]?.[1]?.[0]?.content ?? "")
    expect(prompt).toContain("已有大纲与项目记忆")
    expect(prompt).toContain("人物状态变化")
    expect(prompt).toContain("黑塔只允许巡夜司进入")
    expect(prompt).toContain("细化第一卷主线冲突")

    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/wiki/outlines")
    expect(mockWriteFile).toHaveBeenCalledTimes(6)
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/章节细纲.md",
      expect.stringContaining("# 章节细纲"),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/人物小传.md",
      expect.stringContaining("# 人物小传"),
    )

    expect(result.primaryPath).toBe("/project/wiki/outlines/章节细纲.md")
    expect(result.writtenPaths).toEqual([
      "/project/wiki/outlines/章节细纲.md",
      "/project/wiki/outlines/人物小传.md",
      "/project/wiki/outlines/组织势力设定.md",
      "/project/wiki/outlines/金手指与能力体系.md",
      "/project/wiki/outlines/伏笔计划.md",
      "/project/wiki/outlines/地点设定.md",
    ])
  })

  it("falls back to the first written refinement file when chapter outlines are empty", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "细化人物",
      chapterGoal: "",
      outline: "# 总大纲\n故事已经存在。",
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
    })
    const sectionContents = [
      "",
      "## 林烬\n- 当前状态：继续追查",
      "",
      "",
      "",
      "",
    ]
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken(sectionContents[mockStreamChat.mock.calls.length - 1] ?? "")
      callbacks.onDone()
    })

    const result = await generateOutlineRefinementFiles("/project", TEST_LLM_CONFIG, "")

    expect(mockStreamChat).toHaveBeenCalledTimes(6)
    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    expect(result.primaryPath).toBe("/project/wiki/outlines/人物小传.md")
    expect(result.writtenPaths).toEqual(["/project/wiki/outlines/人物小传.md"])
  })

  it("generates a single selected outline section", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "生成地点",
      chapterGoal: "",
      outline: "# 总大纲\n故事已经存在。",
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
    })
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("## 黑塔旧库\n- 作用：藏匿账册")
      callbacks.onDone()
    })

    const path = await generateOutlineRefinementSectionFile("/project", TEST_LLM_CONFIG, "补充地点", "locationsOutline")

    expect(mockStreamChat).toHaveBeenCalledTimes(1)
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/地点设定.md",
      expect.stringContaining("# 地点设定"),
    )
    expect(path).toBe("/project/wiki/outlines/地点设定.md")
  })

  it("can append generated section content into the current outline file", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "追加地点",
      chapterGoal: "",
      outline: "# 总大纲\n故事已经存在。",
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
    })
    mockReadFile.mockResolvedValue("# 已有大纲\n\n旧内容")
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("## 黑塔旧库\n- 作用：藏匿账册")
      callbacks.onDone()
    })

    const path = await generateOutlineRefinementSectionFile(
      "/project",
      TEST_LLM_CONFIG,
      "补充地点",
      "locationsOutline",
      { mode: "appendCurrent", targetPath: "/project/wiki/outlines/总大纲.md" },
    )

    expect(path).toBe("/project/wiki/outlines/总大纲.md")
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/总大纲.md",
      expect.stringContaining("## 地点设定"),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/总大纲.md",
      expect.stringContaining("## 黑塔旧库"),
    )
  })

  it("can create a new outline file and add it to the outline list", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "新建地点",
      chapterGoal: "",
      outline: "# 总大纲\n故事已经存在。",
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
    })
    mockReadFile.mockResolvedValue("# 地点设定\n\n## 黑塔旧库")
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("## 黑塔旧库\n- 作用：藏匿账册")
      callbacks.onDone()
    })

    const path = await generateOutlineRefinementSectionFile(
      "/project",
      TEST_LLM_CONFIG,
      "补充地点",
      "locationsOutline",
      { mode: "newFileAndAddToList" },
    )

    expect(path).toBe("/project/wiki/outlines/地点设定.md")
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/地点设定.md",
      expect.stringContaining("# 地点设定"),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/raw/sources/地点设定.md",
      "# 地点设定\n\n## 黑塔旧库",
    )
  })

  it("uses English filenames and titles when output language is English", async () => {
    useWikiStore.getState().setOutputLanguage("English")
    mockBuildContextPack.mockResolvedValue({
      task: "generate locations",
      chapterGoal: "",
      outline: "# Story Outline\nThe story already exists.",
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
    })
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("## Black Tower Archive\n- Purpose: hide the ledgers")
      callbacks.onDone()
    })

    const path = await generateOutlineRefinementSectionFile("/project", TEST_LLM_CONFIG, "expand locations", "locationsOutline")

    expect(path).toBe("/project/wiki/outlines/locations.md")
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/locations.md",
      expect.stringContaining("# Location Notes"),
    )
  })

  it("uses language-based filenames for the main outline file", async () => {
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("# 总大纲\n\n这里是正文")
      callbacks.onDone()
    })

    const chineseResult = await generateOutlineFile("/project", TEST_LLM_CONFIG, "生成总大纲")
    expect(chineseResult.outlinePath).toBe("/project/wiki/outlines/总大纲.md")

    useWikiStore.getState().setOutputLanguage("English")
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("# Story Outline\n\nBody")
      callbacks.onDone()
    })

    const englishResult = await generateOutlineFile("/project", TEST_LLM_CONFIG, "Generate a story outline")
    expect(englishResult.outlinePath).toBe("/project/wiki/outlines/story-outline.md")
  })

  it("builds initial outline prompts with project memory context", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "生成大纲：世家阴谋",
      chapterGoal: "",
      outline: "# 已有总纲\n旧版故事骨架",
      recentSummaries: ["第1章：楚白在雨夜救下念念"],
      previousChapterEnding: "陆家来人堵门",
      characterStates: "楚白：隐忍，准备反击",
      soulDoc: "故事核心：先守住孩子，再反咬陆家",
      characterAuras: "",
      cognitionStates: "念念不知道自己的真实身世",
      foreshadowingStates: "伏笔：陆家令牌的来源未回收",
      timeline: "初夏，楚家村",
      relatedSettings: "陆家、楚家村、药坊",
      canonRules: "楚白不能主动暴露底牌",
      writingStyle: "",
      searchResults: "卡片故事：雨夜救子、药坊冲突",
      graphSearchResults: "图谱关联：楚白-念念-陆家",
      mustDo: "",
      mustAvoid: "",
      nextChapterAdvice: "",
      revisionDirectives: "",
    })

    const prompt = await buildOutlineGenerationPrompt("/project", "古言", "长篇", "母女逃亡与世家追杀")

    expect(prompt).toContain("母女逃亡与世家追杀")
    expect(prompt).toContain("已有故事记忆与项目资料")
    expect(prompt).toContain("卡片故事：雨夜救子、药坊冲突")
    expect(prompt).toContain("图谱关联：楚白-念念-陆家")
    expect(prompt).toContain("楚白：隐忍，准备反击")
  })

  it("runs refinement in the background task flow", async () => {
    mockBuildContextPack.mockResolvedValue({
      task: "补充人物",
      chapterGoal: "",
      outline: "# 总大纲\n故事已经存在。",
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
    })
    mockStreamChat.mockImplementation(async (_config, _messages, callbacks) => {
      callbacks.onToken("## 杨洋\n- 当前目标：继续追查")
      callbacks.onDone()
    })

    const taskId = useOutlineGenerationStore.getState().createTask({
      projectPath: "/project",
      kind: "refine",
      userRequest: "只补人物小传",
      selectedSectionKey: "characterBriefs",
      displayTitle: "人物小传",
      writeMode: "newFileAndAddToList",
    })

    await runOutlineRefinementTask(taskId, TEST_LLM_CONFIG)

    const task = useOutlineGenerationStore.getState().tasks.find((item) => item.id === taskId)
    expect(task?.status).toBe("generated")
    expect(task?.outlinePath).toBe("/project/wiki/outlines/人物小传.md")
    expect(task?.message).toBe("人物小传已生成并保存到大纲页面")
  })

  it("checks outline availability from the wiki search results", async () => {
    mockSearchWiki.mockResolvedValue([{
      path: "/project/wiki/outlines/story-outline.md",
      title: "故事大纲",
      snippet: "",
      titleMatch: true,
      score: 1,
      images: [],
    }])

    await expect(hasOutlineForRefinement("/project")).resolves.toBe(true)
    expect(mockSearchWiki).toHaveBeenCalledWith("/project", "outline type:outline")

    mockSearchWiki.mockResolvedValue([])
    await expect(hasOutlineForRefinement("/project")).resolves.toBe(false)
  })
})
