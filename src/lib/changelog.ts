export interface ChangelogEntry {
  version: string
  date: string
  highlights: {
    en: string[]
    zh: string[]
  }
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.4.10",
    date: "2026-05-20",
    highlights: {
      en: [
        "更新为小说写作助手定位，围绕长篇小说创作整理章节、大纲、人物状态、伏笔、时间线和图谱能力。",
        "强化写作上下文、章节记忆、审稿检查与长篇连续性相关功能，减少长篇创作中的遗忘和设定冲突。",
        "更新设置页更新日志，只显示当前软件版本的实际修改内容，并移除原项目历史更新记录。",
        "移除关于页中的原项目介绍信息，避免继续展示旧项目来源说明。",
      ],
      zh: [
        "更新为小说写作助手定位，围绕长篇小说创作整理章节、大纲、人物状态、伏笔、时间线和图谱能力。",
        "强化写作上下文、章节记忆、审稿检查与长篇连续性相关功能，减少长篇创作中的遗忘和设定冲突。",
        "更新设置页更新日志，只显示当前软件版本的实际修改内容，并移除原项目历史更新记录。",
        "移除关于页中的原项目介绍信息，避免继续展示旧项目来源说明。",
      ],
    },
  },
]

export function currentVersionChangelog(version: string): ChangelogEntry[] {
  return CHANGELOG.filter((entry) => entry.version === version)
}
