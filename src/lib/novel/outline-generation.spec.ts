import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  buildContextPackMock: vi.fn(),
}))

vi.mock("./context-engine", async () => {
  const actual = await vi.importActual<typeof import("./context-engine")>("./context-engine")
  return {
    ...actual,
    buildContextPack: mocks.buildContextPackMock,
  }
})

import { buildOutlineGenerationPrompt, buildOutlineRefinementContext } from "./outline-generation"

describe("outline-generation context fallback", () => {
  beforeEach(() => {
    mocks.buildContextPackMock.mockReset()
  })

  it("still builds a generation prompt when context loading fails", async () => {
    mocks.buildContextPackMock.mockRejectedValueOnce(new Error("context failed"))

    const prompt = await buildOutlineGenerationPrompt("E:/Novel", "通用", "短篇", "测试")

    expect(prompt).toContain("测试")
    expect(prompt).toContain("请为以下小说生成大纲")
  })

  it("returns an empty refinement context when context loading fails", async () => {
    mocks.buildContextPackMock.mockRejectedValueOnce(new Error("context failed"))

    const result = await buildOutlineRefinementContext("E:/Novel", "测试")

    expect(result).toEqual({
      context: "",
      hasOutline: false,
    })
  })

  it("includes terminology guard in outline generation context", async () => {
    mocks.buildContextPackMock.mockResolvedValueOnce({
      task: "测试",
      chapterGoal: "",
      outline: "总纲内容",
      recentSummaries: [],
      previousChapterEnding: "",
      characterStates: "",
      soulDoc: "",
      characterAuras: "",
      cognitionStates: "",
      foreshadowingStates: "",
      timeline: "",
      terminologyGuard: "术语守卫：\"青铜钥\"不能改名。",
      relatedSettings: "祠堂设定",
      canonRules: "",
      writingStyle: "",
      searchResults: "",
      graphSearchResults: "",
      mustDo: "",
      mustAvoid: "",
      nextChapterAdvice: "",
      revisionDirectives: "",
    })

    const prompt = await buildOutlineGenerationPrompt("E:/Novel", "通用", "短篇", "测试")

    expect(prompt).toContain("术语守卫")
    expect(prompt).toContain("青铜钥")
    expect(prompt).toContain("祠堂设定")
  })
})
