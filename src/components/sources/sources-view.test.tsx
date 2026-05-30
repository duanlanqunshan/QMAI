import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(__dirname, "source-sidebar.tsx"), "utf8")

describe("大纲库导入与提取状态", () => {
  it("提供自动提取开关并读取项目级 novelConfig", () => {
    expect(source).toContain("autoExtractOnImport")
    expect(source).toContain("handleToggleAutoExtract")
  })

  it("导入后会登记 taskIdsByPath 以立即显示提取状态", () => {
    expect(source).toContain("registerExtractTasks")
    expect(source).toContain("taskIdsByPath")
  })
})
