# 灵魂模块 (Soul Module) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有"角色灵魂"升级为"灵魂"模块，新增项目级 `soul.md`（定义写作AI整体气质），与角色级别灵魂绑定协同注入 LLM 提示词

**Architecture:** 两层设计 —— 项目级 `soul.md` 作为顶层的写作灵魂指令 + 角色级别的灵魂绑定（复用现有 character-aura 基础设施）。两者通过 `context-engine.ts` 按优先级注入到 LLM 提示词中，soul.md 优先级高于角色灵魂。

**Tech Stack:** TypeScript + React + i18next + Tauri

---

## 前置：分支管理

当前在 `feature/review-scoring` 分支，有未提交的改动（`character-aura.ts`、`character-aura-view.tsx`、`mod.ts`）。在开始本计划前：

1. 先在 `feature/review-scoring` 上完成当前工作并合并回 master
2. 从 master 创建新分支 `feature/soul-module`

```bash
git checkout master
git checkout -b feature/soul-module
```

## 文件结构

| 文件 | 角色 | 操作 |
|------|------|------|
| `src/lib/novel/soul-doc.ts` | 项目级 soul 文档的读写、格式解析 | **新建** |
| `src/lib/novel/soul-doc.test.ts` | soul-doc 模块的单元测试 | **新建** |
| `src/lib/novel/context-engine.ts` | 新增 soul.md 读取 + 注入到 ContextPack + 优先级调整 | **修改** |
| `src/lib/novel/character-aura.ts` | `buildCharacterAuraContext` 的提示词措辞更新 | **修改** |
| `src/components/novel/character-aura-view.tsx` | UI：侧栏标题从"角色灵魂"改为"灵魂"，增加项目/角色双 Tab | **修改** |
| `src/components/novel/soul-doc-editor.tsx` | 项目级 soul.md 的编辑器组件（纯文本编辑） | **新建** |
| `src/i18n/zh.json` | 更新/新增中文文案 | **修改** |
| `src/i18n/en.json` | 更新/新增英文文案 | **修改** |
| `src/lib/novel/mod.ts` | 导出新模块的类型与函数 | **修改** |

---

## 设计决策

1. **soul.md 存储位置**：项目根目录 `soul.md`（与 `AGENTS.md` 同级，用户可直接编辑）
2. **soul.md 注入时机**：在 `buildContextPack` 中读取，与角色灵魂、写作风格一同并行加载
3. **soul.md 优先级**：SECTION_PRIORITY 设为 3（仅次于"当前任务"和"当前章节目标"），位于大纲之前
4. **角色灵魂优先级**：维持 8 不变
5. **UI Tab 设计**：左侧导航仍用 `Sparkles` 图标，进入后在侧栏顶部显示两个 Tab：「项目灵魂」「角色灵魂」
6. **角色灵魂提示词措辞**：将 `buildCharacterAuraContext` 中的"灵魂"措辞改为"角色灵魂"，避免与项目 soul.md 混淆

---

### Task 1: 创建 soul-doc 模块（读写 + 格式解析）

**Files:**
- Create: `src/lib/novel/soul-doc.ts`
- Create: `src/lib/novel/soul-doc.test.ts`

- [ ] **Step 1: 编写测试文件**

```typescript
// src/lib/novel/soul-doc.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { readSoulDoc, writeSoulDoc, SOUL_DOC_FILENAME } from "./soul-doc"
import * as fs from "@/commands/fs"

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
  writeFileAtomic: vi.fn(),
}))

const mockReadFile = vi.mocked(fs.readFile)
const mockWriteFileAtomic = vi.mocked(fs.writeFileAtomic)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SOUL_DOC_FILENAME", () => {
  it("should be soul.md", () => {
    expect(SOUL_DOC_FILENAME).toBe("soul.md")
  })
})

describe("readSoulDoc", () => {
  it("should read soul.md from project root", async () => {
    mockReadFile.mockResolvedValueOnce("# 项目灵魂\n\n幽默风趣，快节奏叙事")
    const result = await readSoulDoc("/project/path")
    expect(mockReadFile).toHaveBeenCalledWith("/project/path/soul.md")
    expect(result).toBe("# 项目灵魂\n\n幽默风趣，快节奏叙事")
  })

  it("should return empty string when file does not exist", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"))
    const result = await readSoulDoc("/project/path")
    expect(result).toBe("")
  })

  it("should return empty string for other errors", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("Permission denied"))
    const result = await readSoulDoc("/project/path")
    expect(result).toBe("")
  })
})

describe("writeSoulDoc", () => {
  it("should write content to soul.md", async () => {
    await writeSoulDoc("/project/path", "简洁克制的古典风格")
    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      "/project/path/soul.md",
      "简洁克制的古典风格"
    )
  })

  it("should throw on write error", async () => {
    mockWriteFileAtomic.mockRejectedValueOnce(new Error("Disk full"))
    await expect(writeSoulDoc("/project/path", "content")).rejects.toThrow("Disk full")
  })
})
```

