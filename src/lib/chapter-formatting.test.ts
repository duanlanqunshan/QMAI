import { describe, expect, it } from "vitest"
import { formatChapterWriting } from "./chapter-formatting"

describe("formatChapterWriting", () => {
  it("adds two-character indentation and removes blank lines between normal paragraphs", () => {
    const markdown = [
      "---",
      'title: "第1章"',
      "type: chapter",
      "---",
      "",
      "# 第1章",
      "",
      "第一段。",
      "",
      "",
      "  第二段。  ",
      "",
      "",
      "",
      "第三段。",
      "",
    ].join("\n")

    expect(formatChapterWriting(markdown)).toBe([
      "---",
      'title: "第1章"',
      "type: chapter",
      "---",
      "",
      "# 第1章",
      "",
      "　　第一段。",
      "　　第二段。",
      "　　第三段。",
    ].join("\n"))
  })

  it("preserves markdown structural blocks while formatting normal paragraphs", () => {
    const markdown = [
      "# 标题",
      "",
      "> 引用内容",
      "",
      "- 列表项",
      "",
      "普通段落",
      "",
      "```ts",
      "const value = 1",
      "```",
      "",
      "另一个段落",
    ].join("\n")

    expect(formatChapterWriting(markdown)).toBe([
      "# 标题",
      "",
      "> 引用内容",
      "",
      "- 列表项",
      "",
      "　　普通段落",
      "",
      "```ts",
      "const value = 1",
      "```",
      "",
      "　　另一个段落",
    ].join("\n"))
  })
})
