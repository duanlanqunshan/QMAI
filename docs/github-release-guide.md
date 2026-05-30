# GitHub 发布操作指南

## 1. 首次准备

先在本机生成 updater 签名密钥：

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.tauri\qmai-updater.key" --ci
```

生成后会得到：

- `C:\Users\Administrator\.tauri\qmai-updater.key`
- `C:\Users\Administrator\.tauri\qmai-updater.key.pub`

其中：

- `.key` 是私钥，绝对不能上传
- `.key.pub` 是公钥，已经写入项目配置，用于客户端验证更新包

## 2. 每次发版前要修改的版本号

每次发布新版本前，至少同步修改下面两个版本号：

- `E:\QMAI\package.json`
- `E:\QMAI\src-tauri\tauri.conf.json`

如果版本号不一致，GitHub Release 文件名、应用显示版本和更新判断都会混乱。

## 3. 本地构建命令

在当前 PowerShell 会话里先设置私钥路径和私钥密码：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\qmai-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
```

然后执行完整发布构建：

```powershell
npm run build:github-release
```

这个命令会依次完成：

1. 构建 Tauri 安装包
2. 生成 updater 签名文件
3. 刷新便携版 `QMaiWrite.exe`
4. 生成 `release-github` 目录

## 4. release-github 目录里每个文件的用途

`release-github` 目录是上传到 GitHub Releases 前的整理结果。

常见文件包括：

- `latest.json`
  用于桌面端检查最新版本信息
- `xxx-setup.exe` 或其他 Tauri updater 产物
  用于桌面端下载安装更新
- `xxx-setup.exe.sig` 或对应产物的签名文件
  用于校验更新包未被篡改
- `QMaiWrite-portable.exe`
  便携版，可作为手动下载备用包

## 5. 在 GitHub Releases 页面上传哪些文件

每次发版时，至少上传这些文件：

- `latest.json`
- updater 对应安装包
- updater 对应签名文件

可选上传：

- `QMaiWrite-portable.exe`

如果你想让普通用户也能直接下载便携版，建议一并上传便携版。

## 6. 发版后如何验证自动更新

发版后按下面顺序验证：

1. 打开 GitHub Releases 页面，确认新版本资源已经全部上传
2. 打开 `latest.json`，确认里面的版本号与本次发版一致
3. 在旧版本桌面端启动软件
4. 观察是否弹出“发现新版本”的中文提示
5. 确认更新后，检查软件是否开始下载并进入安装流程

如果没有提示更新，优先检查：

- `latest.json` 是否上传到了 Release
- `latest.json` 里的下载地址是否指向本次上传的资源
- 安装包和 `.sig` 是否成对上传
- 本地软件版本号是否确实低于新版本

## 7. 哪些文件绝对不能上传

以下文件绝对不能上传到 GitHub：

- `C:\Users\Administrator\.tauri\qmai-updater.key`
- 任何包含私钥原文的备份文件
- 本地环境变量导出文件

记住一点：只要私钥泄露，别人就可以伪造更新包，自动更新链路就不再可信。
