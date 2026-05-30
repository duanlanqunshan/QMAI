import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { PreviewPanel } from "./preview-panel"
import { clampChatHeight } from "@/lib/workspace-layout"
import { useWikiStore } from "@/stores/wiki-store"
import { shouldShowWritingChat } from "./chat-layout"

const ChatPanel = lazy(async () => {
  const mod = await import("@/components/chat/chat-panel")
  return { default: mod.ChatPanel }
})

export function WritingWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)
  const chatExpanded = useWikiStore((s) => s.chatExpanded)
  const [chatHeight, setChatHeight] = useState(260)

  useEffect(() => {
    const saved = Number(localStorage.getItem("lk-chat-height") ?? "260")
    if (Number.isFinite(saved) && saved > 0) {
      setChatHeight(clampChatHeight(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("lk-chat-height", String(chatHeight))
  }, [chatHeight])

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizingRef.current = true
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    document.body.dataset.panelResizing = "true"

    const handleMouseMove = (nextEvent: MouseEvent) => {
      if (!resizingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const nextHeight = rect.bottom - nextEvent.clientY
      setChatHeight(clampChatHeight(nextHeight))
    }

    const handleMouseUp = () => {
      resizingRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      delete document.body.dataset.panelResizing
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [])

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-hidden">
        <PreviewPanel />
      </div>
      {shouldShowWritingChat(chatExpanded) && (
        <>
          <div
            className="h-1.5 shrink-0 cursor-row-resize bg-border/40 transition-colors hover:bg-primary/30 active:bg-primary/40"
            onMouseDown={startResize}
          />
          <div className="shrink-0 overflow-hidden border-t bg-background" style={{ height: chatHeight }}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
              <ChatPanel />
            </Suspense>
          </div>
        </>
      )}
    </div>
  )
}
