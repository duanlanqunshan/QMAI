import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sidebarSource = readFileSync(resolve(__dirname, "review-center-sidebar-panel.tsx"), "utf8")
const reviewViewSource = readFileSync(resolve(__dirname, "../review/review-view.tsx"), "utf8")

describe("review-center-sidebar-panel", () => {
  it("keeps the chapter target selector available", () => {
    expect(sidebarSource).toContain('t("reviewCenter.chapterTarget")')
    expect(sidebarSource).toContain("selectedReviewFilePath")
    expect(sidebarSource).toContain("<select")
  })

  it("builds labels from chapter content without re-prefixing chapter numbers", () => {
    expect(sidebarSource).toContain("parseFrontmatter")
    expect(sidebarSource).toContain("const baseTitle = fmTitle || headingTitle")
    expect(sidebarSource).not.toContain('`第${meta.chapterNumber}章-')
  })

  it("keeps per-dimension review buttons", () => {
    expect(sidebarSource).toContain('t("reviewCenter.reviewAction")')
  })

  it("reuses the shared review start helper", () => {
    expect(sidebarSource).toContain("startNovelReviewRun({")
    expect(reviewViewSource).toContain("startNovelReviewRun({")
  })

  it("stops propagation and switches dimension when clicking review", () => {
    expect(sidebarSource).toContain("event.stopPropagation()")
    expect(sidebarSource).toContain("setSelectedReviewDimension(dim.key)")
  })
})
