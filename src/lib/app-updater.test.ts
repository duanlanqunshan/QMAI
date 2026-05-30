import { describe, expect, it, vi } from "vitest"
import { runAppUpdateFlow } from "./app-updater"

describe("runAppUpdateFlow", () => {
  it("没有新版本时不弹窗也不安装", async () => {
    const check = vi.fn().mockResolvedValue(null)
    const confirm = vi.fn()
    const message = vi.fn()

    await runAppUpdateFlow({
      isTauri: true,
      check,
      confirm,
      message,
    })

    expect(check).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
    expect(message).not.toHaveBeenCalled()
  })

  it("用户确认后下载并安装更新", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined)
    const check = vi.fn().mockResolvedValue({
      version: "0.4.11",
      body: "修复自动更新与发布流程",
      downloadAndInstall,
    })
    const confirm = vi.fn().mockResolvedValue(true)
    const message = vi.fn().mockResolvedValue("Ok")

    await runAppUpdateFlow({
      isTauri: true,
      check,
      confirm,
      message,
    })

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(message).toHaveBeenCalledTimes(1)
    expect(downloadAndInstall).toHaveBeenCalledTimes(1)
  })
})
