import { useState, useCallback, useRef, useEffect } from "react"
import { Maximize2, Minimize2, FileText, BookOpen } from "lucide-react"
import { PreviewPanel } from "./preview-panel"
import { WritingGuidePanel } from "./writing-guide-panel"

type WritingTab = "guide" | "content"

export function WritingWorkspace() {
  const [activeTab, setActiveTab] = useState<WritingTab>("guide")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden bg-background"
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-muted/20 px-2">
        <button
          onClick={() => setActiveTab("guide")}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "guide"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          章纲与要求
        </button>
        <button
          onClick={() => setActiveTab("content")}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "content"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          写作内容
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "guide" ? <WritingGuidePanel /> : <PreviewPanel />}
      </div>
    </div>
  )
}