import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "de-ai-adapter.ts"), "utf8")

describe("de-ai-adapter skill binding", () => {
  it("binds the novel de-ai prompt to the bundled skill markdown", () => {
    expect(source).toContain("QM-QUAI.md?raw")
  })
})