- [ ] **Step 2: 运行测试，确认全部 FAIL**

Run: `npx vitest run src/lib/novel/soul-doc.test.ts`
Expected: 5 tests, all FAIL (module not found / functions not defined)

- [ ] **Step 3: 实现 soul-doc.ts**

```typescript
// src/lib/novel/soul-doc.ts
import { readFile, writeFileAtomic } from "@/commands/fs"
import { joinPath } from "@/lib/path-utils"

export const SOUL_DOC_FILENAME = "soul.md"

export async function readSoulDoc(projectPath: string): Promise<string> {
  try {
    const filePath = joinPath(projectPath, SOUL_DOC_FILENAME)
    return await readFile(filePath)
  } catch {
    return ""
  }
}

export async function writeSoulDoc(projectPath: string, content: string): Promise<void> {
  const filePath = joinPath(projectPath, SOUL_DOC_FILENAME)
  await writeFileAtomic(filePath, content)
}
```

- [ ] **Step 4: 运行测试，确认全部 PASS**

Run: `npx vitest run src/lib/novel/soul-doc.test.ts`
Expected: 5 tests, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/novel/soul-doc.ts src/lib/novel/soul-doc.test.ts
git commit -m "feat: soul-doc 模块 — 项目级 soul.md 读写"
```

---

### Task 2: context-engine.ts 集成 soul.md 读取与注入

**Files:**
- Modify: `src/lib/novel/context-engine.ts`

- [ ] **Step 1: 在 ContextPack 中新增 soulDoc 字段**

在 `ContextPack` 接口中新增字段（第 35-55 行区域）：

```typescript
export interface ContextPack {
  task: string
  chapterGoal: string
  outline: string
  recentSummaries: string[]
  previousChapterEnding: string
  characterStates: string
  soulDoc: string              // 新增：项目级灵魂
  characterAuras: string
  cognitionStates: string
  foreshadowingStates: string
  timeline: string
  relatedSettings: string
  canonRules: string
  writingStyle: string
  searchResults: string
  graphSearchResults: string
  mustDo: string
  mustAvoid: string
  nextChapterAdvice: string
  revisionDirectives: string
}
```

- [ ] **Step 2: 在 buildContextPack 的 Promise.all 中并行读取 soul.md**

在 `buildContextPack` 函数顶部添加 import：

```typescript
import { readSoulDoc } from "./soul-doc"
```

在 `Promise.all` 调用（第 74-93 行）中添加 `readSoulDoc`：

```typescript
const [outline, chapterOutline, volumeContext, snapshots, fallbackRecentSummaries, fallbackPreviousEnding, fallbackCharacterStates, fallbackForeshadowingStates, fallbackTimeline, relatedSettings, canonRules, writingStyle, searchResults, graphSearchResults, revisionFeedback, cognitionText, characterAuras, soulDoc] = await Promise.all([
    readOutlineContent(pp),
    readChapterOutlineContent(pp, resolvedChapterNumber),
    readVolumeContext(pp, resolvedChapterNumber),
    readSnapshotContext(pp, resolvedChapterNumber, recentSummaryWindow, snapshotLookback),
    readRecentChapterSummaries(pp, recentSummaryWindow),
    readPreviousChapterEnding(pp, resolvedChapterNumber),
    readCharacterStates(pp),
    readForeshadowingStates(pp),
    readTimeline(pp),
    readRelatedSettings(pp),
    readCanonRules(pp),
    readWritingStyle(pp),
    searchRelevantContentUnified(pp, task, resolvedChapterNumber, searchTopK),
    searchGraphRelevantContent(pp, task, resolvedChapterNumber),
    loadRevisionFeedbackForContext(pp, resolvedChapterNumber, revisionFeedbackWindowConfig),
    readCognitionStates(pp),
    buildCharacterAuraContext(pp, task),
    readSoulDoc(pp),           // 新增：项目级灵魂文档
  ])
