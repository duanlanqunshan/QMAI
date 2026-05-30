# 青幕AI写作（QMAI）

青幕AI写作（QMAI）是一个面向长篇小说创作的桌面软件。它把项目管理、章节写作、AI 对话、审稿检查、图谱检索和写作设置放进同一个本地应用里，目标是让小说项目在长周期写作中更容易保持上下文连续。

## 简介

当前仓库是 Windows 桌面端主工程，技术栈以 `Tauri 2 + React 19 + TypeScript + Rust` 为主。项目保留了本地文件可控的工作方式，章节、设定、大纲和相关数据都以项目目录形式存放，方便备份和迁移。

## 当前主要功能

- 小说项目创建、切换、最近项目恢复
- 章节与大纲文件管理
- AI 对话驱动的章节生成、续写、改写与润色
- 小说模式下的角色灵魂绑定与上下文注入
- 章节审稿、连贯性检查、事实快照与审查中心
- 剧情搜索、图谱视图、活动侧栏与项目文件同步
- 模型、代理、嵌入、审稿、写作相关设置
- Windows 便携版打包

## 当前技术栈

- 前端：`React 19`、`TypeScript`、`Vite`
- 桌面壳：`Tauri 2`
- 后端命令层：`Rust`
- 状态管理：`Zustand`
- 测试：`Vitest`

## 本地开发

安装依赖：

```powershell
npm install
```

启动开发环境：

```powershell
npm run dev
```

类型检查：

```powershell
npm run typecheck
```

运行主要本地测试：

```powershell
npm run test:mocks
```

## Windows 打包

生成当前项目使用的便携版：

```powershell
npm run build:portable
```

输出目录：

- `E:\QMAI\release-portable\QMaiWrite.exe`

如果需要生成 GitHub Releases 用的安装包和更新文件，请先准备 updater 签名密钥，再执行：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\qmai-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run build:github-release
```

输出目录：

- `E:\QMAI\release-github\`

## GitHub Releases 下载与自动更新

当前发布渠道使用 GitHub Releases。

- 源码仓库：`https://github.com/Mochocyang/QMAI`
- 更新描述文件：`latest.json`
- Windows 安装更新包：由 Tauri 构建产物生成

从本版本开始，桌面端会在启动后检查 GitHub Releases 中是否存在更新；检测到新版本后，会提示用户下载并安装。更新安装阶段会关闭当前软件，所以在确认更新前请先保存正在编辑的内容。

## 注意事项

- `C:\Users\Administrator\.tauri\qmai-updater.key` 是私钥，不能上传到 GitHub，也不能分享给其他人。
- 中国区用户通过 GitHub 下载更新时，速度会受网络情况影响。
- 便携版 `QMaiWrite.exe` 和 GitHub Release 安装包是两条并行发布产物，发版时都需要核对版本和时间戳。
- 仓库中的功能说明应以当前实际可运行版本为准，不应把未实现的规划写进发布说明。
