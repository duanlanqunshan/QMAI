import { listDirectory, readFile } from "@/commands/fs"

export function extractChapterNumber(text: string): number | null {
  const m = text.match(/第\s*(\d+)\s*[章节回]/)
  if (m?.[1]) return Number.parseInt(m[1], 10)
  const n = text.match(/(\d+)/)
  if (n?.[1]) return Number.parseInt(n[1], 10)
  return null
}

export function flattenMdFiles(nodes: Array<{ name: string; path: string; is_dir: boolean; children?: any[] }>): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = []
  for (const node of nodes) {
    if (node.is_dir) {
      if (node.children) out.push(...flattenMdFiles(node.children))
      continue
    }
    if (node.name.endsWith(".md")) {
      out.push({ name: node.name, path: node.path })
    }
  }
  return out
}

export async function getNextChapterNumber(projectPath: string): Promise<number> {
  let maxNum = 0
  let hasChapterOne = false
  try {
    const tree = await listDirectory(`${projectPath}/wiki/chapters`)
    const files = flattenMdFiles(tree)
    for (const file of files) {
      const byName = extractChapterNumber(file.name.replace(/\.md$/, ""))
      if (byName) {
        if (byName === 1) hasChapterOne = true
        if (byName > maxNum) maxNum = byName
      }
      try {
        const content = await readFile(file.path)
        const byFrontmatter = content.match(/^chapter_number:\s*(\d+)\s*$/m)
        if (byFrontmatter?.[1]) {
          const n = Number.parseInt(byFrontmatter[1], 10)
          if (n === 1) hasChapterOne = true
          if (n > maxNum) maxNum = n
        } else {
          const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m)
          const byTitle = titleMatch?.[1] ? extractChapterNumber(titleMatch[1]) : null
          if (byTitle) {
            if (byTitle === 1) hasChapterOne = true
            if (byTitle > maxNum) maxNum = byTitle
          }
        }
      } catch {
        // ignore unreadable chapter file
      }
    }
  } catch {
    // chapter dir may not exist yet
  }
  if (!hasChapterOne && maxNum === 0) return 1
  return maxNum + 1
}