# GitHub Updater And Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `QMAI` 接入基于 GitHub Releases 的免费自动更新能力，保留现有便携版打包，并补齐与当前软件状态一致的 `README.MD` 和中文发布文档。

**Architecture:** Rust 侧接入 Tauri 2 updater 插件，前端新增一个最小化更新检查模块并在应用初始化完成后触发。发布阶段通过一个 Node 脚本把 NSIS 安装包、签名文件、`latest.json` 和便携版 EXE 收拢到 `release-github` 目录，便于上传到 GitHub Releases。

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Node.js scripts, GitHub Releases

---

## File Structure

- Modify: `E:\QMAI\package.json`
- Modify: `E:\QMAI\package-lock.json`
- Modify: `E:\QMAI\src-tauri\Cargo.toml`
- Modify: `E:\QMAI\src-tauri\src\lib.rs`
- Modify: `E:\QMAI\src-tauri\tauri.conf.json`
- Modify: `E:\QMAI\src-tauri\capabilities\default.json`
- Modify: `E:\QMAI\src\App.tsx`
- Modify: `E:\QMAI\README.MD`
- Create: `E:\QMAI\src\lib\app-updater.ts`
- Create: `E:\QMAI\src\lib\app-updater.test.ts`
- Create: `E:\QMAI\scripts\prepare-github-release.mjs`
- Create: `E:\QMAI\docs\github-release-guide.md`

---

### Task 1: 接入 Tauri Updater 与 GitHub Release 产物配置

**Files:**
- Modify: `E:\QMAI\package.json`
- Modify: `E:\QMAI\package-lock.json`
- Modify: `E:\QMAI\src-tauri\Cargo.toml`
- Modify: `E:\QMAI\src-tauri\src\lib.rs`
- Modify: `E:\QMAI\src-tauri\tauri.conf.json`
- Modify: `E:\QMAI\src-tauri\capabilities\default.json`

- [ ] **Step 1: 生成 updater 签名密钥**

Run:
```powershell
npx tauri signer generate -w "$env:USERPROFILE\.tauri\qmai-updater.key"
```

Expected:
- 命令成功输出一条公钥字符串
- 本机生成：
  - `C:\Users\Administrator\.tauri\qmai-updater.key`
  - `C:\Users\Administrator\.tauri\qmai-updater.key.pub`

- [ ] **Step 2: 在 `package.json` 增加 updater 依赖与 GitHub 发布脚本**

Update `E:\QMAI\package.json`:
```json
{
  "scripts": {
    "build:portable": "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$env:CARGO_PROFILE_RELEASE_LTO='false'; $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS='16'; $env:CARGO_PROFILE_RELEASE_OPT_LEVEL='1'; npx tauri build --no-bundle; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node scripts/build-portable.mjs\"",
    "build:github-release": "powershell -NoProfile -ExecutionPolicy Bypass -Command \"if (-not $env:TAURI_SIGNING_PRIVATE_KEY) { throw '缺少 TAURI_SIGNING_PRIVATE_KEY' }; $env:CARGO_PROFILE_RELEASE_LTO='false'; $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS='16'; $env:CARGO_PROFILE_RELEASE_OPT_LEVEL='1'; npx tauri build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node scripts/build-portable.mjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node scripts/prepare-github-release.mjs\""
  },
  "dependencies": {
    "@tauri-apps/plugin-updater": "^2.8.0"
  }
}
```

- [ ] **Step 3: 在 Rust 侧接入 updater 插件**

Update `E:\QMAI\src-tauri\Cargo.toml`:
```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-updater = "2"
```

Update `E:\QMAI\src-tauri\src\lib.rs`:
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
```

- [ ] **Step 4: 增加 updater capability 与 Tauri 配置**

Update `E:\QMAI\src-tauri\capabilities\default.json`:
```json
{
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:window:allow-set-title",
    "core:webview:allow-create-webview-window",
    "opener:default",
    "dialog:default",
    "store:default",
    "updater:default"
  ]
}
```

Update `E:\QMAI\src-tauri\tauri.conf.json`:
```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/Mochocyang/QMAI/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

