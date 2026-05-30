import { describe, it, expect } from "vitest"
import {
  hasUsableLlm,
  PROVIDERS_WITHOUT_KEY,
  type LlmProvider,
} from "./has-usable-llm"

const KNOWN_PROVIDERS_WITH_KEY: ReadonlySet<LlmProvider> = new Set([
  "openai",
  "anthropic",
  "google",
  "minimax",
])

describe("hasUsableLlm", () => {
  it("returns true for ollama with no API key", () => {
    expect(
      hasUsableLlm({ provider: "ollama", apiKey: "", model: "" }),
    ).toBe(true)
  })

  it("returns true for custom with no API key", () => {
    expect(
      hasUsableLlm({ provider: "custom", apiKey: "", model: "" }),
    ).toBe(true)
  })

  it("returns true for claude-code with no API key", () => {
    expect(
      hasUsableLlm({ provider: "claude-code", apiKey: "", model: "" }),
    ).toBe(true)
  })

  it("returns true for codex-cli with no API key", () => {
    expect(
      hasUsableLlm({ provider: "codex-cli", apiKey: "", model: "" }),
    ).toBe(true)
  })

  it("returns false for openai with no API key", () => {
    expect(
      hasUsableLlm({ provider: "openai", apiKey: "", model: "gpt-4" }),
    ).toBe(false)
  })

  it("returns false for openai with no model", () => {
    expect(
      hasUsableLlm({ provider: "openai", apiKey: "sk-test", model: "" }),
    ).toBe(false)
  })

  it("returns true for openai with an API key and model", () => {
    expect(
      hasUsableLlm({ provider: "openai", apiKey: "sk-test", model: "gpt-4" }),
    ).toBe(true)
  })

  it("returns false for anthropic with empty key", () => {
    expect(
      hasUsableLlm({ provider: "anthropic", apiKey: "", model: "claude-3" }),
    ).toBe(false)
  })

  it("returns true for anthropic with a key and model", () => {
    expect(
      hasUsableLlm({ provider: "anthropic", apiKey: "sk-ant-...", model: "claude-3" }),
    ).toBe(true)
  })

  it("treats whitespace-only key as missing for key-required providers", () => {
    expect(
      hasUsableLlm({ provider: "google", apiKey: "   ", model: "gemini" }),
    ).toBe(false)
  })

  it("treats whitespace-only model as missing for key-required providers", () => {
    expect(
      hasUsableLlm({ provider: "google", apiKey: "key", model: "   " }),
    ).toBe(false)
  })

  it("PROVIDERS_WITHOUT_KEY covers the locally-running / CLI-auth providers", () => {
    expect(PROVIDERS_WITHOUT_KEY.has("ollama")).toBe(true)
    expect(PROVIDERS_WITHOUT_KEY.has("custom")).toBe(true)
    expect(PROVIDERS_WITHOUT_KEY.has("claude-code")).toBe(true)
    expect(PROVIDERS_WITHOUT_KEY.has("codex-cli")).toBe(true)
  })

  it("PROVIDERS_WITHOUT_KEY does not include hosted-API providers", () => {
    expect(PROVIDERS_WITHOUT_KEY.has("openai")).toBe(false)
    expect(PROVIDERS_WITHOUT_KEY.has("anthropic")).toBe(false)
    expect(PROVIDERS_WITHOUT_KEY.has("google")).toBe(false)
    expect(PROVIDERS_WITHOUT_KEY.has("minimax")).toBe(false)
  })

  it("classifies every LlmProvider into exactly one bucket", () => {
    const allProviders: LlmProvider[] = [
      "openai",
      "anthropic",
      "google",
      "ollama",
      "custom",
      "minimax",
      "claude-code",
      "codex-cli",
    ]
    for (const p of allProviders) {
      const inNoKey = PROVIDERS_WITHOUT_KEY.has(p)
      const inKey = KNOWN_PROVIDERS_WITH_KEY.has(p)
      expect(
        inNoKey !== inKey,
        `provider "${p}" is in ${inNoKey && inKey ? "BOTH" : "NEITHER"} bucket — pick one`,
      ).toBe(true)
    }
  })
})
