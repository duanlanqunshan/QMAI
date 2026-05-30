import { beforeEach, describe, expect, it, vi } from "vitest"

const storage = new Map<string, string>()

Object.defineProperty(globalThis, "localStorage", {
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
})

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

describe("WebFileSystem", () => {
  it("treats created directories as existing paths", async () => {
    const { getWebFs } = await import("./web-fs")
    const fs = getWebFs()

    await fs.createDirectory("/novel/wiki/chapters")

    await expect(fs.fileExists("/novel/wiki/chapters")).resolves.toBe(true)
  })

  it("initializes demo graph pages with Chinese example names", async () => {
    const { getWebFs } = await import("./web-fs")
    const fs = getWebFs()

    await fs.openProject("/novel-demo")

    await expect(fs.fileExists("/novel-demo/wiki/entities/示例实体.md")).resolves.toBe(true)
    await expect(fs.fileExists("/novel-demo/wiki/concepts/示例概念.md")).resolves.toBe(true)

    const entity = await fs.readFile("/novel-demo/wiki/entities/示例实体.md")
    const concept = await fs.readFile("/novel-demo/wiki/concepts/示例概念.md")

    expect(entity).toContain("title: 示例实体")
    expect(entity).toContain("# 示例实体")
    expect(entity).not.toContain("Example Entity")
    expect(concept).toContain("title: 示例概念")
    expect(concept).toContain("# 示例概念")
    expect(concept).not.toContain("Example Concept")
  })
})