Then insert the exact public key emitted in Step 1 into `plugins.updater.pubkey`.

- [ ] **Step 5: 安装依赖并确认配置编译通过**

Run:
```powershell
npm install
npm run typecheck
```

Expected:
- `package-lock.json` 更新
- `npm run typecheck` 通过，没有新增 updater 相关报错

- [ ] **Step 6: 提交本任务**

Run:
```powershell
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "feat: add Tauri updater plumbing"
```

---

### Task 2: 新增前端自动更新流程与测试

**Files:**
- Create: `E:\QMAI\src\lib\app-updater.ts`
- Create: `E:\QMAI\src\lib\app-updater.test.ts`
- Modify: `E:\QMAI\src\App.tsx`

- [ ] **Step 1: 先写 updater 行为测试**

Create `E:\QMAI\src\lib\app-updater.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import { runAppUpdateFlow } from "./app-updater"

describe("runAppUpdateFlow", () => {
  it("没有新版本时不弹窗也不安装", async () => {
    const check = vi.fn().mockResolvedValue(null)
    const confirm = vi.fn()
    const message = vi.fn()

    await runAppUpdateFlow({
      isTauri: true,
      check,
      confirm,
      message,
    })

    expect(check).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
    expect(message).not.toHaveBeenCalled()
  })

  it("用户确认后下载并安装更新", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined)
    const check = vi.fn().mockResolvedValue({
      version: "0.4.11",
      body: "修复自动更新与发布流程",
      downloadAndInstall,
    })
    const confirm = vi.fn().mockResolvedValue(true)
    const message = vi.fn().mockResolvedValue(undefined)

    await runAppUpdateFlow({
      isTauri: true,
      check,
      confirm,
      message,
    })

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(message).toHaveBeenCalledTimes(1)
    expect(downloadAndInstall).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run:
```powershell
npx vitest run src/lib/app-updater.test.ts
```

Expected:
- FAIL
- 报错缺少 `./app-updater` 或缺少导出 `runAppUpdateFlow`

- [ ] **Step 3: 写最小 updater 实现**

Create `E:\QMAI\src\lib\app-updater.ts`:
```ts
import { isTauri } from "@/lib/platform"

type UpdateHandle = {
  version: string
  body?: string | null
  downloadAndInstall: () => Promise<void>
}

type UpdaterBindings = {
  isTauri: boolean
  check: () => Promise<UpdateHandle | null>
  confirm: (message: string, options?: Record<string, unknown>) => Promise<boolean>
  message: (message: string, options?: Record<string, unknown>) => Promise<void>
}

let updateCheckStarted = false

export async function runAppUpdateFlow(bindings: UpdaterBindings) {
  if (!bindings.isTauri) return
  const update = await bindings.check()
  if (!update) return

  const notes = update.body?.trim() ? `\n\n更新说明：\n${update.body.trim()}` : ""
  const confirmed = await bindings.confirm(
    `检测到新版本 ${update.version}。是否立即下载并安装？${notes}`,
    {
      title: "发现新版本",
      kind: "info",
      okLabel: "立即更新",
      cancelLabel: "稍后再说",
    },
  )
  if (!confirmed) return

  await bindings.message(
    "开始下载并安装更新。Windows 安装阶段会自动关闭当前软件，请先保存正在编辑的内容。",
    { title: "开始更新", kind: "info" },
  )
  await update.downloadAndInstall()
}

