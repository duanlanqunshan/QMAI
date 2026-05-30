import type { Conversation } from "@/stores/chat-store"

export function isWorkspaceView(view: "wiki" | "sources" | "search" | "graph" | "lint" | "review" | "characterAura" | "settings" | "trash"): boolean {
  return view === "wiki" || view === "trash"
}

export function clampSidebarWidth(width: number): number {
  return Math.max(150, Math.min(400, width))
}

export function clampChatHeight(height: number): number {
  return Math.max(180, Math.min(520, height))
}

export function getConversationTabTitle(title: string, maxLength = 12): string {
  if (title.length <= maxLength) return title
  return `${title.slice(0, Math.max(1, maxLength - 1))}…`
}

export function sortConversationsByUpdatedAt(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
}
