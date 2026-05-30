import { describe, expect, it } from "vitest"
import { createDirectory, readFile, writeFile } from "@/commands/fs"
import { generateOutlineRefinementFiles, hasOutlineForRefinement } from "@/lib/novel/outline-generation"
import { useWikiStore, type LlmConfig } from "@/stores/wiki-store"

const PROJECT_PATH = "/acceptance-refine-project"
const OUTLINES_DIR = `${PROJECT_PATH}/wiki/outlines`
const OUTLINE_PATH = `${OUTLINES_DIR}/story-outline.md`

const IMPORTED_OUTLINE = [
  "---",
  "type: outline",
  'title: "导入示例总纲"',
  "---",
  "",
  "# 导入示例总纲",
  "",
  "## 故事核心",
  "- 主角因旧案回到故乡，卷入多方势力争夺。",
  "",
  "## 卷一目标",
  "- 查明第一起失踪案的真实动机。",
  "",
  "## 卷二目标",
  "- 揭示幕后组织与主角家族的关联。",
  "",
  "## 长线伏笔",
  "- 失踪名单中的同姓者身份。",
  "- 夜潮会账本缺页来源。",
  "",
].join("\n")

const llmConfig: LlmConfig = {
  provider: "custom",
  apiKey: "",
  model: "mock-refine-model",
  ollamaUrl: "http://127.0.0.1:11434",
  customEndpoint: "http://127.0.0.1:18080",
  maxContextSize: 131072,
  apiMode: "chat_completions",
  reasoning: { mode: "off" },
}

describe("refine generation acceptance", () => {
  it("imports one outline and successfully writes six refinement files in one submit", async () => {
    useWikiStore.getState().setNovelMode(true)

    await createDirectory(OUTLINES_DIR)
    await writeFile(OUTLINE_PATH, IMPORTED_OUTLINE)

    const canRefine = await hasOutlineForRefinement(PROJECT_PATH)
    expect(canRefine).toBe(true)

    const result = await generateOutlineRefinementFiles(
      PROJECT_PATH,
      llmConfig,
      "请基于已有总纲，细化第一卷章节推进，并补全人物、组织、能力体系、伏笔与地点设定。",
    )

    expect(result.primaryPath).toBe(`${OUTLINES_DIR}/chapter-outlines.md`)
    expect(result.writtenPaths).toHaveLength(6)

    for (const path of result.writtenPaths) {
      const content = await readFile(path)
      expect(content.length).toBeGreaterThan(20)
      expect(content).toMatch(/^---\n/)
    }
  }, 60_000)
})