```

- [ ] **Step 3: 在 return 对象中输出 soulDoc**

在返回的 ContextPack 对象（第 107-134 行）中添加 `soulDoc`：

```typescript
  return {
    task,
    chapterGoal,
    outline: mergedOutline,
    recentSummaries,
    previousChapterEnding,
    characterStates,
    soulDoc,                   // 新增
    characterAuras,
    cognitionStates: cognitionText,
    foreshadowingStates,
    timeline,
    relatedSettings,
    canonRules,
    writingStyle,
    searchResults,
    graphSearchResults,
    mustDo: buildMustDo(chapterGoal, previousChapterEnding, foreshadowingStates),
    mustAvoid: buildMustAvoid(canonRules, timeline, characterStates),
    nextChapterAdvice: buildNextChapterAdvice({...}),
    revisionDirectives,
  }
```

- [ ] **Step 4: 调整 SECTION_PRIORITY 为新字段添加优先级**

```typescript
const SECTION_PRIORITY: Record<string, number> = {
  "当前任务": 1,
  "当前章节目标": 2,
  "项目灵魂": 3,           // 新增：高优先级，位于大纲之前
  "大纲要求": 4,            // 从 3 变为 4
  "禁止违背": 5,            // 从 4 变为 5
  "最近剧情摘要": 6,        // 从 5 变为 6
  "上一章结尾": 7,          // 从 6 变为 7
  "当前人物状态": 8,        // 从 7 变为 8
  "角色灵魂": 9,            // 从 8 变为 9
  "当前伏笔状态": 10,       // 从 9 变为 10
  "时间线": 11,             // 从 10 变为 11
  "角色认知状态": 12,       // 从 11 变为 12
  "相关地点/组织/物品": 13, // 从 12 变为 13
  "相关记忆检索": 14,       // 从 13 变为 14
  "修改反馈": 15,           // 从 14 变为 15
  "下一章推进建议": 16,     // 从 15 变为 16
  "写作风格": 17,           // 从 16 变为 17
}
```

- [ ] **Step 5: 在 FIELD_CONFIGS 和 contextPackToPrompt 中添加 soulDoc**

在 `FIELD_CONFIGS` 数组（第 786-805 行）中添加：

```typescript
const FIELD_CONFIGS: FieldConfig[] = [
  { titleKey: "novel.contextPack.currentChapterGoal", fieldKey: "chapterGoal" },
  { titleKey: "novel.contextPack.mustDo.title", fieldKey: "mustDo" },
  { titleKey: "novel.contextPack.mustAvoid.title", fieldKey: "mustAvoid" },
  { titleKey: "novel.contextPack.nextChapterAdvice.title", fieldKey: "nextChapterAdvice" },
  { titleKey: "novel.contextPack.recentRevisionDirectives", fieldKey: "revisionDirectives" },
  { titleKey: "novel.contextPack.soulDoc", fieldKey: "soulDoc" },            // 新增
  { titleKey: "novel.contextPack.requiredOutline", fieldKey: "outline" },
  { titleKey: "novel.contextPack.recentPlotSummaries", fieldKey: "recentSummaries" },
  { titleKey: "novel.contextPack.previousChapterEnding", fieldKey: "previousChapterEnding" },
  { titleKey: "novel.contextPack.characterStates", fieldKey: "characterStates" },
  { titleKey: "novel.contextPack.characterAuras", fieldKey: "characterAuras" },
  { titleKey: "novel.contextPack.cognitionStates", fieldKey: "cognitionStates" },
  { titleKey: "novel.contextPack.foreshadowingStates", fieldKey: "foreshadowingStates" },
  { titleKey: "novel.contextPack.timeline", fieldKey: "timeline" },
  { titleKey: "novel.contextPack.relatedSettings", fieldKey: "relatedSettings" },
  { titleKey: "novel.contextPack.canonRules", fieldKey: "canonRules" },
  { titleKey: "novel.contextPack.writingStyle", fieldKey: "writingStyle" },
  { titleKey: "novel.contextPack.searchResults", fieldKey: "searchResults" },
  { titleKey: "novel.contextPack.graphSearchResults", fieldKey: "graphSearchResults" },
]
```

- [ ] **Step 6: 更新 emptyPack 函数**

```typescript
function emptyPack(task: string): ContextPack {
  return {
    task,
    chapterGoal: "",
    outline: "",
    recentSummaries: [],
    previousChapterEnding: "",
    characterStates: "",
    soulDoc: "",              // 新增
    characterAuras: "",
    cognitionStates: "",
    foreshadowingStates: "",
    timeline: "",
    relatedSettings: "",
    canonRules: "",
    writingStyle: "",
    searchResults: "",
    graphSearchResults: "",
    mustDo: "",
    mustAvoid: "",
    nextChapterAdvice: "",
    revisionDirectives: "",
  }
}
```

- [ ] **Step 7: 验证上下文构建流程**

Run: `npx vitest run src/lib/novel/ --reporter=verbose 2>&1 | Select-String -Pattern "context|ContextPack|soul"`

Expected: 无类型错误，构建通过

- [ ] **Step 8: Commit**

```bash
git add src/lib/novel/context-engine.ts
git commit -m "feat: context-engine 集成 soul.md 读取 — 优先级高于大纲"
```

---

### Task 3: i18n 文案更新

**Files:**
- Modify: `src/i18n/zh.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: 更新 zh.json 导航标签**

