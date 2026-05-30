# Bug 修复与功能增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 5 个 Bug 并增强大纲生成功能

**Architecture:** 外科手术式修改，每个 Bug 独立修复，互不影响。Bug 3（大纲多选生成）是功能增强，需要新增 UI 交互。

**Tech Stack:** React 19 + TypeScript + Zustand 5 + Sigma.js 3 + @sigma/edge-curve

---

## Bug 1: 快照生成失败 — `hasUsableLlm` 不检查 model 字段

**根因分析：**
1. `hasUsableLlm()` 只检查 `provider` 和 `apiKey`，不检查 `model` 是否为空
2. 当用户配置了 provider + apiKey 但 model 为空时，`hasUsableLlm` 返回 `true`
3. `streamChat` 发出无效请求（model 为空），API 返回错误，快照生成失败
4. `preview-panel.tsx` 直接调用 `ingestChapter` 而非 `ingestChapterPipeline`，`reviewModel` 配置被忽略

**Files:**
- Modify: `src/lib/has-usable-llm.ts`
- Modify: `src/components/layout/preview-panel.tsx`

- [ ] **Step 1: 修改 `hasUsableLlm` 增加 model 检查**

文件: `src/lib/has-usable-llm.ts`

将函数签名从 `Pick<LlmConfig, "provider" | "apiKey">` 扩展为包含 `model`，并增加 model 非空检查：

```typescript
export function hasUsableLlm(
  cfg: Pick<LlmConfig, "provider" | "apiKey" | "model">,
): boolean {
  if (PROVIDERS_WITHOUT_KEY.has(cfg.provider)) return true
  return cfg.apiKey.trim().length > 0 && cfg.model.trim().length > 0
}
```

- [ ] **Step 2: 修改 `preview-panel.tsx` 传递 `reviewModel` 参数**

文件: `src/components/layout/preview-panel.tsx`

在 `handleSaveAsFinal` 和 `handleReingest` 中，通过 `ingestChapterPipeline` 调用而非直接调用 `ingestChapter`，确保 `reviewModel` 配置生效。

在 `handleSaveAsFinal` 中（约第 543 行）：
```typescript
// 修改前:
const snapshot = await ingestChapter(project.path, targetPath)
// 修改后:
const snapshot = await ingestChapter(project.path, targetPath, resolveReviewModel())
```

在 `handleReingest` 中（约第 571 行）：
```typescript
// 修改前:
const snapshot = await ingestChapter(project.path, selectedFile)
// 修改后:
const snapshot = await ingestChapter(project.path, selectedFile, resolveReviewModel())
```

同时在文件顶部添加 import：
```typescript
import { resolveReviewModel } from "@/lib/novel/review-model"
```

- [ ] **Step 3: 验证**

运行 `node node_modules/typescript/bin/tsc --build --pretty` 确认无类型错误。

---

## Bug 2: 加入大纲列表替换章节内容

**根因分析：**
1. `addOutlineFileToSourceList` 调用 `bumpDataVersion()` 触发全局重渲染
2. 重渲染可能导致 `preview-panel.tsx` 的 `flushChapterBeforeLeave` 被触发
3. 如果当前编辑器中显示的是大纲内容但 `selectedFile` 仍指向章节文件，auto-save 会将大纲内容写入章节文件
4. `canAddCurrentOutlineToList` 不验证文件是否真的是大纲，任何 markdown 文件都可以被加入

**Files:**
- Modify: `src/lib/novel/outline-generation.ts`
- Modify: `src/components/sources/sources-view.tsx`

- [ ] **Step 1: 修改 `addOutlineFileToSourceList` 移除 `bumpDataVersion` 调用**

文件: `src/lib/novel/outline-generation.ts`（约第 505-519 行）

`setFileTree` 已经足够触发文件树更新，`bumpDataVersion` 是多余的且会导致不必要的全局重渲染。移除 `bumpDataVersion` 调用：

```typescript
export async function addOutlineFileToSourceList(projectPath: string, outlinePath: string): Promise<string> {
  const pp = normalizePath(projectPath)
  const normalizedOutlinePath = normalizePath(outlinePath)
  const sourcesDir = `${pp}/raw/sources`
  await createDirectory(sourcesDir)

  const content = await readFile(normalizedOutlinePath)
  const targetPath = await getUniqueSourceListPath(pp, getFileName(normalizedOutlinePath))
  await writeFile(targetPath, content)

  const tree = await listDirectory(pp)
  useWikiStore.getState().setFileTree(tree)
  return targetPath
}
```

- [ ] **Step 2: 修改 `canAddCurrentOutlineToList` 增加大纲路径验证**

文件: `src/components/sources/sources-view.tsx`（约第 20-25 行）

```typescript
const canAddCurrentOutlineToList = Boolean(
  novelMode &&
  project?.path &&
  selectedFile &&
  getFileCategory(selectedFile) === "markdown" &&
  isOutlinePath(selectedFile),
)
```

