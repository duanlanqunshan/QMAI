import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { useMemo } from "react"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import { scoreReviewResults } from "@/lib/novel/review-scoring"
import { ReviewView } from "./review-view"
import { DashboardView } from "@/components/dashboard/dashboard-view"

const DIMENSION_SOURCE_MAP: Record<string, string[]> = {
  thrill: ["plot"],
  consistency: ["world", "facts"],
  pacing: ["pacing"],
  character: ["character"],
  continuity: ["facts"],
  pull: ["pacing", "plot"],
}

export function ReviewCenterView() {
  const selectedReviewDimension = useWikiStore((s) => s.selectedReviewDimension)
  const novelMode = useWikiStore((s) => s.novelMode)

  if (selectedReviewDimension === "ai-review") {
    return <ReviewView />
  }

  if (!selectedReviewDimension || !novelMode) {
    return <DashboardView />
  }

  return <DimensionResultView dimension={selectedReviewDimension} />
}

function DimensionResultView({ dimension }: { dimension: string }) {
  const { t } = useTranslation()
  const reviewRun = useWikiStore((s) => s.reviewRun)

  const reviewResults = (reviewRun?.results ?? []) as NovelReviewResult[]

  const dimensionIssues = useMemo(() => {
    const sourceTypes = DIMENSION_SOURCE_MAP[dimension] ?? []
    const report = scoreReviewResults(reviewResults)
    const issues: NovelReviewResult[] = []
    for (const dim of report.dimensions) {
      if (sourceTypes.includes(dim.key)) {
        issues.push(...dim.issues)
      }
    }
    return issues
  }, [reviewResults, dimension])

  const labelKey = `reviewCenter.dimension.${dimension}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t(labelKey)}</h2>
        {dimensionIssues.length > 0 && (
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{dimensionIssues.length}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {dimensionIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <p>{t("reviewCenter.noResults")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dimensionIssues.map((issue, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    issue.severity === "error" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" :
                    issue.severity === "warning" ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" :
                    "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                  }`}>{issue.severity}</span>
                  <span className="text-xs text-muted-foreground">{issue.type}</span>
                </div>
                <p className="mt-1 text-xs">{issue.message}</p>
                {issue.evidence && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    {'\u300C'}{issue.evidence}{'\u300D'}
                  </p>
                )}
                {issue.suggestion && (
                  <p className="mt-1 text-xs text-green-700 dark:text-green-400">{issue.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