```jsonc
// src/i18n/zh.json — nav 区域（约第 765-775 行）
"nav": {
  "wiki": "章节库",
  "sources": "大纲",
  "search": "剧情搜索",
  "graph": "小说图谱",
  "lint": "连贯性检查",
  "review": "AI 审稿",
  "characterAura": "灵魂",     // 从 "角色灵魂" 改为 "灵魂"
  "settings": "模型与写作设置",
  "switchProject": "切换项目"
},
```

同时更新顶部的 `"nav"` 对象（第 6-17 行）：

```jsonc
"nav": {
  "wiki": "Wiki",
  "sources": "资料库",
  "search": "全局搜索",
  "graph": "关系图谱",
  "lint": "语法检查",
  "review": "审稿系统",
  "characterAura": "灵魂",     // 从 "角色灵魂" 改为 "灵魂"
  "settings": "设置"
},
```

- [ ] **Step 2: 新增 zh.json 的 soul 相关文案**

在 `novel` 段落中添加 `soul` 区块（约第 775 行之后）：

```jsonc
"soul": {
  "projectSoul": "项目灵魂",
  "characterSoul": "角色灵魂",
  "projectSoulDesc": "定义整个写作 AI 的气质、叙事节奏和语言风格",
  "projectSoulPlaceholder": "在此编写项目级的写作灵魂描述...\n\n例如：\n- 叙事节奏：快节奏，每章 3-5 个场景切换\n- 语言风格：简洁克制，避免华丽修辞\n- 叙述气质：冷静、客观、少用感叹号\n- 密度控制：每 500 字至少包含一个新信息点",
  "saveProjectSoul": "保存项目灵魂",
  "saveProjectSoulSuccess": "项目灵魂已保存",
  "saveProjectSoulFailed": "项目灵魂保存失败，请检查项目文件权限后重试"
},
```

- [ ] **Step 3: 新增 contextPack 的 soulDoc 标题**

在 `contextPack` 区块中新增：

```jsonc
"soulDoc": "## 项目灵魂",
```

- [ ] **Step 4: 更新 en.json（同上，英文版本）**

```jsonc
// nav 区域
"characterAura": "Soul",     // 从 "角色灵魂" 改为 "Soul"

// soul 区块
"soul": {
  "projectSoul": "Project Soul",
  "characterSoul": "Character Soul",
  "projectSoulDesc": "Define the overall writing AI's temperament, narrative rhythm and language style",
  "projectSoulPlaceholder": "Write your project-level writing soul description here...\n\nFor example:\n- Narrative rhythm: Fast-paced, 3-5 scene transitions per chapter\n- Language style: Concise and restrained, avoid ornate rhetoric\n- Narrative temperament: Calm, objective, minimize exclamation marks\n- Density control: At least one new information point per 500 words",
  "saveProjectSoul": "Save Project Soul",
  "saveProjectSoulSuccess": "Project soul saved",
  "saveProjectSoulFailed": "Failed to save project soul, check project file permissions"
},
"contextPack": {
  "soulDoc": "## Project Soul",
}
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/zh.json src/i18n/en.json
git commit -m "feat: i18n 文案 — 角色灵魂更名为灵魂，新增项目灵魂文案"
```

---

### Task 4: UI 改造 — 导航标签 + 双 Tab 布局

**Files:**
- Create: `src/components/novel/soul-doc-editor.tsx`
- Modify: `src/components/novel/character-aura-view.tsx`

- [ ] **Step 1: 创建 soul-doc-editor 组件**

