import { invoke } from "@tauri-apps/api/core"
import { isTauri } from "@/lib/platform"
import { DEFAULT_CLIP_SERVER_CONFIG, normalizeClipServerConfig } from "@/lib/project-store"
import type { ClipServerConfig } from "@/stores/wiki-store"

export interface ClipServerRuntimeConfig extends ClipServerConfig {
  status: "starting" | "running" | "port_conflict" | "error" | "stopped" | string
}

export function getClipServerUrl(config: Pick<ClipServerConfig, "port">): string {
  const normalized = normalizeClipServerConfig({ enabled: true, port: config.port })
  return `http://127.0.0.1:${normalized.port}`
}

export async function getClipServerConfig(): Promise<ClipServerRuntimeConfig> {
  if (!isTauri()) {
    return { ...DEFAULT_CLIP_SERVER_CONFIG, status: "stopped" }
  }
  return invoke<ClipServerRuntimeConfig>("get_clip_server_config")
}

export async function setClipServerRuntimeConfig(config: ClipServerConfig): Promise<ClipServerRuntimeConfig> {
  const normalized = normalizeClipServerConfig(config)
  if (!isTauri()) {
    return { ...normalized, status: normalized.enabled ? "running" : "stopped" }
  }
  return invoke<ClipServerRuntimeConfig>("set_clip_server_config", { config: normalized })
}

export async function stopClipServer(): Promise<ClipServerRuntimeConfig> {
  if (!isTauri()) {
    return { ...DEFAULT_CLIP_SERVER_CONFIG, enabled: false, status: "stopped" }
  }
  return invoke<ClipServerRuntimeConfig>("stop_clip_server")
}
