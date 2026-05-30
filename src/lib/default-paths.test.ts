import { describe, expect, it } from "vitest"

import { buildDefaultNovelDir, DEFAULT_INSTALL_DIR_NAME, DEFAULT_NOVEL_DIR_NAME } from "@/lib/default-paths"

describe("default paths", () => {
  it("uses the install drive for the default novel directory", () => {
    expect(buildDefaultNovelDir(`D:\\${DEFAULT_INSTALL_DIR_NAME}`)).toBe(`D:\\${DEFAULT_NOVEL_DIR_NAME}`)
    expect(buildDefaultNovelDir(`e:\\${DEFAULT_INSTALL_DIR_NAME}\\resources`)).toBe(`E:\\${DEFAULT_NOVEL_DIR_NAME}`)
  })

  it("falls back to D drive when a Windows drive cannot be inferred", () => {
    expect(buildDefaultNovelDir("QMaiWrite")).toBe(`D:\\${DEFAULT_NOVEL_DIR_NAME}`)
  })
})
