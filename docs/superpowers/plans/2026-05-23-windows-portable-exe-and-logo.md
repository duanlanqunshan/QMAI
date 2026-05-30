# Windows 便携版 EXE 与统一图标打包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 `e:\QMAI\QM-LOGO.png` 作为统一品牌图标，补齐 Tauri Windows 图标资源，并生成可运行的便携版 EXE 输出目录。

**Architecture:** 复用当前项目已有的 Tauri 打包链路，不改动业务代码，仅补齐 `src-tauri/icons` 图标资源、必要的 Windows 侧配置核对，并通过现有 `npm run build:portable` 生成便携版。图标生成采用一次性脚本/命令行工具把源 PNG 转成 Tauri 所需的 PNG/ICO/ICNS 资源，最终由 `tauri.conf.json` 与 `build.rs` 自动纳入构建。

**Tech Stack:** Tauri 2、Rust、Vite、Node.js、PowerShell、Windows 图标资源生成工具

---

### Task 1: 核对当前打包入口与图标依赖

**Files:**
- Modify: `e:\QMAI\src-tauri\build.rs:1-12`
- Modify: `e:\QMAI\src-tauri\tauri.conf.json:30-40`
- Modify: `e:\QMAI\package.json:6-17`
- Modify: `e:\QMAI\scripts\build-portable.mjs:1-91`
- Test: `e:\QMAI\src-tauri\build.rs`

- [ ] **Step 1: 写一个最小验证检查清单**

```text
验证目标：
1. build.rs 监听的 icons 文件在磁盘上实际存在
2. tauri.conf.json 的 bundle.icon 列表与实际生成文件一致
3. npm run build:portable 仍然是唯一便携版入口
```

- [ ] **Step 2: 运行文件存在性检查**

Run: `Get-ChildItem e:\QMAI\src-tauri -Force`
Expected: 当前能看到 `build.rs`、`tauri.conf.json`、`windows-app-manifest.xml`，且若 `icons` 不存在则确认需要补齐

- [ ] **Step 3: 不修改业务代码，仅记录需要补齐的资源**

```text
需要存在的文件：
- e:\QMAI\src-tauri\icons\32x32.png
- e:\QMAI\src-tauri\icons\128x128.png
- e:\QMAI\src-tauri\icons\128x128@2x.png
- e:\QMAI\src-tauri\icons\icon.ico
- e:\QMAI\src-tauri\icons\icon.icns
```

- [ ] **Step 4: 复核打包命令**

