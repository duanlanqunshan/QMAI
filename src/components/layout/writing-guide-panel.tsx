import { useState, useCallback } from "react"
import { FileText, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { OutlineChatPanel } from "@/components/sources/outline-chat-panel"
import { useWikiStore } from "@/stores/wiki-store"
import { useChatStore, chatMessagesToLLM } from "@/stores/chat-store"
import { streamChat } from "@/lib/llm-client"
import { readSelectedChapterNumberForFile } from "@/lib/novel/chapter-utils"
import { listDirectory, readFile } from "@/commands/fs"
import { hasUsableLlm } from "@/lib/has-usable-llm"
import { buildContextPack, contextPackToPrompt, readChapterOutlineContent } from "@/lib/novel/context-engine"
import { normalizePath } from "@/lib/path-utils"

type OutlineNode = {
  name: string
  path: string
  is_dir: boolean
  children?: OutlineNode[]
}

function flattenMarkdownFiles(nodes: OutlineNode[]): Array<{ name: string; path: string }> {
  const files: Array<{ name: string; path: string }> = []
  for (const node of nodes) {
    if (node.is_dir) {
      if (node.children) files.push(...flattenMarkdownFiles(node.children))
      continue
    }
    if (node.name.toLowerCase().endsWith(".md")) {
      files.push({ name: node.name, path: node.path })
    }
  }
  return files
}

async function readOutlineFolderContent(projectPath: string, folderNames: string[], limit = 2): Promise<string> {
  const pp = normalizePath(projectPath)
  for (const folderName of folderNames) {
    try {
      const tree = await listDirectory(`${pp}/wiki/outlines/${folderName}`)
      const files = flattenMarkdownFiles(tree).slice(0, limit)
      if (files.length === 0) continue
      const contents = await Promise.all(
        files.map(async (file) => {
          const content = await readFile(file.path).catch(() => "")
          if (!content.trim()) return ""
          return `【${folderName} / ${file.name.replace(/\.md$/i, "")}】\n${content.slice(0, 1800).trim()}`
        }),
      )
      const merged = contents.filter(Boolean).join("\n\n---\n\n")
      if (merged.trim()) return merged
    } catch {
      // ignore missing outline folder
    }
  }
  return ""
}

async function loadComposerAutoContext(projectPath: string, chapterNumber?: number): Promise<{
  chapterOutline: string
  includeElements: string
}> {
  const chapterOutline = chapterNumber ? await readChapterOutlineContent(projectPath, chapterNumber) : ""
  const blocks = await Promise.all([
    readOutlineFolderContent(projectPath, ["人物小传"]),
    readOutlineFolderContent(projectPath, ["组织势力设定", "势力设定"]),
    readOutlineFolderContent(projectPath, ["金手指与能力体系", "能力体系"]),
    readOutlineFolderContent(projectPath, ["伏笔计划"]),
    readOutlineFolderContent(projectPath, ["地点设定"]),
  ])

  return {
    chapterOutline,
    includeElements: blocks.filter(Boolean).join("\n\n---\n\n"),
  }
}

export function WritingGuidePanel() {
  const project = useWikiStore((s) => s.project)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const llmConfig = useWikiStore((s) => s.llmConfig)

  const [showChapterComposer, setShowChapterComposer] = useState(false)
  const [composerChapterNumber, setComposerChapterNumber] = useState("")
  const [composerChapterTitle, setComposerChapterTitle] = useState("")
  const [composerStoryGoal, setComposerStoryGoal] = useState("")
  const [composerPerspectiveChar, setComposerPerspectiveChar] = useState("")
  const [composerIncludeElements, setComposerIncludeElements] = useState("")
  const [composerExcludeElements, setComposerExcludeElements] = useState("")
  const [composerStyleReq, setComposerStyleReq] = useState("")
  const [composerOutline, setComposerOutline] = useState("")
  const [composerAutoLoaded, setComposerAutoLoaded] = useState("")

  const handleOpenChapterComposer = useCallback(async () => {
    let detectedChapterNumber: number | undefined
    setComposerChapterNumber("")
    setComposerChapterTitle("")
    setComposerStoryGoal("")
    setComposerPerspectiveChar("")
    setComposerIncludeElements("")
    setComposerExcludeElements("")
    setComposerStyleReq("")
    setComposerOutline("")
    setComposerAutoLoaded("")
    if (selectedFile) {
      try {
        const outNum = await readSelectedChapterNumberForFile(selectedFile)
        if (outNum) {
          detectedChapterNumber = outNum
          setComposerChapterNumber(String(outNum))
        }
      } catch {}
      try {
        const content = await readFile(selectedFile)
        if (content) {
          const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m) ?? content.match(/^#\s+(.+)$/m)
          if (titleMatch?.[1]) setComposerChapterTitle(titleMatch[1].trim())
        }
      } catch {}
    }
    if (project) {
      try {
        const autoContext = await loadComposerAutoContext(project.path, detectedChapterNumber)
        if (autoContext.chapterOutline.trim()) {
          setComposerOutline(autoContext.chapterOutline)
        }
        if (autoContext.includeElements.trim()) {
          setComposerIncludeElements(autoContext.includeElements)
        }
        const loadedLabels: string[] = []
        if (autoContext.chapterOutline.trim()) loadedLabels.push("章节细纲")
        if (autoContext.includeElements.trim()) loadedLabels.push("人物/势力/能力/伏笔/地点设定")
        if (loadedLabels.length > 0) {
          setComposerAutoLoaded(`已自动载入：${loadedLabels.join("、")}。你可以继续手动修改。`)
        }
      } catch {}
    }
    setShowChapterComposer(true)
  }, [project, selectedFile])

  const handleChapterComposerSend = useCallback(async () => {
    if (!hasUsableLlm(llmConfig)) return
    setShowChapterComposer(false)

    const parts: string[] = []
    if (composerChapterNumber.trim()) parts.push(`章节号：第${composerChapterNumber.trim()}章`)
    if (composerChapterTitle.trim()) parts.push(`章节标题：${composerChapterTitle.trim()}`)
    if (composerStoryGoal.trim()) parts.push(`故事目标：${composerStoryGoal.trim()}`)
    if (composerPerspectiveChar.trim()) parts.push(`视角人物：${composerPerspectiveChar.trim()}`)
    if (composerIncludeElements.trim()) parts.push(`需要包含的元素：${composerIncludeElements.trim()}`)
    if (composerExcludeElements.trim()) parts.push(`禁止出现/偏离：${composerExcludeElements.trim()}`)
    if (composerStyleReq.trim()) parts.push(`风格要求：${composerStyleReq.trim()}`)
    if (composerOutline.trim()) parts.push(`章节大纲参考：\n${composerOutline.trim()}`)
    if (parts.length === 0) return

    const prompt = "请根据以下章纲要求写作本章内容：\n\n" + parts.join("\n\n")

    const store = useChatStore.getState()
    store.addMessage("user", prompt, { taskLabel: "章纲写作" })
    store.setStreaming(true)
    store.setStreamingContent("")

    const messages = chatMessagesToLLM(store.getActiveMessages())
    let result = ""
    try {
      const llmMessages = [...messages]
      if (project) {
        const chapterNumber = Number.parseInt(composerChapterNumber.trim(), 10)
        const contextPack = await buildContextPack(
          project.path,
          prompt,
          Number.isFinite(chapterNumber) && chapterNumber > 0 ? chapterNumber : undefined,
        )
        const novelConfig = useWikiStore.getState().novelConfig
        const budget = novelConfig.contextTokenBudget > 0 ? novelConfig.contextTokenBudget : undefined
        llmMessages.unshift({
          role: "system",
          content: [
            "你是一个专业的小说写作助手。请根据提供的小说上下文包和章节内容，协助用户进行小说创作。",
            "",
            "## 小说章节输出规则",
            "- 如果用户要求生成、续写或改写章节，只输出可直接放入章节库的小说正文。",
            "- 不要输出资料说明、创作说明、免责声明、后续建议、引用列表或隐藏 cited 注释。",
            "- 不要在小说正文里写 [[资料名]]、[1]、[2] 这类资料引用标记。",
            "- 资料只作为内部参考，不能把资料库缺失、基于现有资料等元信息写进章节。",
            "",
            contextPackToPrompt(contextPack, budget),
          ].join("\n"),
        })
      }

      await streamChat(llmConfig, llmMessages, {
        onToken: (token) => {
          result += token
          store.setStreamingContent(result)
        },
        onDone: () => {
          store.finalizeStream(result, [])
        },
        onError: (error) => {
          console.error("章纲写作失败:", error)
          store.finalizeStream(result || `错误: ${error.message}`, [])
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      store.finalizeStream(`错误: ${message}`, [])
    }
  }, [llmConfig, project, composerChapterNumber, composerChapterTitle, composerStoryGoal, composerPerspectiveChar, composerIncludeElements, composerExcludeElements, composerStyleReq, composerOutline])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">章纲与要求</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" size="sm" onClick={handleOpenChapterComposer} className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  章纲写作
                </Button>
              </TooltipTrigger>
              <TooltipContent>填写章纲要求，AI 基于此生成写作</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <OutlineChatPanel />
      </div>

      <Dialog open={showChapterComposer} onOpenChange={setShowChapterComposer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>章纲写作</DialogTitle>
            <DialogDescription>
              填写以下字段来指导AI写作本章内容。留空的字段将不会被注入提示词。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 overflow-y-auto max-h-[60vh] pr-1">
            {composerAutoLoaded ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                {composerAutoLoaded}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wg-chap-num">章节号</Label>
                <Input
                  id="wg-chap-num"
                  placeholder="如：12"
                  value={composerChapterNumber}
                  onChange={(e) => setComposerChapterNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wg-chap-title">章节标题</Label>
                <Input
                  id="wg-chap-title"
                  placeholder="如：暗流涌动"
                  value={composerChapterTitle}
                  onChange={(e) => setComposerChapterTitle(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wg-story-goal">故事目标</Label>
              <Input
                id="wg-story-goal"
                placeholder="本章需要达成的叙事目标，如：揭示B角色的真实身份"
                value={composerStoryGoal}
                onChange={(e) => setComposerStoryGoal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wg-perspective-char">视角人物</Label>
              <Input
                id="wg-perspective-char"
                placeholder="本章以谁的视角展开叙事"
                value={composerPerspectiveChar}
                onChange={(e) => setComposerPerspectiveChar(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wg-include-elements">需要包含的元素（写作约束）</Label>
              <Textarea
                id="wg-include-elements"
                placeholder="本章必须包含的情节元素或写作要求，每行一个"
                rows={2}
                value={composerIncludeElements}
                onChange={(e) => setComposerIncludeElements(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wg-exclude-elements">禁止出现 / 禁止偏离（写作警戒线）</Label>
              <Textarea
                id="wg-exclude-elements"
                placeholder="本章不得出现的内容或不得偏离的方向，每行一个"
                rows={2}
                value={composerExcludeElements}
                onChange={(e) => setComposerExcludeElements(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wg-style-req">风格要求</Label>
              <Input
                id="wg-style-req"
                placeholder="如：对白要简洁有力，环境描写需渲染紧张氛围"
                value={composerStyleReq}
                onChange={(e) => setComposerStyleReq(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wg-composer-outline">章节大纲（文本参考）</Label>
              <Textarea
                id="wg-composer-outline"
                placeholder="直接粘贴或编写本章的大纲内容"
                rows={6}
                value={composerOutline}
                onChange={(e) => setComposerOutline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowChapterComposer(false)}>
              取消
            </Button>
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <Button onClick={handleChapterComposerSend} disabled={!composerChapterNumber.trim() && !composerChapterTitle.trim() && !composerOutline.trim()}>
                      发起AI写作
                    </Button>
                  )}
                />
                <TooltipContent>将以上要求组织为提示词，发送到当前AI会话</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
