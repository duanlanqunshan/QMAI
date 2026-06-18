import { createDirectory, fileExists, listDirectory, readFile, writeFile } from "@/commands/fs"
import { getFileName, getFileStem, getRelativePath, normalizePath } from "@/lib/path-utils"
import type { FileNode } from "@/types/wiki"
import { makeSafeFileSlug } from "@/lib/wiki-filename"

export const OUTLINE_IMPORT_EXTENSIONS = [
  "md",
  "mdx",
  "txt",
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "odt",
  "ods",
  "odp",
  "xls",
  "csv",
  "json",
  "html",
  "htm",
  "rtf",
  "xml",
  "yaml",
  "yml",
] as const

const OUTLINE_IMPORT_EXTENSION_SET = new Set<string>(OUTLINE_IMPORT_EXTENSIONS)

export interface OutlineImportCandidate {
  path: string
  name: string
  targetFolders: string[]
}

type InferredOutlineMeta = {
  title: string
  targetFolders: string[]
  outlineType?: "chapter-outline" | "volume-outline" | "story-outline"
  outlineCategory?: "chapter" | "characters" | "locations" | "organizations" | "power-system" | "foreshadowing" | "story"
  chapterNumber?: number
}

function yamlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function sanitizeImportedBody(content: string): string {
  let next = content.replace(/^\uFEFF/, "").trim()
  const frontmatterMatch = next.match(/^---\n[\s\S]*?\n---\n?/)
  if (frontmatterMatch) {
    next = next.slice(frontmatterMatch[0].length).trim()
  }
  return next
}

