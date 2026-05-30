import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "search-window.ts"), "utf8")

describe("search-window helper", () => {
  it("declares the standalone search window label and bridge events", () => {
    expect(source).toContain('SEARCH_WINDOW_LABEL = "search"')
    expect(source).toContain('SEARCH_CONTEXT_EVENT = "qmai://search-window-context"')
    expect(source).toContain('SEARCH_OPEN_FILE_EVENT = "qmai://search-open-file"')
  })

  it("reuses an existing search window before creating a new one", () => {
    expect(source).toContain("WebviewWindow.getByLabel(SEARCH_WINDOW_LABEL)")
    expect(source).toContain("existing.emit(SEARCH_CONTEXT_EVENT, context)")
    expect(source).toContain("existing.setFocus()")
    expect(source).toContain("new WebviewWindow(SEARCH_WINDOW_LABEL")
  })
})
