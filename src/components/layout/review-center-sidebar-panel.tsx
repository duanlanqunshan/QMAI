import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { ClipboardCheck, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import { scoreReviewResults } from "@/lib/novel/review-scoring"
import { startNovelReviewRun } from "@/lib/novel/start-review-run"
import { listDirectory, readFile } from "@/commands/fs"
import { flattenMdFiles } from "@/lib/novel/chapter-utils"
import { parseFrontmatter } from "@/lib/frontmatter"

const SIX_DIMENSIONS = [
  { key: "thrill", labelKey: "reviewCenter.dimension.thrill", sourceTypes: ["plot"] },
  { key: "consistency", labelKey: "reviewCenter.dimension.consistency", sourceTypes: ["world", "facts"] },
  { key: "pacing", labelKey: "reviewCenter.dimension.pacing", sourceTypes: ["pacing"] },
  { key: "character", labelKey: "reviewCenter.dimension.character", sourceTypes: ["character"] },
  { key: "continuity", labelKey: "reviewCenter.dimension.continuity", sourceTypes: ["facts"] },
  { key: "pull", labelKey: "reviewCenter.dimension.pull", sourceTypes: ["pacing", "plot"] },
]

export function ReviewCenterSidebarPanel() {
  const { t } = useTranslation()
  const selectedReviewDimension = useWikiStore((s) => s.selectedReviewDimension)
  const setSelectedReviewDimension = useWikiStore((s) => s.setSelectedReviewDimension)
  const reviewRun = useWikiStore((s) => s.reviewRun)
  const project = useWikiStore((s) => s.project)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const [chapterOptions, setChapterOptions] = useState<Array<{ path: string; label: string }>>([])
  const [selectedReviewFilePath, setSelectedReviewFilePath] = useState("")

  useEffect(() => {
    if (!project?.path) {
      setChapterOptions([])
      setSelectedReviewFilePath("")
      return
    }

    let cancelled = false

    void listDirectory(`${project.path}/wiki/chapters`)
      .then(async (tree) => {
        if (cancelled) return
        const files = flattenMdFiles(tree)
        const options = await Promise.all(files.map(async (file) => {
          try {
            const content = await readFile(file.path)
            const parsed = parseFrontmatter(content)
            const fmTitle = typeof parsed.frontmatter?.title === "string" ? parsed.frontmatter.title.trim() : ""
            const headingTitle = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ""
            const baseTitle = fmTitle || headingTitle || file.name.replace(/\.md$/i, "")
            const label = baseTitle
            return {
              path: file.path,
              label,
            }
          } catch {
            return {
              path: file.path,
              label: file.name.replace(/\.md$/i, ""),
            }
          }
        }))
        setChapterOptions(options)
        setSelectedReviewFilePath((current) => {
          if (selectedFile && options.some((option) => option.path === selectedFile)) return selectedFile
          if (current && options.some((option) => option.path === current)) return current
          return options[0]?.path ?? ""
        })
      })
      .catch(() => {
        if (cancelled) return
        setChapterOptions([])
        setSelectedReviewFilePath("")
      })

    return () => {
      cancelled = true
    }
  }, [project?.path, selectedFile])

  const reviewResults = (reviewRun?.results ?? []) as NovelReviewResult[]
  const scoreReport = useMemo(() => scoreReviewResults(reviewResults), [reviewResults])

  const dimensionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const dim of SIX_DIMENSIONS) {
      const scored = scoreReport.dimensions.find((d) => dim.sourceTypes.includes(d.key))
      counts[dim.key] = scored?.issueCount ?? 0
    }
    return counts
  }, [scoreReport])

  const totalBySeverity = useMemo(() => {
    const counts = { blocking: 0, high: 0, medium: 0, low: 0 }
    for (const dim of scoreReport.dimensions) {
      for (const issue of dim.issues) {
        if (issue.severity === "error") counts.high++
        else if (issue.severity === "warning") counts.medium++
        else counts.low++
      }
    }
    return counts
  }, [scoreReport])

  const canReview = Boolean(project && selectedReviewFilePath) && !(reviewRun?.running ?? false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          {t("reviewCenter.title")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-3">
          <div className="px-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("reviewCenter.chapterTarget")}
          </div>
          <select
            value={selectedReviewFilePath}
            onChange={(event) => setSelectedReviewFilePath(event.target.value)}
            disabled={chapterOptions.length === 0 || (reviewRun?.running ?? false)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chapterOptions.length === 0 ? (
              <option value="">{t("reviewCenter.noChapterAvailable")}</option>
            ) : (
              chapterOptions.map((option) => (
                <option key={option.path} value={option.path}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="mb-3">
          <div className="px-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("reviewCenter.sixDimensions")}
          </div>
          <div className="space-y-1">
            {SIX_DIMENSIONS.map((dim) => (
              <div
                key={dim.key}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedReviewDimension === dim.key ? "qm-selected" : "text-muted-foreground qm-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReviewDimension(dim.key)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="truncate">{t(dim.labelKey)}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {dimensionCounts[dim.key] > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{dimensionCounts[dim.key]}</span>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!project || !selectedReviewFilePath) return
                        setSelectedReviewDimension(dim.key)
                        void readFile(selectedReviewFilePath)
                          .then((content) => startNovelReviewRun({
                            fileContent: content,
                            projectPath: project.path,
                            selectedFile: selectedReviewFilePath,
                            t,
                          }))
                          .catch((error) => {
                            console.error("[ReviewCenterSidebarPanel] 读取审查章节失败:", error)
                          })
                      }}
                      disabled={!canReview}
                      className="rounded border border-border px-2 py-0.5 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reviewRun?.running && selectedReviewDimension === dim.key ? t("reviewCenter.reviewingAction") : t("reviewCenter.reviewAction")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="px-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("reviewCenter.aiReview")}
          </div>
          <button
            type="button"
            onClick={() => setSelectedReviewDimension("ai-review")}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
              selectedReviewDimension === "ai-review" ? "qm-selected" : "text-muted-foreground qm-hover"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>{t("reviewCenter.aiReview")}</span>
            </div>
          </button>
        </div>

        <div className="px-1 text-xs text-muted-foreground">
          {t("reviewCenter.stats", totalBySeverity)}
        </div>
      </div>
    </div>
  )
}
