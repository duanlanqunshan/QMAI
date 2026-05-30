import { beforeEach, describe, expect, it } from "vitest"
import { useOutlineGenerationStore } from "./outline-generation-store"

beforeEach(() => {
  useOutlineGenerationStore.setState({ tasks: [], panelOpen: false })
})

describe("outline-generation-store", () => {
  it("创建生成任务后，即使弹窗关闭，任务状态仍然保留", () => {
    const store = useOutlineGenerationStore.getState()
    const id = store.createTask({
      projectPath: "/project",
      genre: "general",
      scale: "medium",
      premise: "一个人在黑雨末世里复仇。",
      prompt: "完整提示词",
    })

    store.setPanelOpen(false)

    const task = useOutlineGenerationStore.getState().tasks.find((item: { id: string }) => item.id === id)
    expect(task).toBeTruthy()
    expect(task?.status).toBe("generating")
    expect(task?.outlinePath).toBeNull()
  })

  it("可以更新任务为已生成状态并记录大纲路径", () => {
    const store = useOutlineGenerationStore.getState()
    const id = store.createTask({
      projectPath: "/project",
      genre: "general",
      scale: "medium",
      premise: "一个人在黑雨末世里复仇。",
      prompt: "完整提示词",
    })

    store.updateTask(id, {
      status: "generated",
      outlinePath: "/project/wiki/outlines/story-outline.md",
      message: "大纲已生成完成",
    })

    const task = useOutlineGenerationStore.getState().tasks.find((item: { id: string }) => item.id === id)
    expect(task?.status).toBe("generated")
    expect(task?.outlinePath).toBe("/project/wiki/outlines/story-outline.md")
    expect(task?.message).toBe("大纲已生成完成")
  })

  it("可以移除已完成任务", () => {
    const store = useOutlineGenerationStore.getState()
    const id = store.createTask({
      projectPath: "/project",
      genre: "general",
      scale: "medium",
      premise: "一个人在黑雨末世里复仇。",
      prompt: "完整提示词",
    })

    store.removeTask(id)

    const task = useOutlineGenerationStore.getState().tasks.find((item: { id: string }) => item.id === id)
    expect(task).toBeUndefined()
  })

  it("支持细化生成任务的后台元数据", () => {
    const store = useOutlineGenerationStore.getState()
    const id = store.createTask({
      projectPath: "/project",
      kind: "refine",
      userRequest: "只生成人物小传",
      selectedSectionKey: "characterBriefs",
      displayTitle: "人物小传",
      writeMode: "newFileAndAddToList",
    })

    const task = useOutlineGenerationStore.getState().tasks.find((item: { id: string }) => item.id === id)
    expect(task?.kind).toBe("refine")
    expect(task?.userRequest).toBe("只生成人物小传")
    expect(task?.selectedSectionKey).toBe("characterBriefs")
    expect(task?.displayTitle).toBe("人物小传")
    expect(task?.writeMode).toBe("newFileAndAddToList")
  })
})
