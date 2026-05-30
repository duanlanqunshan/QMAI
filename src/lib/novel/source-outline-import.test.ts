import { beforeEach, describe, expect, it, vi } from "vitest"
import { addSourceToOutlineCategory } from "./source-outline-import"

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(),
  fileExists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { createDirectory, fileExists, readFile, writeFile } from "@/commands/fs"

const mockCreateDirectory = vi.mocked(createDirectory)
const mockFileExists = vi.mocked(fileExists)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

beforeEach(() => {
  mockCreateDirectory.mockReset()
  mockFileExists.mockReset()
  mockReadFile.mockReset()
  mockWriteFile.mockReset()
})

describe("addSourceToOutlineCategory", () => {
  it("writes the imported source into the category folder", async () => {
    mockFileExists.mockResolvedValue(false)
    mockReadFile.mockResolvedValue("# 导入作品\n\n故事原文")

    const path = await addSourceToOutlineCategory(
      "E:/Novel",
      "E:/Novel/raw/sources/book.md",
      "story-outline",
    )

    expect(path).toBe("E:/Novel/wiki/outlines/总大纲/book.md")
    expect(mockCreateDirectory).toHaveBeenCalledWith("E:/Novel/wiki/outlines")
    expect(mockCreateDirectory).toHaveBeenCalledWith("E:/Novel/wiki/outlines/总大纲")
    expect(mockWriteFile).toHaveBeenCalledWith(
      path,
      expect.stringContaining('outline_folder: "总大纲"'),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      path,
      expect.stringContaining('sources: ["raw/sources/book.md"]'),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      path,
      expect.stringContaining("> 原始来源：raw/sources/book.md"),
    )
  })

  it("creates a unique file when the same source is added repeatedly", async () => {
    mockFileExists.mockImplementation(async (path: string) => path === "E:/Novel/wiki/outlines/人物小传/book.md")
    mockReadFile.mockResolvedValue("人物资料")

    const path = await addSourceToOutlineCategory(
      "E:/Novel",
      "E:/Novel/raw/sources/book.md",
      "character-briefs",
    )

    expect(path).toBe("E:/Novel/wiki/outlines/人物小传/book-2.md")
    expect(mockWriteFile).toHaveBeenCalledWith(
      path,
      expect.stringContaining('outline_category: characters'),
    )
  })
})
