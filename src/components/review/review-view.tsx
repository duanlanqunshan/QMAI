import { useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import i18n from "@/i18n"
import type { NovelReviewResult } from "@/lib/novel/review-adapter"
import {
  AlertTriangle,
  Copy,
  FileQuestion,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  X,
  Check,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useReviewStore, type ReviewItem } from "@/stores/review-store"
import { useWikiStore } from "@/stores/wiki-store"
import { writeFile, readFile, listDirectory, deleteFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"
import { loadCognitionState, type CognitionState } from "@/lib/novel/character-cognition"
import {
  deleteGenerationHistoryEntry,
  listGenerationHistory,
  type GenerationHistoryEntry,
} from "@/lib/novel/generation-history"
import { startNovelReviewRun } from "@/lib/novel/start-review-run"

const typeConfig: Record<ReviewItem["type"], { icon: typeof AlertTriangle; labelKey: string; novelLabelKey: string; color: string }> = {
  contradiction: { icon: AlertTriangle, labelKey: "review.typeLabels.contradiction", novelLabelKey: "novel.review.typeLabels.contradiction", color: "text-amber-500" },
  duplicate: { icon: Copy, labelKey: "review.typeLabels.duplicate", novelLabelKey: "novel.review.typeLabels.duplicate", color: "text-blue-500" },
  "missing-page": { icon: FileQuestion, labelKey: "review.typeLabels.missingPage", novelLabelKey: "novel.review.typeLabels.missingPage", color: "text-purple-500" },
  confirm: { icon: MessageSquare, labelKey: "review.typeLabels.confirm", novelLabelKey: "novel.review.typeLabels.confirm", color: "text-foreground" },
  suggestion: { icon: Lightbulb, labelKey: "review.typeLabels.suggestion", novelLabelKey: "novel.review.typeLabels.suggestion", color: "text-emerald-500" },
}

export function ReviewView() {
  const { t } = useTranslation()
  const novelMode = useWikiStore((s) => s.novelMode)
  const items = useReviewStore((s) => s.items)
  const resolveItem = useReviewStore((s) => s.resolveItem)
  const dismissItem = useReviewStore((s) => s.dismissItem)
  const clearResolved = useReviewStore((s) => s.clearResolved)
  const project = useWikiStore((s) => s.project)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const fileContent = useWikiStore((s) => s.fileContent)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)
  const setFileContent = useWikiStore((s) => s.setFileContent)
  const setActiveView = useWikiStore((s) => s.setActiveView)
  const setFileTree = useWikiStore((s) => s.setFileTree)
  const reviewRun = useWikiStore((s) => s.reviewRun)
  const novelReviewResults = reviewRun?.results ?? []
  const isReviewing = reviewRun?.running ?? false
  const reviewError = reviewRun?.error
  const [reviewHistory, setReviewHistory] = useState<GenerationHistoryEntry[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [cognitionState, setCognitionState] = useState<CognitionState | null>(null)
  const [cognitionExpanded, setCognitionExpanded] = useState(false)

  useEffect(() => {
    if (!novelMode || !project) {
      setCognitionState(null)
      return
    }
    loadCognitionState(project.path).then(setCognitionState).catch(() => setCognitionState(null))
  }, [novelMode, project, novelReviewResults])

  const loadReviewHistory = useCallback(async () => {
    if (!project) {
      setReviewHistory([])
      return
    }
    setReviewHistory(await listGenerationHistory(project.path, "review"))
  }, [project])

  useEffect(() => {
    if (novelMode && project) {
      void loadReviewHistory()
      return
    }
    setReviewHistory([])
    setExpandedHistoryId(null)
  }, [novelMode, project, loadReviewHistory])

  const openReviewSource = useCallback(async (targetPath = reviewRun?.filePath) => {
    if (!targetPath) return
    try {
      const content = await readFile(targetPath)
      setSelectedFile(targetPath)
      setFileContent(content)
      setActiveView("wiki")
    } catch (error) {
      console.error("[ReviewView] open source failed:", error)
    }
  }, [reviewRun?.filePath, setActiveView, setFileContent, setSelectedFile])

  const handleDeleteHistory = useCallback(async (entry: GenerationHistoryEntry) => {
    if (!project) return
    const confirmed = window.confirm(t("novel.history.deleteConfirm"))
    if (!confirmed) return
    await deleteGenerationHistoryEntry(project.path, entry.filePath)
    setExpandedHistoryId((current) => current === entry.id ? null : current)
    await loadReviewHistory()
  }, [project, loadReviewHistory, t])

  const handleNovelReview = useCallback(async () => {
    if (!project || !selectedFile || !fileContent.trim()) return
    await startNovelReviewRun({
      fileContent,
      projectPath: project.path,
      selectedFile,
      t,
      onHistorySaved: loadReviewHistory,
    })
    /*
    return
    const parsed = parseFrontmatter(fileContent)
    const meta = parsed.frontmatter ? parseChapterMeta(parsed.frontmatter as Record<string, unknown>) : null
    const runId = `${Date.now()}-${Math.random()}`
    setReviewRun({ runId, projectPath: project.path, filePath: selectedFile, running: true, results: [] })
    try {
      const results = await reviewChapter(project.path, fileContent, meta?.chapterNumber)
      useWikiStore.getState().finishReviewRun(runId, { running: true, results, error: undefined })
      await saveGenerationHistoryEntry(project.path, {
        kind: "review",
        title: meta?.chapterNumber ? t("novel.review.historyEntryTitle", { chapter: meta.chapterNumber }) : t("novel.review.historyEntryTitleNoChapter"),
        chapterNumber: meta?.chapterNumber,
        sourcePath: selectedFile,
        results,
      })
      await loadReviewHistory()
      if (meta?.chapterNumber) {
        await persistRevisionFeedbackForChapter(
          project.path,
          meta.chapterNumber,
          "review",
          pickRevisionFeedbackFromReviewResults(results),
        )
      }
    } catch (err) {
      console.error("审稿失败:", err)
      useWikiStore.getState().finishReviewRun(runId, { running: false, error: t("novel.review.runFailed") })
    } finally {
      const current = useWikiStore.getState().reviewRun
      if (current?.runId === runId) {
        useWikiStore.getState().finishReviewRun(runId, { running: false, results: current.results })
      }
    }
    */
  }, [fileContent, project, selectedFile, t, loadReviewHistory])

  const handleResolve = useCallback(async (id: string, action: string) => {
    const novelMode = useWikiStore.getState().novelMode
    const pp = project ? normalizePath(project.path) : ""
    if (action.startsWith("save:") && project) {
      try {
        const encoded = action.slice(5)
        const content = decodeURIComponent(atob(encoded))
        const cleanContent = content
          .replace(/<!--\s*save-worthy:.*?-->/g, "")
          .replace(/<!--\s*sources:.*?-->/g, "")
          .trimEnd()

        const firstLine = cleanContent.split("\n").find((l) => l.trim() && !l.startsWith("<!--"))?.replace(/^#+\s*/, "").trim() ?? i18n.t("review.fallbacks.savedQueryTitle")
        const title = firstLine.slice(0, 60)
        const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50)
        const date = new Date().toISOString().slice(0, 10)
        const fileName = `${slug}-${date}.md`
        const filePath = `${pp}/wiki/queries/${fileName}`

        const frontmatter = `---\ntype: query\ntitle: "${title.replace(/"/g, '\\"')}"\ncreated: ${date}\ntags: []\n---\n\n`
        await writeFile(filePath, frontmatter + cleanContent)

        const indexPath = `${pp}/wiki/index.md`
        let indexContent = ""
        try { indexContent = await readFile(indexPath) } catch { indexContent = "# Wiki Index\n" }
        const entry = `- [[queries/${slug}-${date}|${title}]]`
        if (indexContent.includes("## Queries")) {
          indexContent = indexContent.replace(/(## Queries\n)/, `$1${entry}\n`)
        } else {
          indexContent = indexContent.trimEnd() + "\n\n## Queries\n" + entry + "\n"
        }
        await writeFile(indexPath, indexContent)

        const logPath = `${pp}/wiki/log.md`
        let logContent = ""
        try { logContent = await readFile(logPath) } catch { logContent = "# Wiki Log\n" }
        await writeFile(logPath, logContent.trimEnd() + `\n- ${date}: Saved query page \`${fileName}\`\n`)

        const tree = await listDirectory(pp)
        setFileTree(tree)
        resolveItem(id, novelMode ? i18n.t("novel.review.notifications.savedToChapterLibrary") : i18n.t("review.notifications.savedToWiki"))
      } catch (err) {
        console.error("审稿页面写入 wiki 失败:", err)
        resolveItem(id, novelMode ? i18n.t("novel.review.notifications.saveFailed") : i18n.t("review.notifications.saveFailed"))
      }
    } else if (action.startsWith("open:") && project) {
      const page = action.slice(5)
      const candidates = [
        `${pp}/wiki/${page}`,
        `${pp}/wiki/${page}.md`,
      ]
      for (const path of candidates) {
        try {
          const content = await readFile(path)
          useWikiStore.getState().setSelectedFile(path)
          useWikiStore.getState().setFileContent(content)
          useWikiStore.getState().setActiveView("wiki")
          break
        } catch {
        }
      }
      resolveItem(id, novelMode ? i18n.t("novel.review.notifications.openedChapter", { page }) : i18n.t("review.notifications.openedPage", { page }))
    } else if (action.startsWith("delete:") && project) {
      const filePath = action.slice(7)
      try {
        await deleteFile(filePath)
        const tree = await listDirectory(pp)
        setFileTree(tree)
        resolveItem(id, i18n.t("review.notifications.deleted"))
      } catch (err) {
        console.error("删除失败:", err)
        resolveItem(id, i18n.t("review.notifications.deleteFailed"))
      }
    } else if ((action.startsWith("__create_page__:") || actionLooksLikeCreate(action)) && project) {
      const realAction = action.startsWith("__create_page__:")
        ? action.slice("__create_page__:".length)
        : action
      const item = items.find((i) => i.id === id)
      if (item) {
        try {
          const titlePrefixPattern = new RegExp(`^(${i18n.t("review.fallbacks.stripTitlePrefixes")})[:\\s]*`, "i")
          const title = item.title.replace(titlePrefixPattern, "").trim() || i18n.t("review.fallbacks.untitled")
          const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50)
          const date = new Date().toISOString().slice(0, 10)

          const pageType = detectPageType(realAction, item.type)
          const dir = pageType === "query" ? "queries" : pageType === "entity" ? "entities" : pageType === "concept" ? "concepts" : "queries"
          const fileName = `${slug}-${date}.md`
          const filePath = `${pp}/wiki/${dir}/${fileName}`

          const frontmatter = `---\ntype: ${pageType}\ntitle: "${title.replace(/"/g, '\\"')}"\ncreated: ${date}\ntags: []\nrelated: []\n---\n\n`
          const body = `# ${title}\n\n${item.description}\n`
          await writeFile(filePath, frontmatter + body)

          const indexPath = `${pp}/wiki/index.md`
          let indexContent = ""
          try { indexContent = await readFile(indexPath) } catch { indexContent = "# Wiki Index\n" }
          const sectionHeader = `## ${dir.charAt(0).toUpperCase() + dir.slice(1)}`
          const entry = `- [[${dir}/${slug}-${date}|${title}]]`
          if (indexContent.includes(sectionHeader)) {
            indexContent = indexContent.replace(new RegExp(`(${sectionHeader}\n)`), `$1${entry}\n`)
          } else {
            indexContent = indexContent.trimEnd() + `\n\n${sectionHeader}\n${entry}\n`
          }
          await writeFile(indexPath, indexContent)

          const logPath = `${pp}/wiki/log.md`
          let logContent = ""
          try { logContent = await readFile(logPath) } catch { logContent = "# Wiki Log\n" }
          await writeFile(logPath, logContent.trimEnd() + `\n- ${date}: Created ${pageType} page \`${fileName}\` from review\n`)

          const tree = await listDirectory(pp)
          setFileTree(tree)
          useWikiStore.getState().bumpDataVersion()

          resolveItem(id, novelMode ? i18n.t("novel.review.notifications.created", { title }) : i18n.t("review.notifications.createdPage", { title }))
        } catch (err) {
          console.error("审稿创建页面失败:", err)
          resolveItem(id, novelMode ? i18n.t("novel.review.notifications.createFailed") : i18n.t("review.notifications.createFailed"))
        }
      } else {
        resolveItem(id, i18n.t("review.fallbacks.genericActionLabel"))
      }
    } else {
      resolveItem(id, i18n.t("review.fallbacks.genericActionLabel"))
    }
  }, [project, items, resolveItem, setFileTree])

  const pending = items.filter((i) => !i.resolved)
  const resolved = items.filter((i) => i.resolved)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {t(novelMode ? "novel.review.title" : "review.title")}
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {pending.length}
            </span>
          )}
        </h2>
        {novelMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNovelReview}
            disabled={isReviewing}
            className="ml-auto"
          >
            {isReviewing ? t("novel.review.reviewing") : t("novel.review.startReview")}
          </Button>
        )}
        {resolved.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearResolved} className="text-xs">
            <Trash2 className="mr-1 h-3 w-3" />
            {t(novelMode ? "novel.review.clearResolved" : "review.clearResolved")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {reviewError && (
          <div className="m-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{reviewError}</span>
          </div>
        )}
        {items.length === 0 && novelReviewResults.length === 0 && reviewHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
            <p>{t(novelMode ? "novel.review.allClear" : "review.allClear")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {pending.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                onResolve={handleResolve}
                onDismiss={dismissItem}
              />
            ))}
            {resolved.length > 0 && pending.length > 0 && (
              <div className="my-2 text-center text-xs text-muted-foreground">
                — {t(novelMode ? "novel.review.resolvedSeparator" : "review.resolvedSeparator")} —
              </div>
            )}
            {resolved.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                onResolve={handleResolve}
                onDismiss={dismissItem}
              />
            ))}
            {novelReviewResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t("novel.review.resultsTitle")}
                </h3>
                {novelReviewResults.map((result, i) => {
                  const severityKey = `review.results.severity.${result.severity}`
                  const dimensionKey = `review.results.dimension.${result.type}`
                  const severityLabel = i18n.exists(severityKey) ? i18n.t(severityKey) : result.severity
                  const typeLabel = i18n.exists(dimensionKey) ? i18n.t(dimensionKey) : result.type

                  return (
                    <div
                      key={i}
                      onClick={() => void openReviewSource()}
                      className={`cursor-pointer rounded-md border p-3 text-sm transition-colors hover:border-primary/50 ${
                        result.severity === "error"
                          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                          : result.severity === "warning"
                            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                            : "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{typeLabel}</span>
                        <span className="text-xs text-muted-foreground">{severityLabel}</span>
                      </div>
                      <p className="mt-1">{result.message}</p>
                      {result.evidence && (
                        <p className="mt-1 text-xs text-muted-foreground italic">「{result.evidence}」</p>
                      )}
                      {result.suggestion && (
                        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                          💡 {result.suggestion}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {reviewHistory.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t("novel.review.historyTitle")}
                </h3>
                {reviewHistory.map((entry) => {
                  const entryResults = entry.results as NovelReviewResult[]
                  const errors = entryResults.filter((result) => result.severity === "error").length
                  const warnings = entryResults.filter((result) => result.severity === "warning").length
                  const expanded = expandedHistoryId === entry.id
                  return (
                    <div key={entry.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left font-medium hover:text-primary"
                          onClick={() => setExpandedHistoryId(expanded ? null : entry.id)}
                        >
                          <span className="block truncate">{entry.title}</span>
                          <span className="text-muted-foreground">{entry.createdAt.slice(0, 10)} · {t("novel.review.historySummary", { errors, warnings })}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteHistory(entry)}
                          className="shrink-0 text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          {t("novel.history.delete")}
                        </button>
                      </div>
                      {expanded && (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          {entryResults.length === 0 ? (
                            <p className="text-muted-foreground">{t("novel.history.emptyResult")}</p>
                          ) : entryResults.map((result, index) => (
                            <div key={`${entry.id}-${index}`} className="rounded bg-muted/50 p-2">
                              <div className="font-medium">{i18n.exists(`review.results.dimension.${result.type}`) ? i18n.t(`review.results.dimension.${result.type}`) : result.type}</div>
                              <div className="text-muted-foreground">{result.message}</div>
                              {result.suggestion && <div className="mt-1 text-green-700 dark:text-green-400">{result.suggestion}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {novelMode && cognitionState && (
              <div className="mt-4 rounded-md border">
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                  onClick={() => setCognitionExpanded(!cognitionExpanded)}
                >
                  <span>{t("novel.cognition.title")}</span>
                  <span className="text-[10px]">{cognitionExpanded ? "▲" : "▼"}</span>
                </button>
                {cognitionExpanded && (
                  <div className="space-y-2 border-t px-3 py-2 text-xs">
                    {cognitionState.lastUpdatedChapter > 0 && (
                      <p className="text-muted-foreground">
                        {t("novel.cognition.lastUpdated", { chapter: cognitionState.lastUpdatedChapter })}
                      </p>
                    )}
                    {cognitionState.characters.length === 0 && cognitionState.readerKnows.length === 0 ? (
                      <p className="text-muted-foreground">{t("novel.cognition.noData")}</p>
                    ) : (
                      <>
                        {cognitionState.characters.map((char) => (
                          <div key={char.character}>
                            <p className="font-medium">{char.character}</p>
                            {char.knows.length > 0 && (
                              <p className="ml-3 text-muted-foreground">
                                {t("novel.cognition.knows")}：{char.knows.join("、")}
                              </p>
                            )}
                            {char.doesNotKnow.length > 0 && (
                              <p className="ml-3 text-muted-foreground">
                                {t("novel.cognition.doesNotKnow")}：{char.doesNotKnow.join("、")}
                              </p>
                            )}
                          </div>
                        ))}
                        {cognitionState.readerKnows.length > 0 && (
                          <div>
                            <p className="font-medium">{t("novel.cognition.readerKnows")}</p>
                            <p className="ml-3 text-muted-foreground">{cognitionState.readerKnows.join("、")}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewCard({
  item,
  onResolve,
  onDismiss,
}: {
  item: ReviewItem
  onResolve: (id: string, action: string) => void
  onDismiss: (id: string) => void
}) {
  const { t } = useTranslation()
  const novelMode = useWikiStore((s) => s.novelMode)
  const config = typeConfig[item.type]
  const Icon = config.icon

  return (
    <div
      className={`rounded-lg border p-3 text-sm transition-opacity ${
        item.resolved ? "opacity-50" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
          <span className="text-xs text-muted-foreground">{t(novelMode ? config.novelLabelKey : config.labelKey)}</span>
          <span className="font-medium">{item.title}</span>
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{item.description}</p>

      {item.affectedPages && item.affectedPages.length > 0 && (
        <div className="mb-3 text-xs text-muted-foreground">
          {t(novelMode ? "novel.review.pages" : "review.pages")}: {item.affectedPages.join(", ")}
        </div>
      )}

      {!item.resolved ? (
        <div className="flex flex-wrap gap-1.5">
          {item.options.map((opt) => (
            <Button
              key={opt.action}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onResolve(item.id, opt.action)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3 w-3" />
          {item.resolvedAction}
        </div>
      )}
    </div>
  )
}

function actionIsDismissal(action: string): boolean {
  const lower = action.toLowerCase()
  return (
    lower === "skip" ||
    lower === "dismiss" ||
    lower === "ignore" ||
    lower === "跳过" ||
    lower === "忽略" ||
    lower === "approve" ||
    lower === "keep existing" ||
    lower === "no"
  )
}

function actionLooksLikeCreate(action: string): boolean {
  return !actionIsDismissal(action)
}

function detectPageType(action: string, reviewType: string): string {
  const lower = action.toLowerCase()
  if (lower.includes("entity") || lower.includes("实体")) return "entity"
  if (lower.includes("concept") || lower.includes("概念")) return "concept"
  if (lower.includes("comparison") || lower.includes("compare") || lower.includes("比较")) return "comparison"
  if (lower.includes("synthesis") || lower.includes("综合")) return "synthesis"
  if (reviewType === "missing-page") return "query"
  if (reviewType === "contradiction" || reviewType === "duplicate") return "entity"
  return "query"
}
