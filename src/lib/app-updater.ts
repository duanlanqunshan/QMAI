import { isTauri } from "@/lib/platform"

type UpdateHandle = {
  version: string
  body?: string | null
  downloadAndInstall: () => Promise<void>
}

type UpdaterBindings = {
  isTauri: boolean
  check: () => Promise<UpdateHandle | null>
  confirm: (message: string, options?: Record<string, unknown>) => Promise<boolean>
  message: (message: string, options?: Record<string, unknown>) => Promise<unknown>
}

let updateCheckStarted = false

export async function runAppUpdateFlow(bindings: UpdaterBindings) {
  if (!bindings.isTauri) return

  const update = await bindings.check()
  if (!update) return

  const notes = update.body?.trim() ? `\n\n更新说明：\n${update.body.trim()}` : ""
  const confirmed = await bindings.confirm(
    `检测到新版本 ${update.version}。是否立即下载并安装？${notes}`,
    {
      title: "发现新版本",
      kind: "info",
      okLabel: "立即更新",
      cancelLabel: "稍后再说",
    },
  )
  if (!confirmed) return

  await bindings.message(
    "开始下载并安装更新。Windows 安装阶段会自动关闭当前软件，请先保存正在编辑的内容。",
    {
      title: "开始更新",
      kind: "info",
      okLabel: "知道了",
    },
  )
  await update.downloadAndInstall()
}

export async function checkForAppUpdate() {
  if (!isTauri() || updateCheckStarted) return

  updateCheckStarted = true
  try {
    const [{ check }, { confirm, message }] = await Promise.all([
      import("@tauri-apps/plugin-updater"),
      import("@tauri-apps/plugin-dialog"),
    ])
    await runAppUpdateFlow({
      isTauri: true,
      check,
      confirm,
      message,
    })
  } catch (error) {
    console.warn("检查应用更新失败：", error)
  } finally {
    updateCheckStarted = false
  }
}