同时在文件顶部添加 `isOutlinePath` 的 import（如果尚未导入）：
```typescript
import { isOutlinePath } from "@/lib/novel/chapter-meta"
```

- [ ] **Step 3: 验证**

运行 `node node_modules/typescript/bin/tsc --build --pretty` 确认无类型错误。

---

## Bug 3: 大纲多选生成功能

**需求分析：**
用户希望在打开大纲后，能够自由选中大纲中的多个章节/段落，然后根据选中的内容生成相关内容。

**实现方案：**
在 `outline-generator-dialog.tsx` 的细化模式中，解析大纲内容为可选择的章节列表，支持多选，根据选中的章节生成内容。

**Files:**
- Modify: `src/components/sources/outline-generator-dialog.tsx`
- Modify: `src/lib/novel/outline-generation.ts`

- [ ] **Step 1: 在 `outline-generator-dialog.tsx` 中添加大纲章节解析和多选 UI**

1. 添加 `parseOutlineSections` 函数，从大纲 Markdown 内容中解析出章节标题列表：
```typescript
function parseOutlineSections(content: string): string[] {
  const lines = content.split("\n")
  const sections: string[] = []
  for (const line of lines) {
    const match = line.match(/^#{1,4}\s+(.+)/)
    if (match) sections.push(match[1].trim())
  }
  return sections
}
```

2. 在细化模式（`mode === "refine"`）的 UI 中，当有已生成大纲时，显示章节选择列表：
```tsx
{mode === "refine" && latestTask?.outlinePath && outlineSections.length > 0 && (
  <div className="space-y-1 rounded-md border bg-card p-2 text-xs">
    <div className="text-muted-foreground mb-1">选择要细化的章节：</div>
    {outlineSections.map((section, idx) => (
      <label key={idx} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={selectedSections.has(section)}
          onChange={(e) => {
            const next = new Set(selectedSections)
            if (e.target.checked) next.add(section)
            else next.delete(section)
            setSelectedSections(next)
          }}
          className="h-3 w-3 rounded"
        />
        <span>{section}</span>
      </label>
    ))}
  </div>
)}
```

3. 添加状态变量：
```typescript
const [outlineSections, setOutlineSections] = useState<string[]>([])
const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
```

4. 当 `latestTask` 变化且有大纲内容时，解析章节列表：
```typescript
useEffect(() => {
  if (latestTask?.outlinePath && mode === "refine") {
    readFile(latestTask.outlinePath).then((content) => {
      setOutlineSections(parseOutlineSections(content))
    }).catch(() => setOutlineSections([]))
  }
}, [latestTask?.outlinePath, mode])
```

5. 修改 `handleRefine` 函数，将选中的章节信息传入 prompt：
```typescript
async function handleRefine() {
  if (!latestTask?.id || !project?.path || refining) return
  setRefining(true)
  try {
    const selectedList = Array.from(selectedSections)
    await refineOutlineSection(project.path, latestTask.id, section, {
      selectedSections: selectedList.length > 0 ? selectedList : undefined,
    })
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  } finally {
    setRefining(false)
  }
}
```

- [ ] **Step 2: 修改 `refineOutlineSection` 支持按选中章节生成**

文件: `src/lib/novel/outline-generation.ts`

修改 `refineOutlineSection` 函数，在构建 prompt 时加入选中章节信息，使 LLM 只针对选中章节生成细化内容：

```typescript
export async function refineOutlineSection(
  projectPath: string,
  taskId: string,
  sectionKey: string,
  options?: { selectedSections?: string[] },
): Promise<void> {
  // ...existing code...
  const selectedSections = options?.selectedSections
  // 在构建 prompt 时，如果有 selectedSections，将其加入提示词
  // 让 LLM 只针对选中的章节生成内容
}
```

- [ ] **Step 3: 验证**

运行 `node node_modules/typescript/bin/tsc --build --pretty` 确认无类型错误。

---

## Bug 4: 小说图谱"永久展开"选项隐藏

**根因分析：**
"永久展开"复选框被包裹在 `showEdgeControls` 条件渲染中，用户必须先点击"线条设置"按钮展开面板才能看到。用户期望"永久展开"作为独立选项始终可见。

**Files:**
- Modify: `src/components/layout/graph-sidebar-panel.tsx`

- [ ] **Step 1: 将"永久展开"复选框移到线条设置面板外部**

文件: `src/components/layout/graph-sidebar-panel.tsx`

将"永久展开"复选框从 `showEdgeControls` 条件渲染块内移到外部，使其始终可见：

