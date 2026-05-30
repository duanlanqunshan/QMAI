import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "sidebar-panel.tsx"), "utf8")

describe("sidebar-panel outline tree", () => {
  it("uses the outline knowledge tree in novel mode instead of the raw source sidebar", () => {
    expect(source).toContain('filterType={isChapter ? "chapter" : "outline"}')
    expect(source).not.toContain("<SourceSidebar onRequestCreate={beginCreate} />")
  })
})
