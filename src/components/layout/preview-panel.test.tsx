import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "preview-panel.tsx"), "utf8")

describe("preview-panel 正式章节保存状态持久化", () => {
  it("保存状态匹配 projectPath 和 filePath", () => {
    expect(source).toContain("finalChapterSave.projectPath === project?.path")
    expect(source).toContain("finalChapterSave.filePath === selectedFile")
  })

  it("保存正式章节时写入全局 store setFinalChapterSave", () => {
    expect(source).toContain("setFinalChapterSave")
    expect(source).toContain("projectPath,")
    expect(source).toContain("filePath:")
  })

  it("保存状态使用 phase 模式码而非翻译后的中文文案", () => {
    expect(source).toContain("phase: FinalChapterSavePhase")
    expect(source).toContain("phaseLabelMap")
  })

  it("切换章节或离开章节库前会同步章节文件名", () => {
    expect(source).toContain("flushChapterBeforeLeave")
    expect(source).toContain("previousFile !== selectedFile")
    expect(source).toContain("syncChapterToCanonicalPath")
  })

  it("支持选中文本的预览替换链路", () => {
    expect(source).toContain("TextTransformPreviewDialog")
    expect(source).toContain("handleSelectionAction")
    expect(source).toContain("replaceChapterBodySelection")
  })

  it("章节标题输入使用本地 draft，失焦或回车后再提交，避免正文抢焦点", () => {
    expect(source).toContain("chapterTitleDraft")
    expect(source).toContain("chapterTitleEditing")
    expect(source).toContain("commitChapterTitleDraft")
    expect(source).toContain("e.currentTarget.blur()")
    expect(source).toContain("e.stopPropagation()")
  })

  it("章节标题区域按真实标题宽度贴紧显示状态和字数，正式章节使用徽标样式", () => {
    expect(source).toContain("titleMeasureRef")
    expect(source).toContain("chapterTitleWidthPx")
    expect(source).toContain("chapterStatusMeta")
    expect(source).toContain("chapterWordCountMeta")
    expect(source).toContain('chapterHeader.status === "final"')
  })

  it("草稿状态在章节头部也使用轻量徽标样式", () => {
    expect(source).toContain('chapterHeader.status === "draft"')
    expect(source).toContain("rounded-full border border-border/70 bg-muted/60")
  })

  it("章节头部拿不到正文标题时会回退到当前文件名", () => {
    expect(source).toContain("chapterDisplayTitle")
    expect(source).toContain("getChapterTitleFromPath")
  })

  it("章节头部不显示当前所有章节总字数", () => {
    expect(source).not.toContain("chapterTotalWordCountMeta")
    expect(source).not.toContain("buildChapterTotalWordCountLabel")
    expect(source).not.toContain("totalChapterWords")
  })

  it("不再显示废弃草稿按钮", () => {
    expect(source).not.toContain("canArchiveDraft")
    expect(source).not.toContain("handleArchiveDraft")
    expect(source).not.toContain('t("novel.chapter.archiveDraft")')
  })

  it("does not mount a newly selected markdown file before that file content has loaded", () => {
    expect(source).toContain("loadedFilePath")
    expect(source).toContain("loadedFilePath !== selectedFile")
    expect(source).toContain("setLoadedFilePath(selectedFile)")
  })

  it("leaving a chapter skips redundant flush when markdown is unchanged", () => {
    expect(source).toContain("if (markdown === lastLoadedRef.current) return")
  })

  it("回收站里的 markdown 预览会先剥离 frontmatter，再按正常正文格式显示", () => {
    expect(source).toContain('const trashPreviewBody = category === "markdown"')
    expect(source).toContain("? parseFrontmatter(fileContent).body")
    expect(source).toContain("<WikiReader body={trashPreviewBody} />")
  })
})