```tsx
// src/components/novel/soul-doc-editor.tsx
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWikiStore } from "@/stores/wiki-store"
import { readSoulDoc, writeSoulDoc } from "@/lib/novel/soul-doc"
import i18n from "@/i18n"

export function SoulDocEditor() {
  const project = useWikiStore((s) => s.project)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!project) return
    readSoulDoc(project.path).then(setContent).catch(() => setContent(""))
  }, [project?.path])

  async function handleSave() {
    if (!project) return
    setSaving(true)
    try {
      await writeSoulDoc(project.path, content)
      setMessage(i18n.t("novel.soul.saveProjectSoulSuccess"))
    } catch {
      setMessage(i18n.t("novel.soul.saveProjectSoulFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (!project) return null

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <Label>{i18n.t("novel.soul.projectSoul")}</Label>
        <p className="text-sm text-muted-foreground mt-1">
          {i18n.t("novel.soul.projectSoulDesc")}
        </p>
      </div>
      <Textarea
        className="min-h-[300px] font-mono text-sm"
        placeholder={i18n.t("novel.soul.projectSoulPlaceholder")}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving || content.trim() === ""}>
          {saving ? "..." : i18n.t("novel.soul.saveProjectSoul")}
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 修改 character-aura-view.tsx — 添加项目/角色双 Tab**

在 `CharacterAuraView` 组件开头添加一个顶层 tab 状态和 UI：

```tsx
// 在现有 state 声明之后（约第 133 行 setMessage 之后）添加：
const [soulTab, setSoulTab] = useState<"project" | "character">("project")
```

在组件 return 的 JSX 最外层包裹 Tab 切换：

```tsx
// 在 return 的 JSX 最外层添加
return (
  <div className="flex flex-col h-full">
    {/* Tab 切换栏 */}
    <div className="flex border-b">
      <button
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
          soulTab === "project"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setSoulTab("project")}
      >
        {i18n.t("novel.soul.projectSoul")}
      </button>
      <button
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
          soulTab === "character"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setSoulTab("character")}
      >
        {i18n.t("novel.soul.characterSoul")}
      </button>
    </div>

    {/* 内容区域 */}
    <div className="flex-1 overflow-auto">
      {soulTab === "project" ? (
        <SoulDocEditor />
      ) : (
        <>
          {/* 原有的 CharacterAuraView 内容放在这里 */}
          {/* ... 原有 JSX ... */}
        </>
      )}
    </div>
  </div>
)
```

同时在顶部 import 中添加：

```tsx
import { SoulDocEditor } from "./soul-doc-editor"
```

- [ ] **Step 3: 验证 — 用书签测试**

手动验证步骤：
1. `npm run dev` 启动开发服务器
2. 打开任意项目，点击左侧 `Sparkles` 图标
3. 确认顶部显示两个 Tab：「项目灵魂」「角色灵魂」
4. 点击「项目灵魂」，看到空白文本编辑区（soul.md 不存在时）
5. 输入文字如 `幽默风趣，快节奏叙事`
6. 点击「保存项目灵魂」
7. 确认项目根目录生成 `soul.md` 文件，内容正确
8. 点击「角色灵魂」，确认原有功能完整（内置/自定义列表、绑定、预览等）

- [ ] **Step 4: Commit**

```bash
git add src/components/novel/soul-doc-editor.tsx src/components/novel/character-aura-view.tsx
git commit -m "feat: UI — 灵魂模块双 Tab 布局，项目灵魂编辑器"
```

---

### Task 5: 角色灵魂提示词措辞更新

**Files:**
- Modify: `src/lib/novel/character-aura.ts`

`buildCharacterAuraContext` 函数末尾有一行硬编码中文提示词。修改使其更精确，避免与项目 soul.md 混淆：

- [ ] **Step 1: 修改 buildCharacterAuraContext 中的措辞**

```typescript
// character-aura.ts 第 514 行
// 修改前：
// lines.push("- 灵魂必须服从大纲、人物小传、角色认知和正史规则，不得覆盖或改写硬性设定。")

// 修改后：
lines.push("- 角色灵魂必须服从大纲、人物小传、角色认知和正史规则，不得覆盖或改写硬性设定。")
```

- [ ] **Step 2: 检查测试是否通过**

Run: `npx vitest run src/lib/novel/ --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|error" | Select-Object -First 20`

