import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "de-ai-preview-dialog.tsx"), "utf8")

describe("去AI味预览对话框", () => {
  it("open=true 时显示原文、去AI味稿、替换正文、另存草稿、取消", () => {
    expect(source).toContain("原文")
    expect(source).toContain("去AI味稿")
    expect(source).toContain("替换正文")
    expect(source).toContain("另存草稿")
    expect(source).toContain("取消")
  })

  it("点击替换正文触发 onApply", () => {
    expect(source).toContain("onClick={onApply}")
  })

  it("点击取消触发 onClose", () => {
    expect(source).toContain("onClick={onClose}")
  })
})