export async function checkForAppUpdate() {
  if (!isTauri() || updateCheckStarted) return
  updateCheckStarted = true
  try {
    const [{ check }, { confirm, message }] = await Promise.all([
      import("@tauri-apps/plugin-updater"),
      import("@tauri-apps/plugin-dialog"),
    ])
    await runAppUpdateFlow({
      isTauri: true,
      check,
      confirm,
      message,
    })
  } catch (error) {
    console.warn("检查应用更新失败：", error)
  } finally {
    updateCheckStarted = false
  }
}
```

- [ ] **Step 4: 在应用初始化完成后触发更新检查**

Update `E:\QMAI\src\App.tsx`:
```ts
import { checkForAppUpdate } from "@/lib/app-updater"

useEffect(() => {
  async function init() {
    try {
      // existing init logic
    } catch {
      // ignore init errors
    } finally {
      setLoading(false)
      void checkForAppUpdate()
    }
  }
  init()
}, [])
```

- [ ] **Step 5: 重新运行 updater 测试与类型检查**

Run:
```powershell
npx vitest run src/lib/app-updater.test.ts
npm run typecheck
```

Expected:
- `src/lib/app-updater.test.ts` PASS
- `npm run typecheck` PASS

- [ ] **Step 6: 提交本任务**

Run:
```powershell
git add src/lib/app-updater.ts src/lib/app-updater.test.ts src/App.tsx
git commit -m "feat: add app update check flow"
```

---

### Task 3: 生成 GitHub 发布目录并更新 README 与发布文档

**Files:**
- Create: `E:\QMAI\scripts\prepare-github-release.mjs`
- Modify: `E:\QMAI\README.MD`
- Create: `E:\QMAI\docs\github-release-guide.md`

- [ ] **Step 1: 新建 GitHub Release 产物整理脚本**

Create `E:\QMAI\scripts\prepare-github-release.mjs`:
```js
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
const bundleDir = resolve(root, "src-tauri/target/release/bundle/nsis")
const outDir = resolve(root, "release-github")
const portableExe = resolve(root, "release-portable/QMaiWrite.exe")

const setupExe = readdirSync(bundleDir)
  .filter((name) => name.endsWith(".exe") && name.includes("-setup"))
  .map((name) => resolve(bundleDir, name))[0]

if (!setupExe) {
  throw new Error("未找到 NSIS 安装包，请先执行 npm run build:github-release")
}