Expected: 所有已有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/character-aura.ts
git commit -m "fix: 角色灵魂上下文 — 措辞精确化，区分项目 soul.md"
```

---

### Task 6: mod.ts 导出更新

**Files:**
- Modify: `src/lib/novel/mod.ts`

- [ ] **Step 1: 添加 soul-doc 模块导出**

```typescript
// src/lib/novel/mod.ts — 在文件末尾追加
export { readSoulDoc, writeSoulDoc, SOUL_DOC_FILENAME } from "./soul-doc"
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "error" | Select-Object -First 5`

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/novel/mod.ts
git commit -m "feat: mod.ts — 导出 soul-doc 模块"
```

---

### Task 7: 全链路验证

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`
Expected: 所有已有测试 + 新增测试 PASS

- [ ] **Step 2: 手动验证 soul.md 注入**

1. 在项目中创建 `soul.md`，写入 `测试：幽默叙事风格，每章至少三个笑点`
2. 在聊天中发一条写作指令（如 `写下一章`）
3. 检查 LLM 请求日志（或通过开发者工具），确认 system prompt 中包含 `## 项目灵魂\n测试：幽默叙事风格，每章至少三个笑点`
4. 确认「项目灵魂」位于「大纲要求」之前（优先级 3 vs 4）

- [ ] **Step 3: 验证旧功能无回退**

操作清单：
- [ ] 左侧导航「灵魂」标签正常显示
- [ ] 点击后默认显示「项目灵魂」Tab
- [ ] 切换到「角色灵魂」Tab
- [ ] 内置角色灵魂列表正常显示
- [ ] 自定义灵魂 6 步工作流正常执行（创建一个测试灵魂）
- [ ] 角色灵魂绑定/解绑正常
- [ ] 预览「灵魂注入」正常（输入含已绑定角色名的任务）
- [ ] 灵魂删除功能正常

- [ ] **Step 4: 可视化检查 ContextPack 输出**

在 `contextPackToPrompt` 返回之前添加临时日志行（仅验证用，验证后删除）：

```typescript
// 临时验证日志
if (pack.soulDoc) {
  console.log("[soul-doc] injected", pack.soulDoc.slice(0, 100))
}
```

---

### Task 8: 分支收尾 — 合并到 master

- [ ] **Step 1: 确认所有改动已提交**

```bash
git log --oneline feature/soul-module ^master
```

Expected: 列出 6 个 commit（soul-doc 模块、context-engine 集成、i18n、UI、提示词、mod.ts）

- [ ] **Step 2: 切回 master 合并**

```bash
git checkout master
git merge feature/soul-module --no-ff
```

- [ ] **Step 3: 验证 master 分支可正常运行**

Run: `npx vitest run`

Expected: 全部 PASS

- [ ] **Step 4: 删除 feature 分支（可选）**

```bash
git branch -d feature/soul-module
```

---

## 改动点汇总

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/lib/novel/soul-doc.ts` | **新建** | soul.md 读写模块 |
| `src/lib/novel/soul-doc.test.ts` | **新建** | soul-doc 单元测试 |
| `src/components/novel/soul-doc-editor.tsx` | **新建** | 项目灵魂编辑器组件 |
| `src/lib/novel/context-engine.ts` | **修改** | ContextPack 新增 soulDoc 字段 + reading + SECTION_PRIORITY 重排 + FIELD_CONFIGS |
| `src/components/novel/character-aura-view.tsx` | **修改** | 顶部双 Tab 切换 + SoulDocEditor 引入 |
| `src/lib/novel/character-aura.ts` | **修改** | buildCharacterAuraContext 提示词措辞更新（1 行） |
| `src/i18n/zh.json` | **修改** | nav 标签改名 + 新增 soul 文案区块 + contextPack soulDoc 标题 |
| `src/i18n/en.json` | **修改** | 同上英文版 |
| `src/lib/novel/mod.ts` | **修改** | 新增 soul-doc 模块导出 |

共 **3 新建文件、6 修改文件**，不涉及任何已有功能的删除或重构。

---

## 自审清单

1. **Spec 覆盖**：project soul.md 读写 ✅ / context-engine 注入 ✅ / 优先级高于大纲 ✅ / UI 双 Tab ✅ / i18n 中英文 ✅ / mod.ts 导出 ✅
2. **占位符扫描**：无 "TBD"、"TODO"、"implement later" — 已确认
3. **类型一致性**：`soulDoc: string` 在 ContextPack、FIELD_CONFIGS、emptyPack 中一致 — 已确认
4. **无死代码**：`readSoulDoc` 在 context-engine.ts 中使用，`writeSoulDoc` 在 soul-doc-editor.tsx 中使用 — 已确认
5. **无删除已有函数**：所有改动均为新增或小范围修改 — 已确认