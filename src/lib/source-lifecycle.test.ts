import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  deleteSourceFiles,
  folderContextForSourcePath,
  importSourceFiles,
  importSourceFolder,
  isIngestableSourcePath,
} from "./source-lifecycle"

const mockEnqueueBatch = vi.fn<(projectId: string, files: Array<{ sourcePath: string; folderContext: string }>) => Promise<string[]>>()
const mockHasUsableLlm = vi.fn<(config: unknown) => boolean>()
const mockDeleteFile = vi.fn<(path: string) => Promise<void>>()
const mockListDirectory = vi.fn<(path: string) => Promise<unknown[]>>()
const mockReadFile = vi.fn<(path: string) => Promise<string>>()
const mockWriteFile = vi.fn<(path: string, content: string) => Promise<void>>()
const mockFileExists = vi.fn<(path: string) => Promise<boolean>>()
const mockCopyFile = vi.fn<(from: string, to: string) => Promise<void>>()
const mockCopyDirectory = vi.fn<(from: string, to: string) => Promise<string[]>>()
const mockPreprocessFile = vi.fn<(path: string) => Promise<void>>()
const mockRemoveFromIngestCache = vi.fn<(projectPath: string, fileName: string) => Promise<void>>()
const mockRemovePageEmbedding = vi.fn<(projectPath: string, slug: string) => Promise<void>>()
const mockCascadeDeleteWikiPagesWithRefs = vi.fn<(projectPath: string, paths: readonly string[]) => Promise<{ deletedPaths: string[]; rewrittenFiles: number }>>()

vi.mock("@/commands/fs", () => ({
  copyDirectory: (from: string, to: string) => mockCopyDirectory(from, to),
  copyFile: (from: string, to: string) => mockCopyFile(from, to),
  deleteFile: (path: string) => mockDeleteFile(path),
  fileExists: (path: string) => mockFileExists(path),
  listDirectory: (path: string) => mockListDirectory(path),
  preprocessFile: (path: string) => mockPreprocessFile(path),
  readFile: (path: string) => mockReadFile(path),
  writeFile: (path: string, content: string) => mockWriteFile(path, content),
}))

vi.mock("@/lib/ingest-queue", () => ({
  enqueueBatch: (projectId: string, files: Array<{ sourcePath: string; folderContext: string }>) =>
    mockEnqueueBatch(projectId, files),
}))

vi.mock("@/lib/has-usable-llm", () => ({
  hasUsableLlm: (config: unknown) => mockHasUsableLlm(config),
}))

vi.mock("@/lib/ingest-cache", () => ({
  removeFromIngestCache: (projectPath: string, fileName: string) => mockRemoveFromIngestCache(projectPath, fileName),
}))

vi.mock("@/lib/embedding", () => ({
  removePageEmbedding: (projectPath: string, slug: string) => mockRemovePageEmbedding(projectPath, slug),
}))

vi.mock("@/lib/wiki-page-delete", () => ({
  cascadeDeleteWikiPagesWithRefs: (projectPath: string, paths: readonly string[]) =>
    mockCascadeDeleteWikiPagesWithRefs(projectPath, paths),
}))

beforeEach(() => {
  mockDeleteFile.mockReset()
  mockEnqueueBatch.mockReset()
  mockHasUsableLlm.mockReset()
  mockListDirectory.mockReset()
  mockReadFile.mockReset()
  mockWriteFile.mockReset()
  mockFileExists.mockReset()
  mockCopyFile.mockReset()
  mockCopyDirectory.mockReset()
  mockPreprocessFile.mockReset()
  mockRemoveFromIngestCache.mockReset()
  mockRemovePageEmbedding.mockReset()
  mockCascadeDeleteWikiPagesWithRefs.mockReset()

  mockDeleteFile.mockResolvedValue(undefined)
  mockEnqueueBatch.mockResolvedValue([])
  mockHasUsableLlm.mockReturnValue(true)
  mockWriteFile.mockResolvedValue(undefined)
  mockFileExists.mockResolvedValue(false)
  mockCopyDirectory.mockResolvedValue([])
  mockPreprocessFile.mockResolvedValue(undefined)
  mockRemoveFromIngestCache.mockResolvedValue(undefined)
  mockRemovePageEmbedding.mockResolvedValue(undefined)
  mockCascadeDeleteWikiPagesWithRefs.mockResolvedValue({ deletedPaths: [], rewrittenFiles: 0 })
})

