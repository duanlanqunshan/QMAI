import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Power, PowerOff, RotateCw } from "lucide-react"
import { validateProxyUrl } from "@/lib/proxy-config"
import {
  getClipServerConfig,
  setClipServerRuntimeConfig,
  stopClipServer,
  type ClipServerRuntimeConfig,
} from "@/commands/clip-server"
import { normalizeClipServerConfig, saveClipServerConfig } from "@/lib/project-store"
import type { SettingsDraft, DraftSetter } from "../settings-types"

interface Props {
  draft: SettingsDraft
  setDraft: DraftSetter
}

export function NetworkSection({ draft, setDraft }: Props) {
  const { t } = useTranslation()
  const [clipStatus, setClipStatus] = useState<ClipServerRuntimeConfig | null>(null)
  const [clipBusy, setClipBusy] = useState(false)
  const [clipError, setClipError] = useState("")

  // Live URL validation — only flag the user when they've actually
  // typed something. Empty + enabled is "form not yet finished",
  // not a hard error.
  const trimmed = draft.proxyUrl.trim()
  const validation = trimmed === "" ? null : validateProxyUrl(trimmed)
  const showError = draft.proxyEnabled && validation && !validation.ok
  const normalizedClip = normalizeClipServerConfig({
    enabled: draft.clipServerEnabled,
    port: draft.clipServerPort,
  })
  const clipPortInvalid = draft.clipServerPort < 1024 || draft.clipServerPort > 65535

  const refreshClipStatus = async () => {
    try {
      const next = await getClipServerConfig()
      setClipStatus(next)
      setDraft("clipServerEnabled", next.enabled)
      setDraft("clipServerPort", next.port)
      setClipError("")
    } catch (err) {
      setClipError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refreshClipStatus().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenClipServer = async () => {
    if (clipPortInvalid) return
    setClipBusy(true)
    try {
      const next = await setClipServerRuntimeConfig({ ...normalizedClip, enabled: true })
      await saveClipServerConfig(next)
      setClipStatus(next)
      setDraft("clipServerEnabled", next.enabled)
      setDraft("clipServerPort", next.port)
      setClipError("")
    } catch (err) {
      setClipError(err instanceof Error ? err.message : String(err))
    } finally {
      setClipBusy(false)
    }
  }

  const handleCloseClipServer = async () => {
    setClipBusy(true)
    try {
      const next = await stopClipServer()
      const saved = normalizeClipServerConfig({ ...normalizedClip, enabled: false })
      await saveClipServerConfig(saved)
      setClipStatus({ ...next, enabled: false, port: saved.port })
      setDraft("clipServerEnabled", false)
      setDraft("clipServerPort", saved.port)
      setClipError("")
    } catch (err) {
      setClipError(err instanceof Error ? err.message : String(err))
    } finally {
      setClipBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {t("settings.sections.network.title", { defaultValue: "Network" })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.sections.network.description", {
            defaultValue:
              "Route all outbound HTTP requests (LLM, embedding, search, update check) through a proxy. Changes apply on Save — no restart needed.",
          })}
        </p>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.proxyEnabled}
          onChange={(e) => setDraft("proxyEnabled", e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm">
          {t("settings.sections.network.enable", {
            defaultValue: "Enable proxy",
          })}
        </span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="proxy-url">
          {t("settings.sections.network.url", { defaultValue: "Proxy URL" })}
        </Label>
        <Input
          id="proxy-url"
          value={draft.proxyUrl}
          onChange={(e) => setDraft("proxyUrl", e.target.value)}
          placeholder="http://127.0.0.1:7890"
          disabled={!draft.proxyEnabled}
          className={showError ? "border-destructive" : ""}
        />
        <p className="text-xs text-muted-foreground">
          {t("settings.sections.network.urlHelp", {
            defaultValue:
              "Full URL with scheme. Supported: http://, https://. (SOCKS5 not supported in this version.)",
          })}
        </p>
        {showError && validation && !validation.ok && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {validation.error}
          </p>
        )}
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={draft.proxyBypassLocal}
          onChange={(e) => setDraft("proxyBypassLocal", e.target.checked)}
          disabled={!draft.proxyEnabled}
          className="mt-0.5 h-4 w-4"
        />
        <div className="space-y-1">
          <span className="text-sm">
            {t("settings.sections.network.bypassLocal", {
              defaultValue: "Bypass proxy for local addresses (recommended)",
            })}
          </span>
          <p className="text-xs text-muted-foreground">
            {t("settings.sections.network.bypassLocalHelp", {
              defaultValue:
                "Requests to localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and *.local don't go through the proxy. Keep this on if you use Ollama / LM Studio / other local or LAN-deployed LLMs.",
            })}
          </p>
        </div>
      </label>

      <div className="space-y-3 rounded-md border bg-muted/20 p-4">
        <div>
          <h3 className="text-sm font-semibold">
            {t("settings.sections.network.clipServerTitle", { defaultValue: "网页剪藏端口" })}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.sections.network.clipServerDescription", {
              defaultValue: "浏览器剪藏插件会连接这个本地端口。端口被占用时，可以换一个端口后重新打开。",
            })}
          </p>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.clipServerEnabled}
            onChange={(e) => setDraft("clipServerEnabled", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">
            {t("settings.sections.network.clipServerEnable", { defaultValue: "启用网页剪藏端口" })}
          </span>
        </label>

        <div className="space-y-2">
          <Label htmlFor="clip-server-port">
            {t("settings.sections.network.clipServerPort", { defaultValue: "端口" })}
          </Label>
          <Input
            id="clip-server-port"
            type="number"
            min={1024}
            max={65535}
            value={draft.clipServerPort}
            onChange={(e) => setDraft("clipServerPort", Number(e.target.value))}
            className={clipPortInvalid ? "border-destructive" : ""}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.sections.network.clipServerPortHelp", {
              defaultValue: "默认 19827。建议使用 1024 到 65535 之间未被占用的端口。",
            })}
          </p>
          {clipPortInvalid && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {t("settings.sections.network.clipServerPortInvalid", { defaultValue: "端口必须在 1024 到 65535 之间。" })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={handleOpenClipServer} disabled={clipBusy || clipPortInvalid}>
            <Power className="mr-1.5 h-4 w-4" />
            {t("settings.sections.network.clipServerOpen", { defaultValue: "打开端口" })}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleCloseClipServer} disabled={clipBusy}>
            <PowerOff className="mr-1.5 h-4 w-4" />
            {t("settings.sections.network.clipServerClose", { defaultValue: "关闭端口" })}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={refreshClipStatus} disabled={clipBusy}>
            <RotateCw className="mr-1.5 h-4 w-4" />
            {t("settings.sections.network.clipServerRefresh", { defaultValue: "刷新状态" })}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("settings.sections.network.clipServerStatus", {
            defaultValue: "当前状态：{{status}}，端口：{{port}}",
            status: clipStatus?.status ?? "unknown",
            port: clipStatus?.port ?? draft.clipServerPort,
          })}
        </p>
        {clipError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {clipError}
          </p>
        )}
      </div>

    </div>
  )
}