const signaturePath = `${setupExe}.sig`
if (!existsSync(signaturePath)) {
  throw new Error(`未找到签名文件：${signaturePath}`)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const setupName = setupExe.split(/[/\\\\]/).pop()
cpSync(setupExe, resolve(outDir, setupName))
cpSync(signaturePath, resolve(outDir, `${setupName}.sig`))
if (existsSync(portableExe)) {
  cpSync(portableExe, resolve(outDir, "QMaiWrite-portable.exe"))
}

const signature = readFileSync(signaturePath, "utf8").trim()
const latest = {
  version: pkg.version,
  notes: `QMAI ${pkg.version} 发布版本`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/Mochocyang/QMAI/releases/latest/download/${setupName}`,
    },
  },
}

writeFileSync(resolve(outDir, "latest.json"), JSON.stringify(latest, null, 2), "utf8")
console.log(`GitHub Release 产物已生成：${outDir}`)
```

- [ ] **Step 2: 重写 README.MD，按当前软件状态描述而不是按未来规划描述**

Update `E:\QMAI\README.MD` to include these top-level sections:
```md
# 青幕AI写作（QMAI）

## 简介
## 当前主要功能
## 当前技术栈
## 本地开发
## Windows 打包
## GitHub Releases 下载与自动更新
## 注意事项
```

README content rules:
- 只写当前仓库里已经存在的功能
- 自动更新说明写成“发布新版本后，桌面端启动时会检查更新”
- 不写“即将支持”“未来会支持”这类路线图句子

- [ ] **Step 3: 补一份中文 GitHub 发布操作文档**

Create `E:\QMAI\docs\github-release-guide.md` with these concrete sections:
```md
# GitHub 发布操作指南

## 1. 首次准备
## 2. 每次发版前要修改的版本号
## 3. 本地构建命令
## 4. release-github 目录里每个文件的用途
## 5. 在 GitHub Releases 页面上传哪些文件
## 6. 发版后如何验证自动更新
## 7. 哪些文件绝对不能上传
```
```

The guide must explicitly state:
- `C:\Users\Administrator\.tauri\qmai-updater.key` 是私钥，不能上传
- GitHub Releases 至少上传：
  - `latest.json`
  - `*-setup.exe`
  - `*-setup.exe.sig`
  - 可选 `QMaiWrite-portable.exe`

- [ ] **Step 4: 验证脚本与文档输出**

Run:
```powershell
npm run build
node scripts/build-portable.mjs
node scripts/prepare-github-release.mjs
```

Expected:
- `release-github/latest.json` 生成成功
- `release-github` 目录包含安装包、签名文件、`latest.json`
- `README.MD` 与 `docs/github-release-guide.md` 为中文内容

- [ ] **Step 5: 提交本任务**

Run:
```powershell
git add scripts/prepare-github-release.mjs README.MD docs/github-release-guide.md
git commit -m "docs: add GitHub release workflow and README"
```

---

### Task 4: 完整验证、打包并核对产物

**Files:**
- Verify: `E:\QMAI\release-portable\QMaiWrite.exe`
- Verify: `E:\QMAI\release-github\latest.json`
- Verify: `E:\QMAI\src-tauri\target\release\bundle\nsis\*.exe`
- Verify: `E:\QMAI\src-tauri\target\release\bundle\nsis\*.exe.sig`

- [ ] **Step 1: 运行完整检查**

Run:
```powershell
npx vitest run src/lib/app-updater.test.ts
npm run test:mocks
npm run typecheck
```

Expected:
- updater 单测通过
- 现有 mock 测试通过
- 类型检查通过

- [ ] **Step 2: 生成 GitHub 发布包与便携版**

Before running, set the signing key environment variable for the current PowerShell session:
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\qmai-updater.key" -Raw
npm run build:github-release
```

Expected:
- `src-tauri/target/release/bundle/nsis/*-setup.exe` 存在
- 对应 `.sig` 存在
- `release-portable/QMaiWrite.exe` 被刷新
- `release-github/latest.json` 被刷新

- [ ] **Step 3: 核对 exe 是否真的是新包**

Run:
```powershell
Get-Item E:\QMAI\release-portable\QMaiWrite.exe | Select-Object FullName,Length,LastWriteTime
Get-ChildItem E:\QMAI\release-github | Select-Object Name,Length,LastWriteTime
```

Expected:
- `QMaiWrite.exe` 的 `LastWriteTime` 是本次构建时间
- `release-github` 至少包含：
  - `latest.json`
  - `与当前 package.json 版本号对应的 setup 安装包`
  - `与当前 package.json 版本号对应的 setup 安装包签名文件`

- [ ] **Step 4: 手动 smoke check 发布说明**

Manual checklist:
- `README.MD` 中的功能描述与当前界面一致
- `docs/github-release-guide.md` 中的命令与实际脚本一致
- 没有把私钥路径写成可上传文件

- [ ] **Step 5: 提交最终任务**

Run:
```powershell
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src/App.tsx src/lib/app-updater.ts src/lib/app-updater.test.ts scripts/prepare-github-release.mjs README.MD docs/github-release-guide.md
git commit -m "feat: add GitHub updater release workflow"
```

---

## Self-Review

- Spec coverage: 已覆盖 updater 插件接入、前端检查更新、GitHub Release 产物整理、README 更新、中文发布文档和最终打包验证。
- Placeholder scan: 仅公钥内容依赖本机命令输出，计划已明确其来源与插入位置，没有留空的业务逻辑步骤。
- Type consistency: 前端统一使用 `checkForAppUpdate` / `runAppUpdateFlow`；发布脚本统一输出 `release-github/latest.json`。
