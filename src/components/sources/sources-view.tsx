import { useState } from "react"
import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useWikiStore } from "@/stores/wiki-store"
import { OutlineGeneratorDialog, type OutlineGeneratorMode } from "@/components/sources/outline-generator-dialog"
import { PreviewPanel } from "@/components/layout/preview-panel"
import { addOutlineFileToSourceList } from "@/lib/novel/outline-generation"
import { getFileCategory } from "@/lib/file-types"

function isOutlinePath(path: string): boolean {
  return path.replace(/\\/g, "/").includes("/wiki/outlines/")
}

export function SourcesView() {
  const { t } = useTranslation()
  const novelMode = useWikiStore((s) => s.novelMode)
  const project = useWikiStore((s) => s.project)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const [outlineDialogOpen, setOutlineDialogOpen] = useState(false)
  const [outlineDialogMode, setOutlineDialogMode] = useState<OutlineGeneratorMode>("outline")
  const [addingToList, setAddingToList] = useState(false)

  const canAddCurrentOutlineToList = Boolean(
    novelMode &&
    project?.path &&
    selectedFile &&
    getFileCategory(selectedFile) === "markdown" &&
    isOutlinePath(selectedFile),
  )

  function openOutlineDialog(mode: OutlineGeneratorMode) {
    setOutlineDialogMode(mode)
    setOutlineDialogOpen(true)
  }

  async function handleAddCurrentOutlineToList() {
    if (!project?.path || !selectedFile || addingToList) return
    setAddingToList(true)
    try {
      await addOutlineFileToSourceList(project.path, selectedFile)
    } finally {
      setAddingToList(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t(novelMode ? "novel.sources.title" : "sources.title")}</h2>
        <div className="flex flex-wrap gap-1">
          {novelMode ? (
            <Button size="sm" onClick={() => openOutlineDialog("outline")}>
              <Sparkles className="mr-1 h-4 w-4" />
              {t("novel.outlineGenerator.title")}
            </Button>
          ) : null}
          {novelMode ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleAddCurrentOutlineToList()}
              disabled={!canAddCurrentOutlineToList || addingToList}
              title={canAddCurrentOutlineToList ? "将当前打开的大纲加入左侧大纲列表" : "请先打开一个大纲文件"}
            >
              {addingToList ? "加入中..." : "加入到大纲列表"}
            </Button>
          ) : null}
          {novelMode ? (
            <Button size="sm" variant="outline" onClick={() => openOutlineDialog("refine")}>
              {t("novel.outlineGenerator.refineTitle")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <PreviewPanel />
      </div>

      <OutlineGeneratorDialog
        open={outlineDialogOpen}
        onOpenChange={setOutlineDialogOpen}
        mode={outlineDialogMode}
      />
    </div>
  )
}