Run: `Get-Content e:\QMAI\package.json`
Expected: `build:portable` 仍调用 `npx tauri build --no-bundle` 和 `node scripts/build-portable.mjs`

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: review portable build icon requirements"
```

### Task 2: 先写失败验证，再补齐图标资源目录

**Files:**
- Create: `e:\QMAI\src-tauri\icons\32x32.png`
- Create: `e:\QMAI\src-tauri\icons\128x128.png`
- Create: `e:\QMAI\src-tauri\icons\128x128@2x.png`
- Create: `e:\QMAI\src-tauri\icons\icon.ico`
- Create: `e:\QMAI\src-tauri\icons\icon.icns`
- Test: `e:\QMAI\src-tauri\icons`

- [ ] **Step 1: 先写失败检查（目录不存在）**

```powershell
if (Test-Path e:\QMAI\src-tauri\icons) { Write-Output 'icons exists' } else { throw 'icons missing' }
```

- [ ] **Step 2: 运行检查确认失败**

Run: `if (Test-Path e:\QMAI\src-tauri\icons) { Write-Output 'icons exists' } else { throw 'icons missing' }`
Expected: FAIL with `icons missing`

- [ ] **Step 3: 用 QM-LOGO.png 生成最小图标集合**

```powershell
New-Item -ItemType Directory -Force e:\QMAI\src-tauri\icons
# 基于 e:\QMAI\QM-LOGO.png 生成：32x32.png、128x128.png、128x128@2x.png、icon.ico、icon.icns
```

- [ ] **Step 4: 运行检查确认资源存在**

Run: `Get-ChildItem e:\QMAI\src-tauri\icons`
Expected: PASS，列出 5 个图标文件

- [ ] **Step 5: Commit**

```bash
git add src-tauri/icons
git commit -m "chore: add tauri app icons from qm logo"
```

### Task 3: 核对 Windows 侧配置是否需要最小修正

**Files:**
- Modify: `e:\QMAI\src-tauri\build.rs:1-12`
- Modify: `e:\QMAI\src-tauri\windows-app-manifest.xml:1-19`
- Modify: `e:\QMAI\src-tauri\tauri.conf.json:30-40`
- Test: `e:\QMAI\src-tauri\build.rs`

- [ ] **Step 1: 写失败验证，检查配置引用是否与图标文件一致**

```powershell
$paths = @(
  'e:\QMAI\src-tauri\icons\32x32.png',
  'e:\QMAI\src-tauri\icons\128x128.png',
  'e:\QMAI\src-tauri\icons\128x128@2x.png',
  'e:\QMAI\src-tauri\icons\icon.ico',
  'e:\QMAI\src-tauri\icons\icon.icns'
)
$missing = $paths | Where-Object { -not (Test-Path $_) }
if ($missing.Count -gt 0) { throw ($missing -join ", ") }
```

- [ ] **Step 2: 运行检查，若缺失则失败**

Run: 上述 PowerShell 检查
Expected: 若仍有缺失则 FAIL；资源补齐后 PASS

- [ ] **Step 3: 最小化修正配置**

```text
仅在以下情况下修改文件：
1. tauri.conf.json 的 icon 列表与实际文件名不一致
2. build.rs 监听文件缺项
3. Windows manifest 存在会阻止正常桌面打包的问题
```

- [ ] **Step 4: 再次运行配置检查**

Run: `Get-Content e:\QMAI\src-tauri\tauri.conf.json`
Expected: `bundle.icon` 精确引用生成后的图标文件

- [ ] **Step 5: Commit**

```bash
git add src-tauri/build.rs src-tauri/tauri.conf.json src-tauri/windows-app-manifest.xml
git commit -m "chore: align windows icon build configuration"
```

### Task 4: 运行类型检查与前端构建前置验证

**Files:**
- Modify: `e:\QMAI\package.json:6-17`
- Test: `e:\QMAI\package.json`

- [ ] **Step 1: 写失败验证，先跑类型检查**

```powershell
npm run typecheck
```

- [ ] **Step 2: 运行类型检查并确认失败或通过**

Run: `npm run typecheck`
Expected: 若失败，必须先修复阻塞项；若通过，进入下一步

- [ ] **Step 3: 运行前端构建**

```powershell
npm run build
```

- [ ] **Step 4: 确认前端构建通过**

Run: `npm run build`
Expected: PASS，并生成 `e:\QMAI\dist`

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: verify frontend build before portable packaging"
```

### Task 5: 生成 Windows 便携版 EXE

**Files:**
- Modify: `e:\QMAI\scripts\build-portable.mjs:1-91`
- Test: `e:\QMAI\release-portable`

- [ ] **Step 1: 写失败验证，检查旧产物不存在或可覆盖**

```powershell
if (Test-Path e:\QMAI\release-portable\青慕AI写作.exe) { Write-Output 'will replace existing portable exe' } else { throw 'portable exe missing before build' }
```

- [ ] **Step 2: 运行现有便携版命令**

Run: `npm run build:portable`
Expected: PASS，控制台输出“便携版已生成”

- [ ] **Step 3: 若命令失败，只做最小修复**

```text
允许修复范围：
- 图标文件格式或路径问题
- Tauri 打包配置问题
- 便携版脚本引用路径问题
不改动业务功能代码
```

- [ ] **Step 4: 确认便携版目录产物**

Run: `Get-ChildItem e:\QMAI\release-portable -Recurse`
Expected: 至少包含 `青慕AI写作.exe`、`版本信息.json`、可选的 `pdfium\pdfium.dll` 与 `NvwaSKILL`

- [ ] **Step 5: Commit**

```bash
git add scripts/build-portable.mjs src-tauri
git commit -m "build: generate portable windows exe with qm logo"
```

### Task 6: 验证图标与产物一致性

**Files:**
- Test: `e:\QMAI\release-portable\青慕AI写作.exe`
- Test: `e:\QMAI\release-portable\版本信息.json`
- Test: `e:\QMAI\src-tauri\icons`

- [ ] **Step 1: 检查版本信息文件**

```powershell
Get-Content e:\QMAI\release-portable\版本信息.json
```

- [ ] **Step 2: 检查便携版目录结构**

Run: `Get-ChildItem e:\QMAI\release-portable -Recurse`
Expected: PASS，EXE 与资源齐全

- [ ] **Step 3: 检查图标资源时间戳/大小已更新**

```powershell
Get-ChildItem e:\QMAI\src-tauri\icons | Select-Object Name,Length,LastWriteTime
```

- [ ] **Step 4: 最终验证命令**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add release-portable
git commit -m "chore: verify portable exe output"
```
