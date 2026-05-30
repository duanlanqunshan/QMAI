// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import i18n from "@/i18n"
import { useWikiStore } from "@/stores/wiki-store"
import type { FileNode } from "@/types/wiki"
import { KnowledgeTree } from "./knowledge-tree"

const mocks = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  fileExists: vi.fn(),
  listDirectory: vi.fn(),
  openFileLocation: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  moveFileToTrash: vi.fn(),
  deleteChapterSnapshots: vi.fn(),
}))

vi.mock("@/commands/fs", () => ({
  deleteFile: mocks.deleteFile,
  fileExists: mocks.fileExists,
  listDirectory: mocks.listDirectory,
  openFileLocation: mocks.openFileLocation,
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
}))

vi.mock("@/lib/trash", () => ({
  moveFileToTrash: mocks.moveFileToTrash,
}))

vi.mock("@/lib/novel/chapter-ingest", () => ({
  deleteChapterSnapshots: mocks.deleteChapterSnapshots,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className,
    onClick,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" className={className} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

const projectPath = "/proj"
const wikiPath = `${projectPath}/wiki`
const chaptersPath = `${wikiPath}/chapters`
const chapterAPath = `${chaptersPath}/chapter-a.md`
const chapterBPath = `${chaptersPath}/chapter-b.md`
const chapterCPath = `${chaptersPath}/chapter-c.md`
const renameLabel = i18n.t("knowledgeTree.rename")

const titleA = "1-Alpha"
const titleB = "2-Beta"
const titleC = "3-Gamma"
const titleByPath: Record<string, string> = {
  [chapterAPath]: titleA,
  [chapterBPath]: titleB,
  [chapterCPath]: titleC,
}

let fileContents: Record<string, string>
let host: HTMLDivElement
let root: Root

function buildChapterContent(chapterNumber: number, title: string) {
  return `---
title: ${title}
chapter_number: ${chapterNumber}
---
# ${title}

body
`
}

function buildChapterNodes(): FileNode[] {
  return Object.keys(fileContents)
    .sort()
    .map((path) => ({
      name: path.split("/").pop() ?? "",
      path,
      is_dir: false,
    }))
}

function buildWikiTree(): FileNode[] {
  return [
    {
      name: "chapters",
      path: chaptersPath,
      is_dir: true,
      children: buildChapterNodes(),
    },
  ]
}

function buildProjectTree(): FileNode[] {
  return [
    {
      name: "wiki",
      path: wikiPath,
      is_dir: true,
      children: buildWikiTree(),
    },
  ]
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function click(node: HTMLElement | null) {
  if (!node) {
    throw new Error("click target not found")
  }

  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    await Promise.resolve()
  })
  await flush()
}

function createPointerEvent(
  type: string,
  init: {
    bubbles?: boolean
    button?: number
    buttons?: number
    cancelable?: boolean
    clientX?: number
    clientY?: number
    pointerId?: number
    pointerType?: string
  } = {},
) {
  const event = new MouseEvent(type, {
    bubbles: init.bubbles ?? true,
    button: init.button ?? 0,
    buttons: init.buttons ?? 0,
    cancelable: init.cancelable ?? true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  })

  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? "mouse" },
  })

  return event
}

function getPageButton(path: string): HTMLButtonElement {
  const title = titleByPath[path]
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes(title))
  if (!button) {
    throw new Error(`page button not found: ${path}`)
  }
  return button
}

function getPageRow(path: string): HTMLElement {
  const button = getPageButton(path)
  const row = button.closest<HTMLElement>("[data-page-path]")
  if (!row) {
    throw new Error(`page row not found: ${path}`)
  }
  return row
}

function getButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim().includes(text))
  if (!button) {
    throw new Error(`button not found: ${text}`)
  }
  return button
}

function getTreeContainer(): HTMLElement {
  const container = host.querySelector<HTMLElement>(".relative.flex.min-h-full.flex-col")
  if (!container) {
    throw new Error("tree container not found")
  }
  return container
}

function getTextInput(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input[type="text"]')
  if (!input) {
    throw new Error("text input not found")
  }
  return input
}

function mockRowRect(row: HTMLElement, top: number, height = 24) {
  const bottom = top + height
  const domRect = {
    top,
    bottom,
    height,
    left: 0,
    right: 200,
    width: 200,
    x: 0,
    y: top,
    toJSON: () => domRect,
  }
  vi.spyOn(row, "getBoundingClientRect").mockReturnValue(domRect as DOMRect)
}

