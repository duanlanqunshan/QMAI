import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
}))

vi.mock("@/lib/search", () => ({
  searchWiki: vi.fn(),
}))

import { readFile } from "@/commands/fs"
import { searchWiki } from "@/lib/search"
import {
  extractFrontmatterList,
  normalizeMetaValue,
  relatedSettingsDataSource,
  scoreSettingCandidate,
} from "./context-data-sources"

const mockedReadFile = vi.mocked(readFile)
const mockedSearchWiki = vi.mocked(searchWiki)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("context data sources helpers", () => {
  it("normalizes frontmatter list values from strings and arrays", () => {
    expect(extractFrontmatterList("  宫廷, 权谋 , 夜谈 ")).toEqual(["宫廷", "权谋", "夜谈"].map(normalizeMetaValue))
    expect(extractFrontmatterList([" 主线 ", "对抗"])).toEqual(["主线", "对抗"].map(normalizeMetaValue))
    expect(extractFrontmatterList(null)).toEqual([])
  })

  it("prefers setting pages whose tags and statuses match current context", () => {
    const strongMatch = scoreSettingCandidate(
      {
        type: "setting",
        tags: ["宫廷", "权谋", "夜谈"],
        status: "active",
      },
      ["宫廷", "权谋"].map(normalizeMetaValue),
      ["active"],
    )

    const weakMatch = scoreSettingCandidate(
      {
        type: "setting",
        tags: ["江湖"],
        status: "archived",
      },
      ["宫廷", "权谋"].map(normalizeMetaValue),
      ["active"],
    )

    expect(strongMatch).toBeGreaterThan(weakMatch)
  })

  it("still gives a small baseline score to plain setting pages without metadata", () => {
    expect(scoreSettingCandidate({ type: "setting" }, [], [])).toBeGreaterThan(0)
    expect(scoreSettingCandidate({ type: "note" }, [], [])).toBe(1)
  })

  it("prefers related settings matching selected frontmatter tags and status", async () => {
    mockedSearchWiki.mockResolvedValue([
      { path: "/Novel/wiki/settings/jianghu.md", title: "江湖规则", snippet: "", titleMatch: false, score: 1, images: [] },
      { path: "/Novel/wiki/settings/palace-power.md", title: "宫廷权谋", snippet: "", titleMatch: true, score: 10, images: [] },
      { path: "/Novel/wiki/settings/night-talk.md", title: "夜谈密议", snippet: "", titleMatch: true, score: 9, images: [] },
    ])

    mockedReadFile.mockImplementation(async (path) => {
      if (String(path).endsWith("palace-power.md")) {
        return "---\ntype: setting\ntags: [宫廷, 权谋]\nstatus: active\n---\n\n宫廷权谋设定"
      }
      if (String(path).endsWith("night-talk.md")) {
        return "---\ntype: setting\ntags: [宫廷, 夜谈]\nstatus: active\n---\n\n夜谈密议设定"
      }
      return "---\ntype: setting\ntags: [江湖]\nstatus: archived\n---\n\n江湖旧设定"
    })

    const related = await relatedSettingsDataSource.load({
      projectPath: "/Novel",
      task: "根据章纲写第12章",
      chapterNumber: 12,
      selectedFile: "/Novel/wiki/outlines/chapter-012-outline.md",
      selectedFrontmatter: {
        type: "outline",
        tags: ["宫廷", "权谋"],
        status: "active",
      },
      config: {
        recentSummaryWindow: 8,
        searchTopK: 5,
        snapshotLookback: 3,
        revisionFeedbackWindowConfig: {},
      },
    })

    expect(related).toContain("宫廷权谋设定")
    expect(related).toContain("夜谈密议设定")
    expect(related.indexOf("宫廷权谋设定")).toBeLessThan(related.indexOf("江湖旧设定"))
  })
})
