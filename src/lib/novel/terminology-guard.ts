import { readFile } from "@/commands/fs"
import { joinPath, normalizePath } from "@/lib/path-utils"

export interface TermCategory {
  name: string
  terms: string[]
  description: string
}

const DEFAULT_CATEGORIES: TermCategory[] = [
  {
    name: "角色名",
    terms: [],
    description: "所有已定义角色名不得被替换或修改",
  },
  {
    name: "地名/场景",
    terms: [],
    description: "地名和场景名称必须保持一致",
  },
  {
    name: "称谓/称呼",
    terms: [],
    description: "角色之间的称谓和自称必须符合人设，不可随意变更",
  },
  {
    name: "时代限定词",
    terms: [],
    description: "禁止出现不符合故事时代背景的现代用语",
  },
  {
    name: "特殊道具/物品",
    terms: [],
    description: "特殊道具名称和设定保持统一",
  },
]

function parseCategoriesFromMarkdown(content: string): TermCategory[] {
  const categories: TermCategory[] = []
  const lines = content.split("\n")
  let currentCategory: TermCategory | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    if (trimmed.startsWith("## ")) {
      if (currentCategory && currentCategory.terms.length > 0) {
        categories.push(currentCategory)
      }
      currentCategory = {
        name: trimmed.slice(3).trim(),
        terms: [],
        description: "",
      }
      continue
    }

    if (currentCategory) {
      if (trimmed.startsWith("- ")) {
        const term = trimmed.slice(2).trim()
        if (term) {
          currentCategory.terms.push(term)
        }
      } else if (trimmed.startsWith("> ")) {
        currentCategory.description = (currentCategory.description
          ? currentCategory.description + "; "
          : "") + trimmed.slice(2).trim()
      }
    }
  }

  if (currentCategory && currentCategory.terms.length > 0) {
    categories.push(currentCategory)
  }

  return categories
}

async function loadProjectTerminology(projectPath: string): Promise<TermCategory[]> {
  try {
    const pp = normalizePath(projectPath)
    const termPath = joinPath(pp, "terminology.md")
    const content = await readFile(termPath)
    if (!content) return []
    const categories = parseCategoriesFromMarkdown(content)
    if (categories.length > 0) {
      return categories
    }
    const terms = content.split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"))
    if (terms.length > 0) {
      return [{ name: "术语", terms, description: "项目自定义术语约束" }]
    }
  } catch {
    // terminology.md not found or unreadable, use defaults
  }
  return []
}

export async function buildTerminologyGuardPrompt(projectPath?: string): Promise<string> {
  const activeCategories: TermCategory[] = []

  if (projectPath) {
    const projectTerms = await loadProjectTerminology(projectPath)
    for (const cat of projectTerms) {
      const existing = activeCategories.find(c => c.name === cat.name)
      if (existing) {
        existing.terms = [...new Set([...existing.terms, ...cat.terms])]
        if (cat.description) existing.description = cat.description
      } else {
        activeCategories.push(cat)
      }
    }
  }

  if (activeCategories.length === 0) {
    activeCategories.push(...DEFAULT_CATEGORIES.map(c => ({ ...c, terms: [...c.terms] })))
  }

  const lines: string[] = []
  lines.push("【术语约束规则】")
  lines.push("以下术语必须严格遵守，在写作过程中不可替换、不可改写、不可遗漏：")
  lines.push("")

  for (const cat of activeCategories) {
    if (cat.terms.length === 0) continue
    lines.push(`### ${cat.name}`)
    if (cat.description) {
      lines.push(`> ${cat.description}`)
    }
    for (const term of cat.terms) {
      lines.push(`- ${term}`)
    }
    lines.push("")
  }

  if (lines.length <= 3) {
    return ""
  }

  return lines.join("\n")
}

export function getDefaultTerminologyCategories(): TermCategory[] {
  return DEFAULT_CATEGORIES.map(c => ({ ...c, terms: [...c.terms] }))
}