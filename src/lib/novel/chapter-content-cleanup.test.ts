import { describe, expect, it } from "vitest"
import { cleanGeneratedChapterContentForSave } from "./chapter-content-cleanup"

describe("cleanGeneratedChapterContentForSave", () => {
  it("keeps only chapter prose when an answer includes metadata and citations", () => {
    const cleaned = cleanGeneratedChapterContentForSave(`
## 第10章（基于现有资料续写）

> 说明：资料库中缺少第7、8章完整正文，因此以下内容仅基于现有可见资料，重点承接[[第9章-罗医生]][1]。

---

　　巷子很窄。

　　杨寒低头扫了一眼，终端上的红点仍在刷新 [[第9章-罗医生]][1]。

---

　　如果你愿意，我也可以继续直接为你写第11章正文。
　　<!-- cited: 1, 2, 5 -->
`)

    expect(cleaned).toBe("　　巷子很窄。\n\n　　杨寒低头扫了一眼，终端上的红点仍在刷新。")
  })

  it("removes hidden thinking and citation markers without deleting normal prose", () => {
    const cleaned = cleanGeneratedChapterContentForSave(`
<think>先分析资料</think>
　　她停在门口[1]，没有立刻进去。
<!-- cited: 1 -->
`)

    expect(cleaned).toBe("　　她停在门口，没有立刻进去。")
  })
})
