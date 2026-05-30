import type { LlmConfig, NovelConfig } from "@/stores/wiki-store"

export type NovelTaskType = "writing" | "review" | "summary" | "extract" | "lint"

export function resolveNovelModel(
  llmConfig: LlmConfig,
  novelConfig: NovelConfig,
  taskType: NovelTaskType,
): LlmConfig {
  const modelMap: Record<NovelTaskType, string> = {
    writing: novelConfig.writingModel,
    review: novelConfig.reviewModel,
    summary: novelConfig.summaryModel,
    extract: novelConfig.extractModel,
    lint: novelConfig.reviewModel,
  }

  const taskModel = modelMap[taskType]
  if (!taskModel) {
    return llmConfig
  }

  return { ...llmConfig, model: taskModel }
}