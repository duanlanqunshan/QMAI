import { fetchEmbedding } from "@/lib/embedding"
import { streamChat } from "@/lib/llm-client"
import { isDirectRerankEndpoint, requestDirectRerank } from "@/lib/rerank-api"
import type { EmbeddingConfig, LlmConfig, RerankConfig } from "@/stores/wiki-store"

const TEST_TIMEOUT_MS = 30_000

export interface LlmModelTestResult {
  model: string
  content: string
}

export interface EmbeddingModelTestResult {
  model: string
  dimensions: number
}

export interface RerankModelTestResult {
  model: string
  content: string
  usedMainLlm: boolean
}

function ensureModel(model: string, emptyMessage: string): string {
  const trimmed = model.trim()
  if (!trimmed) {
    throw new Error(emptyMessage)
  }
  return trimmed
}

async function runChatModelTest(config: LlmConfig, prompt: string): Promise<LlmModelTestResult> {
  const model = ensureModel(config.model, "请先填写模型名称后再测试。")
  let content = ""
  let streamError: Error | null = null

  await streamChat(
    config,
    [{ role: "user", content: prompt }],
    {
      onToken: (token) => {
        content += token
      },
      onDone: () => undefined,
      onError: (error) => {
        streamError = error
      },
    },
    AbortSignal.timeout(TEST_TIMEOUT_MS),
    {
      temperature: 0,
      max_tokens: 80,
    },
  )

  if (streamError) {
    throw streamError
  }

  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error("模型已连接，但没有返回可用内容。")
  }

  return {
    model,
    content: trimmed,
  }
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced?.match(/\{[\s\S]*\}/)?.[0] ?? raw.match(/\{[\s\S]*\}/)?.[0]
  if (!candidate) {
    throw new Error("模型返回了内容，但不是可用的 JSON 结果。")
  }
  return candidate
}

function resolveRerankTestConfig(llmConfig: LlmConfig, rerankConfig: RerankConfig): {
  config: LlmConfig
  model: string
  usedMainLlm: boolean
} {
  if (rerankConfig.useMainLlm) {
    const model = ensureModel(llmConfig.model, "请先配置主模型后再测试重排模型。")
    return {
      config: { ...llmConfig, reasoning: { mode: "off" } },
      model,
      usedMainLlm: true,
    }
  }

  const model = ensureModel(rerankConfig.model, "请先填写重排模型名称后再测试。")
  if (/embedding/i.test(model)) {
    throw new Error("当前填写的更像是嵌入模型。重排模型需要可生成 JSON 的聊天模型，不能使用 Embedding 模型。")
  }
  return {
    config: {
      provider: rerankConfig.provider,
      apiKey: rerankConfig.apiKey,
      model,
      ollamaUrl: rerankConfig.ollamaUrl,
      customEndpoint: rerankConfig.customEndpoint,
      apiMode: rerankConfig.provider === "custom" ? rerankConfig.apiMode : undefined,
      maxContextSize: Math.min(llmConfig.maxContextSize ?? 65_536, 65_536),
      reasoning: { mode: "off" },
    },
    model,
    usedMainLlm: false,
  }
}

export async function testSettingsLlmModel(config: LlmConfig): Promise<LlmModelTestResult> {
  return runChatModelTest(
    config,
    "你正在执行模型连通性测试。请只回复“模型测试成功”。",
  )
}

export async function testSettingsEmbeddingModel(config: EmbeddingConfig): Promise<EmbeddingModelTestResult> {
  const model = ensureModel(config.model, "请先填写嵌入模型名称后再测试。")
  if (!config.endpoint.trim()) {
    throw new Error("请先填写嵌入接口地址后再测试。")
  }

  const vector = await fetchEmbedding(
    "这是一段用于测试嵌入模型可用性的短文本。",
    config,
    1,
  )

  if (!vector || vector.length === 0) {
    throw new Error("嵌入模型没有返回有效向量，请检查接口、密钥和模型名称。")
  }

  return {
    model,
    dimensions: vector.length,
  }
}

export async function testSettingsRerankModel(
  llmConfig: LlmConfig,
  rerankConfig: RerankConfig,
): Promise<RerankModelTestResult> {
  const { config, model, usedMainLlm } = resolveRerankTestConfig(llmConfig, rerankConfig)
  if (isDirectRerankEndpoint(config)) {
    const directResults = await requestDirectRerank(
      config,
      "主角寻找关键线索",
      [
        "主角在旧仓库翻到旧地图，并确认线索来源。",
        "配角讨论午饭吃什么，与寻找线索无关。",
      ],
      AbortSignal.timeout(TEST_TIMEOUT_MS),
    )
    if (!Array.isArray(directResults) || directResults.length === 0 || directResults[0]?.index === undefined) {
      throw new Error("重排模型已返回内容，但结果格式不正确。")
    }
    return {
      model,
      content: JSON.stringify(directResults),
      usedMainLlm,
    }
  }

  const result = await runChatModelTest(
    config,
    [
      "你正在执行重排模型测试。",
      "请根据查询将候选结果按相关性排序，只返回 JSON。",
      '返回格式必须是：{"order":[{"id":"a","score":1},{"id":"b","score":0.5}]}',
      "查询：主角寻找关键线索",
      "候选：",
      JSON.stringify([
        { id: "a", title: "主角在旧仓库找到线索", snippet: "主角在旧仓库翻到旧地图，并确认线索来源。" },
        { id: "b", title: "配角午饭安排", snippet: "配角讨论午饭吃什么，与查找线索无关。" },
      ], null, 2),
    ].join("\n"),
  )

  const jsonText = extractJsonObject(result.content)
  const parsed = JSON.parse(jsonText) as { order?: Array<{ id?: string }> }
  if (!Array.isArray(parsed.order) || parsed.order.length === 0 || !parsed.order[0]?.id) {
    throw new Error("重排模型返回了内容，但结果格式不正确。")
  }

  return {
    model,
    content: result.content,
    usedMainLlm,
  }
}
