import { describe, expect, it } from "vitest"
import {
  buildDeAiSystemPrompt,
  buildDeAiRewriteMessages,
  buildQmQuaiSystemPrompt,
  injectDeAiDirective,
} from "./de-ai-adapter"

describe("de-ai-adapter", () => {
  describe("buildDeAiSystemPrompt", () => {
    it("返回来自小说去AI味技能文件的 system prompt", () => {
      const prompt = buildDeAiSystemPrompt()

      expect(prompt).toContain("# 小说去 AI 味技能")
      expect(prompt).toContain("技能定位")
      expect(prompt).toContain("适用范围")
    })

    it("buildDeAiSystemPrompt 与 QM-QUAI system prompt 保持一致", () => {
      expect(buildDeAiSystemPrompt()).toBe(buildQmQuaiSystemPrompt())
    })
  })

  describe("buildDeAiRewriteMessages", () => {
    it("返回两条消息，第一条是 system 角色", () => {
      const content = "今天天气很好，小明决定出去散步。"
      const messages = buildDeAiRewriteMessages(content)

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[0].content).toBe(buildDeAiSystemPrompt())
    })

    it("第二条消息包含原文和 QM-QUAI skill 指令", () => {
      const content = "今天天气很好，小明决定出去散步。"
      const messages = buildDeAiRewriteMessages(content)

      const userMsg = messages[1]
      expect(userMsg.role).toBe("user")
      expect(userMsg.content).toContain("QM-QUAI")
      expect(userMsg.content).toContain(content)
    })

    it("传入空字符串时抛出异常", () => {
      expect(() => buildDeAiRewriteMessages("")).toThrow("去AI味内容为空，无法处理")
    })
  })

  describe("injectDeAiDirective", () => {
    it("enabled=true 时在前面拼接去AI味指令并保留原输入", () => {
      const content = "请续写下一章内容。"
      const result = injectDeAiDirective(content, true)

      expect(result).toContain("请保持剧情一致")
      expect(result).toContain(content)
      expect(result.startsWith("请保持剧情一致")).toBe(true)
    })

    it("enabled=false 时原样返回", () => {
      const content = "请续写下一章内容。"
      const result = injectDeAiDirective(content, false)

      expect(result).toBe(content)
    })

    it('enabled=true 且 content="" 时返回纯前缀', () => {
      const result = injectDeAiDirective("", true)

      expect(result).toContain("请保持剧情一致")
      expect(result).not.toContain("请续写")
    })

    it('enabled=false 且 content="" 时返回空字符串', () => {
      const result = injectDeAiDirective("", false)

      expect(result).toBe("")
    })
  })
})
