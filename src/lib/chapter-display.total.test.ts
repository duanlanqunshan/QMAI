import { describe, expect, it } from "vitest"
import { buildChapterTotalWordCountLabel } from "./chapter-display"

describe("buildChapterTotalWordCountLabel", () => {
  it("formats the total words label in Chinese", () => {
    expect(buildChapterTotalWordCountLabel(12345)).toBe("总字数：12345字")
  })
})