describe("knowledge-tree selected long press insert reorder", () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

    fileContents = {
      [chapterAPath]: buildChapterContent(1, titleA),
      [chapterBPath]: buildChapterContent(2, titleB),
      [chapterCPath]: buildChapterContent(3, titleC),
    }

    mocks.readFile.mockImplementation(async (path: string) => {
      const content = fileContents[path]
      if (!content) throw new Error(`missing file: ${path}`)
      return content
    })

    mocks.writeFile.mockImplementation(async (path: string, content: string) => {
      fileContents[path] = content
    })

    mocks.deleteFile.mockImplementation(async (path: string) => {
      delete fileContents[path]
    })

    mocks.fileExists.mockImplementation(async (path: string) => Object.prototype.hasOwnProperty.call(fileContents, path))

    mocks.listDirectory.mockImplementation(async (path: string) => {
      if (path === wikiPath) return buildWikiTree()
      if (path === projectPath) return buildProjectTree()
      return []
    })

    useWikiStore.setState({
      project: { id: "proj-1", name: "proj", path: projectPath },
      selectedFile: null,
      fileTree: buildProjectTree(),
      dataVersion: 0,
    })

    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => null),
    })

    await act(async () => {
      root.render(<KnowledgeTree filterType="chapter" />)
    })
    await flush()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("opens a chapter on click", async () => {
    await click(getPageButton(chapterAPath))

    expect(useWikiStore.getState().selectedFile).toBe(chapterAPath)
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it("does not start dragging when the chapter is not selected", async () => {
    const pageButtonA = getPageButton(chapterAPath)
    const pageButtonB = getPageButton(chapterBPath)
    const treeContainer = getTreeContainer()

    vi.spyOn(document, "elementFromPoint").mockReturnValue(pageButtonB)

    await act(async () => {
      pageButtonA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
      vi.advanceTimersByTime(320)
      treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 48 }))
      window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 48 }))
      await Promise.resolve()
    })
    await flush()

    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it("inserts source chapter below the hover target on reorder drop", async () => {
    const rowA = getPageRow(chapterAPath)
    const rowC = getPageRow(chapterCPath)
    const treeContainer = getTreeContainer()

    await click(getPageButton(chapterAPath))
    mockRowRect(rowC, 72, 24)
    vi.spyOn(document, "elementFromPoint").mockReturnValue(rowC)

    await act(async () => {
      rowA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
      vi.advanceTimersByTime(320)
      treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 84 }))
      window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 84 }))
      await Promise.resolve()
    })
    await flush()

    expect(mocks.writeFile).toHaveBeenCalledTimes(3)
    expect(mocks.deleteFile).not.toHaveBeenCalled()
    expect(fileContents[chapterAPath]).toContain("chapter_number: 3")
    expect(fileContents[chapterAPath]).toContain(`title: ${titleA}`)
    expect(fileContents[chapterBPath]).toContain("chapter_number: 1")
    expect(fileContents[chapterBPath]).toContain(`title: ${titleB}`)
    expect(fileContents[chapterCPath]).toContain("chapter_number: 2")
    expect(fileContents[chapterCPath]).toContain(`title: ${titleC}`)
    const rows = Array.from(host.querySelectorAll<HTMLElement>("[data-page-path]"))
      .map((node) => node.textContent?.trim() ?? "")
    expect(rows[0]).toContain(titleB)
    expect(rows[1]).toContain(titleC)
    expect(rows[2]).toContain(titleA)
  })

  it("inserts source chapter above the hover target on reorder drop", async () => {
    const rowA = getPageRow(chapterAPath)
    const rowC = getPageRow(chapterCPath)
    const treeContainer = getTreeContainer()

    await click(getPageButton(chapterAPath))
    mockRowRect(rowC, 72, 24)
    vi.spyOn(document, "elementFromPoint").mockReturnValue(rowC)

    await act(async () => {
      rowA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 8, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
      vi.advanceTimersByTime(320)
      treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 8, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 76 }))
      window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 8, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 76 }))
      await Promise.resolve()
    })
    await flush()

    expect(mocks.writeFile).toHaveBeenCalledTimes(2)
    expect(fileContents[chapterAPath]).toContain("chapter_number: 2")
    expect(fileContents[chapterAPath]).toContain(`title: ${titleA}`)
    expect(fileContents[chapterBPath]).toContain("chapter_number: 1")
    expect(fileContents[chapterBPath]).toContain(`title: ${titleB}`)
    expect(fileContents[chapterCPath]).toContain("chapter_number: 3")
    expect(fileContents[chapterCPath]).toContain(`title: ${titleC}`)
    const rows = Array.from(host.querySelectorAll<HTMLElement>("[data-page-path]"))
      .map((node) => node.textContent?.trim() ?? "")
    expect(rows[0]).toContain(titleB)
    expect(rows[1]).toContain(titleA)
    expect(rows[2]).toContain(titleC)
  })

  it("still reorders when the mouse starts moving before the long-press timer completes", async () => {
    const rowA = getPageRow(chapterAPath)
    const rowC = getPageRow(chapterCPath)
    const treeContainer = getTreeContainer()

    await click(getPageButton(chapterAPath))
    mockRowRect(rowC, 72, 24)
    vi.spyOn(document, "elementFromPoint").mockReturnValue(rowC)

    await act(async () => {
      rowA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 9, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
      treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 9, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 84 }))
      vi.advanceTimersByTime(320)
      window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 9, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 84 }))
      await Promise.resolve()
    })
    await flush()

    expect(mocks.writeFile).toHaveBeenCalledTimes(3)
    expect(fileContents[chapterAPath]).toContain("chapter_number: 3")
    expect(fileContents[chapterBPath]).toContain("chapter_number: 1")
    expect(fileContents[chapterCPath]).toContain("chapter_number: 2")
  })

  it("does not write when the dragged chapter lands at the same position", async () => {
    const rowA = getPageRow(chapterAPath)
    const treeContainer = getTreeContainer()

    await click(getPageButton(chapterAPath))
    mockRowRect(rowA, 12, 24)
    vi.spyOn(document, "elementFromPoint").mockReturnValue(rowA)

    await act(async () => {
      rowA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 10, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
      vi.advanceTimersByTime(320)
      treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 10, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 30 }))
      window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 10, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 30 }))
      await Promise.resolve()
    })
    await flush()

    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(fileContents[chapterAPath]).toContain("chapter_number: 1")
    expect(fileContents[chapterBPath]).toContain("chapter_number: 2")
    expect(fileContents[chapterCPath]).toContain("chapter_number: 3")
  })

  it("rolls back written chapters if reorder persistence fails midway", async () => {
    const originalA = fileContents[chapterAPath]
    const originalB = fileContents[chapterBPath]
    const originalC = fileContents[chapterCPath]
    const rowA = getPageRow(chapterAPath)
    const rowC = getPageRow(chapterCPath)
    const treeContainer = getTreeContainer()

    mocks.writeFile.mockImplementationOnce(async (path: string, content: string) => {
      fileContents[path] = content
    })
    mocks.writeFile.mockImplementationOnce(async () => {
      throw new Error("mid reorder write failed")
    })

    await click(getPageButton(chapterAPath))
    mockRowRect(rowC, 72, 24)
    vi.spyOn(document, "elementFromPoint").mockReturnValue(rowC)

    await act(async () => {
      rowA.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 10 }))
      vi.advanceTimersByTime(320)
      treeContainer.dispatchEvent(createPointerEvent("pointermove", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: 10, clientY: 84 }))
      window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 7, pointerType: "mouse", button: 0, buttons: 0, clientX: 10, clientY: 84 }))
      await Promise.resolve()
    })
    await flush()

    expect(fileContents[chapterAPath]).toBe(originalA)
    expect(fileContents[chapterBPath]).toBe(originalB)
    expect(fileContents[chapterCPath]).toBe(originalC)
  })

  it("prevents text selection from starting on chapter rows", async () => {
    const pageButton = getPageButton(chapterAPath)
    const row = pageButton.closest<HTMLElement>("[data-page-path]")
    if (!row) {
      throw new Error("page row not found")
    }
    const event = new Event("selectstart", { bubbles: true, cancelable: true })

    await act(async () => {
      row.dispatchEvent(event)
      await Promise.resolve()
    })

    expect(event.defaultPrevented).toBe(true)
  })

  it("allows renaming from the desktop right-click menu", async () => {
    const pageButton = getPageButton(chapterAPath)
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: 20,
      clientY: 20,
    })

    await act(async () => {
      pageButton.dispatchEvent(
        createPointerEvent("pointerdown", {
          pointerId: 1,
          pointerType: "mouse",
          button: 2,
          buttons: 2,
          clientX: 20,
          clientY: 20,
        }),
      )
      pageButton.dispatchEvent(event)
      await Promise.resolve()
    })
    await flush()

    await click(getButtonByText(renameLabel))

    expect(getTextInput().value).toBe(titleA)
  })

  it("rejects renaming a chapter to an existing chapter number", async () => {
    const pageButton = getPageButton(chapterAPath)
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: 20,
      clientY: 20,
    })

    await act(async () => {
      pageButton.dispatchEvent(
        createPointerEvent("pointerdown", {
          pointerId: 1,
          pointerType: "mouse",
          button: 2,
          buttons: 2,
          clientX: 20,
          clientY: 20,
        }),
      )
      pageButton.dispatchEvent(event)
      await Promise.resolve()
    })
    await flush()

    await click(getButtonByText(renameLabel))

    const input = getTextInput()
    await act(async () => {
      input.value = titleB
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new FocusEvent("blur", { bubbles: true }))
      await Promise.resolve()
    })
    await flush()

    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(fileContents[chapterAPath]).toContain(`title: ${titleA}`)
    expect(fileContents[chapterAPath]).toContain("chapter_number: 1")
  })

  it("keeps desktop right-click page menus working", async () => {
    const pageButton = getPageButton(chapterAPath)
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: 20,
      clientY: 20,
    })

    await act(async () => {
      pageButton.dispatchEvent(
        createPointerEvent("pointerdown", {
          pointerId: 1,
          pointerType: "mouse",
          button: 2,
          buttons: 2,
          clientX: 20,
          clientY: 20,
        }),
      )
      pageButton.dispatchEvent(event)
      await Promise.resolve()
    })
    await flush()

    expect(event.defaultPrevented).toBe(true)
    expect(getButtonByText(renameLabel)).toBeTruthy()
  })
})