```tsx
{/* 永久展开 - 始终可见 */}
<div className="flex items-center gap-2">
  <span className="text-muted-foreground whitespace-nowrap text-xs">永久展开</span>
  <input
    type="checkbox"
    checked={edgeLabelsAlwaysVisible}
    onChange={(e) => {
      const val = e.target.checked
      setEdgeLabelsAlwaysVisible(val)
      localStorage.setItem("lk-graph-edge-labels-always", val ? "true" : "false")
    }}
    className="h-3.5 w-3.5 rounded border-input"
  />
</div>

{/* 线条设置按钮 + 展开面板 */}
<div className="flex gap-2">
  <Button ...>过滤</Button>
  <Button ...>线条设置</Button>
</div>
{showEdgeControls && (
  <div className="space-y-2 rounded-md border bg-card p-2 text-xs">
    {/* 线型、颜色、强度 - 不再包含"永久展开" */}
  </div>
)}
```

- [ ] **Step 2: 验证**

运行 `node node_modules/typescript/bin/tsc --build --pretty` 确认无类型错误。

---

## Bug 5: 曲线避让没有效果

**根因分析：**
1. Sigma.js v3 不原生支持曲线边渲染
2. 当前 `EdgeCurveProgram = EdgeClampedProgram`，两者都是直线渲染器
3. `curvature: 0.25` 属性被设置但没有任何渲染器读取它
4. 需要安装 `@sigma/edge-curve` 包来获得真正的曲线渲染能力

**Files:**
- Modify: `package.json`（安装 `@sigma/edge-curve`）
- Modify: `src/components/graph/graph-view.tsx`

- [ ] **Step 1: 安装 `@sigma/edge-curve` 包**

```bash
npm install @sigma/edge-curve
```

- [ ] **Step 2: 修改 `graph-view.tsx` 使用真正的曲线渲染器**

文件: `src/components/graph/graph-view.tsx`

1. 修改 import：
```typescript
import {
  EdgeArrowProgram,
  EdgeClampedProgram,
  EdgeLineProgram,
} from "sigma/rendering"
import EdgeCurveProgram from "@sigma/edge-curve"
```

2. 删除旧的别名定义：
```typescript
// 删除: const EdgeCurveProgram = EdgeClampedProgram
```

3. 修改 `edgeTypeForStyle` 函数，"直线避让"使用 `EdgeLineProgram`：
```typescript
function edgeTypeForStyle(edgeStyle: GraphEdgeStyle): string {
  if (edgeStyle === "curve") return "curve"
  if (edgeStyle === "arrow") return "arrow"
  return "line"
}
```

4. 更新 `edgeProgramClasses`：
```typescript
edgeProgramClasses: {
  line: EdgeLineProgram,
  clamped: EdgeClampedProgram,
  curve: EdgeCurveProgram,
  arrow: EdgeArrowProgram,
},
```

5. 修改 `GraphLoader` 中边的 `curvature` 设置，仅在曲线模式下设置：
```typescript
graph.addEdgeWithKey(edgeKey, edge.source, edge.target, {
  color,
  size,
  weight: edge.weight,
  label: relationLabel,
  ...(edgeStyle === "curve" ? { curvature: 0.25 } : {}),
})
```

注意：`GraphLoader` 需要接收 `edgeStyle` 参数。当前它已经通过 props 接收了 `edgeLabelsAlwaysVisible`，需要同样添加 `edgeStyle`。

- [ ] **Step 3: 将 `edgeStyle` 传递给 GraphLoader**

在 `GraphLoader` 的 props 中添加 `edgeStyle`：
```typescript
function GraphLoader({
  // ...existing props...
  edgeStyle,
  edgeLabelsAlwaysVisible,
  // ...
}: {
  // ...existing types...
  edgeStyle: GraphEdgeStyle
  edgeLabelsAlwaysVisible: boolean
  // ...
})
```

在调用处添加 `edgeStyle` prop：
```tsx
<GraphLoader
  // ...existing props...
  edgeStyle={edgeStyle}
  edgeLabelsAlwaysVisible={edgeLabelsAlwaysVisible}
  // ...
/>
```

- [ ] **Step 4: 验证**

运行 `node node_modules/typescript/bin/tsc --build --pretty` 确认无类型错误。

---

## 最终验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
node node_modules/typescript/bin/tsc --build --pretty
```

- [ ] **Step 2: 运行 Vite 构建**

```bash
node node_modules/vite/bin/vite.js build
```

- [ ] **Step 3: 打包便携版 exe**

```bash
$env:CARGO_PROFILE_RELEASE_LTO='false'; $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS='16'; $env:CARGO_PROFILE_RELEASE_OPT_LEVEL='1'; node node_modules/@tauri-apps/cli/tauri.js build --no-bundle; node scripts/build-portable.mjs
```

- [ ] **Step 4: 功能验证清单**

| Bug | 验证方式 |
|-----|---------|
| Bug 1 | 配置 LLM（provider + apiKey + model），保存为正式章节，快照应成功生成 |
| Bug 2 | 生成大纲后点击"加入大纲列表"，章节内容不应被替换 |
| Bug 3 | 打开大纲后，应能看到章节选择列表，支持多选和生成 |
| Bug 4 | 图谱侧边栏应始终显示"永久展开"复选框 |
| Bug 5 | 图谱线条设置选择"曲线避让"时，边应显示为曲线 |
