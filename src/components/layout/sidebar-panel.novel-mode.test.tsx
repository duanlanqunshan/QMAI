import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "sidebar-panel.tsx"), "utf8")

describe("小说模式侧栏", () => {
  it("章节库和大纲库顶部只保留单标题模式", () => {
    expect(source).toContain('className="flex shrink-0 items-center justify-between border-b px-3 py-2"')
    expect(source).toContain('isChapter ? t("sidebar.knowledge") : t("sidebar.files")')
    expect(source).not.toContain('border-b-2 border-primary')
  })

  it("支持新建卷和新建文件夹", () => {
    expect(source).toContain('t("sidebar.newVolumePrompt")')
    expect(source).toContain('t("sidebar.newFolderPrompt")')
    expect(source).toContain('kind: "outline"')
    expect(source).toContain('kind === "volume"')
  })

  it("从大纲库切回章节库时会清理未完成的新建大纲状态", () => {
    expect(source).toContain('pendingCreate?.kind === "outline"')
    expect(source).toContain("if (isChapter)")
    expect(source).toContain("setPendingCreate(null)")
    expect(source).toContain('setInputTitle("")')
  })

  it("章节栏顶部显示当前所有章节总字数", () => {
    expect(source).toContain("sidebarTotalWordCount")
    expect(source).toContain("buildChapterTotalWordCountLabel")
    expect(source).toContain('isChapter && sidebarTotalWordCount !== null')
  })
})