function extractChapterNumber(text: string): number | undefined {
  const match = text.match(/第\s*(\d+)\s*[章节回]/i) ?? text.match(/chapter\s*(\d+)\b/i)
  if (!match?.[1]) return undefined
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function inferOutlineMeta(sourcePath: string, rawContent: string, targetFolders: string[] = []): InferredOutlineMeta {
  const normalizedPath = normalizePath(sourcePath)
  const title = getFileStem(normalizedPath).trim() || "untitled"
  const loweredTitle = title.toLowerCase()
  const loweredPath = normalizedPath.toLowerCase()
  const body = sanitizeImportedBody(rawContent)
  const loweredBody = body.slice(0, 4000).toLowerCase()
  const combined = `${loweredPath}\n${loweredTitle}\n${loweredBody}`
  const chapterNumber = extractChapterNumber(title) ?? extractChapterNumber(body)

  if (chapterNumber || /章节细纲|章纲|分章大纲|chapter outline/.test(combined)) {
    return {
      title,
      targetFolders: ["章节细纲"],
      outlineType: "chapter-outline",
      outlineCategory: "chapter",
      chapterNumber,
    }
  }
  if (/人物小传|人物设定|角色设定|character brief|character profile/.test(combined)) {
    return {
      title,
      targetFolders: ["人物小传"],
      outlineCategory: "characters",
    }
  }
  if (/组织势力|势力设定|阵营|组织设定|faction|organization/.test(combined)) {
    return {
      title,
      targetFolders: ["组织势力设定"],
      outlineCategory: "organizations",
    }
  }
  if (/金手指|能力体系|力量体系|规则体系|power system|ability system/.test(combined)) {
    return {
      title,
      targetFolders: ["金手指与能力体系"],
      outlineCategory: "power-system",
    }
  }
  if (/伏笔计划|伏笔|回收计划|foreshadow/.test(combined)) {
    return {
      title,
      targetFolders: ["伏笔计划"],
      outlineCategory: "foreshadowing",
    }
  }
  if (/地点设定|场景设定|地图设定|location|place setting/.test(combined)) {
    return {
      title,
      targetFolders: ["地点设定"],
      outlineCategory: "locations",
    }
  }
  if (/总大纲|故事大纲|剧情总纲|story outline|overall outline/.test(combined)) {
    return {
      title,
      targetFolders: ["总大纲"],
      outlineType: "story-outline",
      outlineCategory: "story",
    }
  }
  if (/分卷|卷纲|volume outline/.test(combined)) {
    return {
      title,
      targetFolders: ["分卷大纲"],
      outlineType: "volume-outline",
      outlineCategory: "story",
    }
  }
  return {
    title,
    targetFolders: targetFolders.length > 0 ? targetFolders : ["未分类导入"],
  }
}

function buildOutlineMarkdown(meta: InferredOutlineMeta, content: string, sourcePath: string): string {
  const body = sanitizeImportedBody(content)
  const relativeSourcePath = normalizePath(sourcePath)
  const lines = [
    "---",
    "type: outline",
    `title: "${yamlEscape(meta.title)}"`,
    ...(meta.outlineType ? [`outline_type: ${meta.outlineType}`] : []),
    ...(meta.outlineCategory ? [`outline_category: ${meta.outlineCategory}`] : []),
    ...(meta.targetFolders[0] ? [`outline_folder: "${yamlEscape(meta.targetFolders[0])}"`] : []),
    ...(meta.chapterNumber ? [`chapter_number: ${meta.chapterNumber}`] : []),
    `sources: ["${yamlEscape(relativeSourcePath)}"]`,
    "---",
    "",
  ]

  if (body.startsWith("#")) {
    lines.push(body)
  } else {
    lines.push(`# ${meta.title}`)
    if (body) {
      lines.push("")
      lines.push(body)
    }
  }

  lines.push("")
  return lines.join("\n")
}

function isOutlineImportablePath(path: string): boolean {
  const normalizedPath = normalizePath(path)
  const fileName = getFileName(normalizedPath)
  if (!fileName || fileName.startsWith(".")) return false
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? "" : ""
  return OUTLINE_IMPORT_EXTENSION_SET.has(extension)
}

async function ensureOutlineDirectory(projectPath: string, segments: string[]): Promise<string> {
  let current = `${normalizePath(projectPath)}/wiki/outlines`
  await createDirectory(current).catch(() => {})

  for (const segment of segments) {
    current = `${current}/${makeSafeFileSlug(segment, "folder")}`
    await createDirectory(current).catch(() => {})
  }

  return current
}

async function getUniqueOutlinePath(dir: string, fileName: string): Promise<string> {
  const firstPath = `${dir}/${fileName}`
  if (!(await fileExists(firstPath))) return firstPath

  const extensionIndex = fileName.lastIndexOf(".")
  const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : ""
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${dir}/${stem}-${index}${extension}`
    if (!(await fileExists(candidate))) return candidate
  }

  return `${dir}/${stem}-${Date.now()}${extension}`
}

async function importSingleOutlineFile(
  projectPath: string,
  sourcePath: string,
  targetFolders: string[] = [],
): Promise<string | null> {
  const normalizedSourcePath = normalizePath(sourcePath)
  if (!isOutlineImportablePath(normalizedSourcePath)) return null

  const content = await readFile(normalizedSourcePath)
  const meta = inferOutlineMeta(normalizedSourcePath, content, targetFolders)
  const targetDir = await ensureOutlineDirectory(projectPath, meta.targetFolders)
  const targetPath = await getUniqueOutlinePath(targetDir, `${makeSafeFileSlug(meta.title)}.md`)

  await writeFile(targetPath, buildOutlineMarkdown(meta, content, normalizedSourcePath))
  return targetPath
}

function collectImportableFiles(nodes: readonly FileNode[]): FileNode[] {
  const files: FileNode[] = []

  for (const node of nodes) {
    if (node.name.startsWith(".")) continue
    if (node.is_dir && node.children) {
      files.push(...collectImportableFiles(node.children))
      continue
    }
    if (!node.is_dir && isOutlineImportablePath(node.path)) {
      files.push(node)
    }
  }

  return files
}

export async function collectOutlineImportCandidatesFromFolder(selectedFolder: string): Promise<OutlineImportCandidate[]> {
  const normalizedFolder = normalizePath(selectedFolder)
  const rootFolderName = getFileName(normalizedFolder) || "imported-outline"
  const tree = await listDirectory(normalizedFolder)
  const sourceFiles = collectImportableFiles(tree)

  return sourceFiles.map((sourceFile) => {
    const relativePath = getRelativePath(normalizePath(sourceFile.path), normalizedFolder)
    const segments = relativePath.split("/").filter(Boolean)
    segments.pop()
    return {
      path: normalizePath(sourceFile.path),
      name: sourceFile.name,
      targetFolders: [rootFolderName, ...segments],
    }
  })
}

export async function importOutlineFiles(projectPath: string, sourcePaths: string[]): Promise<string[]> {
  const importedPaths: string[] = []

  for (const sourcePath of sourcePaths) {
    try {
      const importedPath = await importSingleOutlineFile(projectPath, sourcePath)
      if (importedPath) importedPaths.push(importedPath)
    } catch (error) {
      console.error("[outline-import] failed to import file:", sourcePath, error)
    }
  }

  return importedPaths
}

export async function importOutlineCandidates(
  projectPath: string,
  candidates: readonly OutlineImportCandidate[],
): Promise<string[]> {
  const importedPaths: string[] = []

  for (const candidate of candidates) {
    try {
      const importedPath = await importSingleOutlineFile(projectPath, candidate.path, candidate.targetFolders)
      if (importedPath) importedPaths.push(importedPath)
    } catch (error) {
      console.error("[outline-import] failed to import folder file:", candidate.path, error)
    }
  }

  return importedPaths
}

export async function importOutlineFolder(projectPath: string, selectedFolder: string): Promise<string[]> {
  const candidates = await collectOutlineImportCandidatesFromFolder(selectedFolder)
  return importOutlineCandidates(projectPath, candidates)
}
