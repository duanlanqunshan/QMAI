import { streamChat, type StreamCallbacks } from "@/lib/llm-client"
import i18n from "@/i18n"
import type { ChatMessage } from "@/lib/llm-providers"
import { useWikiStore } from "@/stores/wiki-store"
import { getOutputLanguage, buildLanguageReminder } from "@/lib/output-language"
import { contextPackToPrompt, buildContextPack, type ContextPack } from "./context-engine"
import { resolveNovelModel } from "./model-resolver"
import { hasUsableLlm } from "@/lib/has-usable-llm"

export interface NovelReviewResult {
  severity: "error" | "warning" | "info"
  type: string
  message: string
  evidence: string
  relatedMemory: string
  suggestion: string
}

const REVIEW_DIMENSIONS = [
  "是否违背总大纲",
  "是否违背分卷大纲",
  "是否违背章节目标",
  "本章必须完成项是否已完成",
  "本章避免违背项是否存在违背",
  "下一章推进建议是否被忽略或反向推进",
  "是否人设崩坏",
  "是否人物动机不一致",
  "是否时间线错误",
  "是否地点错误",
  "是否能力体系崩坏",
  "是否伏笔遗忘",
  "是否提前泄露秘密",
  "是否角色知道了不该知道的信息",
  "是否新增未登记设定",
  "是否剧情水文",
  "是否缺少章节钩子",
]

export function buildReviewPrompt(pack: ContextPack, chapterContent: string): string {
  return `${contextPackToPrompt(pack)}

${i18n.t("novel.reviewPrompt.reviewChapterInstruction")}
${REVIEW_DIMENSIONS.map((key, i) => `${i + 1}. ${i18n.t(key)}`).join("\n")}

${i18n.t("novel.reviewPrompt.specialChecksTitle")}
- ${i18n.t("novel.reviewPrompt.specialChecks.mustDo")}
- ${i18n.t("novel.reviewPrompt.specialChecks.mustAvoid")}
- ${i18n.t("novel.reviewPrompt.specialChecks.nextChapterAdvice")}

${i18n.t("novel.reviewPrompt.chapterContent")}
${chapterContent.slice(0, 8000)}

${i18n.t("novel.reviewPrompt.outputFormat")}
[
  {
    "severity": "error|warning|info",
    "type": "character_consistency|timeline|foreshadowing|setting|plot|style",
    "message": "问题描述",
    "evidence": "正文片段",
    "relatedMemory": "相关记忆引用",
    "suggestion": "修改建议"
  }
]

${i18n.t("novel.reviewPrompt.emptyArrayFallback")}`
}

export async function reviewChapter(
  projectPath: string,
  chapterContent: string,
  chapterNumber?: number,
): Promise<NovelReviewResult[]> {
  const llmConfig = resolveNovelModel(
    useWikiStore.getState().llmConfig,
    useWikiStore.getState().novelConfig,
    "review",
  )
  if (!hasUsableLlm(llmConfig)) return []

  const novelMode = useWikiStore.getState().novelMode
  if (!novelMode) return []

  const contextPack = await buildContextPack(
    projectPath,
    `审稿第${chapterNumber || "?"}章`,
    chapterNumber,
  )

  const outputLang = getOutputLanguage()
  const langReminder = buildLanguageReminder(outputLang)

  const systemPrompt = `你是一个专业的小说审稿编辑。你的任务是检查章节内容是否存在连贯性问题。
请严格按照 JSON 数组格式输出检查结果，不要输出任何其他内容。
${langReminder}`

  const userPrompt = buildReviewPrompt(contextPack, chapterContent)

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]

    let result = ""
    const callbacks: StreamCallbacks = {
      onToken: (token: string) => {
        result += token
      },
      onDone: () => {},
      onError: (error: Error) => {
        console.error("[Novel Review] Stream error:", error)
      },
    }

    await streamChat(llmConfig, messages, callbacks, AbortSignal.timeout(120000))

    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) return []

    return parsed.map((item: Record<string, unknown>) => ({
      severity: validateSeverity(item.severity),
      type: String(item.type || "unknown"),
      message: String(item.message || ""),
      evidence: String(item.evidence || ""),
      relatedMemory: String(item.relatedMemory || ""),
      suggestion: String(item.suggestion || ""),
    }))
  } catch (err) {
    console.error("[Novel Review] Failed:", err)
    return []
  }
}

function validateSeverity(value: unknown): "error" | "warning" | "info" {
  if (value === "error" || value === "warning" || value === "info") return value
  return "warning"
}