describe("source-lifecycle path helpers", () => {
  it("does not treat preprocessed cache files as ingestable sources", () => {
    expect(isIngestableSourcePath("raw/sources/.cache/report.pdf.txt")).toBe(false)
    expect(isIngestableSourcePath("/project/raw/sources/.cache/report.pdf.txt")).toBe(false)
  })

  it("derives folder context from absolute raw/sources paths without leaking the project prefix", () => {
    expect(
      folderContextForSourcePath("/tmp/project/raw/sources/reports/2026/report.pdf"),
    ).toBe("reports > 2026")
  })

  it("删除仅由某个原始来源支撑的大纲页时，会同步删除该来源文件并清理原始来源列表", async () => {
    mockListDirectory.mockResolvedValue([
      { name: "outline-a.md", path: "/project/wiki/outlines/outline-a.md", is_dir: false },
      { name: "outline-b.md", path: "/project/wiki/outlines/outline-b.md", is_dir: false },
    ])
    mockReadFile.mockImplementation(async (path: string) => {
      if (path === "/project/wiki/outlines/outline-a.md") {
        return `---\ntype: outline\nsources: [\"第1章.txt\"]\n---\n\n# 大纲A\n`
      }
      if (path === "/project/wiki/outlines/outline-b.md") {
        return `---\ntype: outline\nsources: [\"第1章.txt\", \"第2章.txt\"]\n---\n\n# 大纲B\n`
      }
      if (path === "/project/wiki/log.md") {
        return "# Wiki Log\n"
      }
      throw new Error(`unexpected read: ${path}`)
    })
    mockCascadeDeleteWikiPagesWithRefs.mockResolvedValue({
      deletedPaths: ["/project/wiki/outlines/outline-a.md"],
      rewrittenFiles: 0,
    })

    const result = await deleteSourceFiles("/project", ["/project/raw/sources/第1章.txt"], {
      fileAlreadyDeleted: true,
    })

    expect(mockCascadeDeleteWikiPagesWithRefs).toHaveBeenCalledWith("/project", ["/project/wiki/outlines/outline-a.md"])
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/project/wiki/outlines/outline-b.md",
      expect.stringContaining('sources: ["第2章.txt"]'),
    )
    expect(result.deletedWikiPaths).toEqual(["/project/wiki/outlines/outline-a.md"])
    expect(result.rewrittenSourcePages).toBe(1)
  })

  it("导入文件时返回按路径映射的提取任务 ID", async () => {
    mockEnqueueBatch.mockResolvedValue(["task-a", "task-b"])
    const project = { id: "proj-1", path: "/project", name: "项目一" } as Parameters<typeof importSourceFiles>[0]

    const result = await importSourceFiles(
      project,
      ["/tmp/设定.md", "/tmp/剧情.pdf"],
      {} as never,
      { autoExtract: true },
    )

    expect(result.importedPaths).toEqual([
      "/project/raw/sources/设定.md",
      "/project/raw/sources/剧情.pdf",
    ])
    expect(result.taskIdsByPath).toEqual({
      "/project/raw/sources/设定.md": ["task-a"],
      "/project/raw/sources/剧情.pdf": ["task-b"],
    })
  })

  it("关闭自动提取时导入文件夹不会入队提取", async () => {
    mockCopyDirectory.mockResolvedValue([
      "/project/raw/sources/资料夹/人物设定.md",
      "/project/raw/sources/资料夹/大纲.txt",
    ])
    const project = { id: "proj-2", path: "/project", name: "项目二" } as Parameters<typeof importSourceFolder>[0]

    const result = await importSourceFolder(
      project,
      "/tmp/资料夹",
      {} as never,
      { autoExtract: false },
    )

    expect(mockEnqueueBatch).not.toHaveBeenCalled()
    expect(result.importedPaths).toEqual([
      "/project/raw/sources/资料夹/人物设定.md",
      "/project/raw/sources/资料夹/大纲.txt",
    ])
    expect(result.taskIdsByPath).toEqual({})
  })
})
