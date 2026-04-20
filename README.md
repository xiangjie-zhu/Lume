# Lume

一个本地运行的 PDF 工具箱，打包成 macOS 原生应用。完全离线，所有文档都只在你的设备上处理。

## 功能

- **阅读器** — 查看、搜索、高亮、下划线、笔记；支持书签和缩略图导航
- **合并** — 合并多个 PDF
- **整理页面** — 拖拽重排、删除、旋转页面
- **格式转换** — PDF ↔ 图片（PNG / JPG）
- **签名** — 用手写板签字并嵌入文档
- **水印** — 文字水印
- **最近文档** — 历史记录保存在本地（IndexedDB），快速重新打开

## 安装（普通用户）

从 [Releases 页面](https://github.com/xiangjie-zhu/Lume/releases) 下载 `Lume-x.y.z-arm64.dmg`（Apple Silicon）或 `-x64.dmg`（Intel Mac），双击打开后把 Lume 拖到 Applications。

首次打开若提示 "无法验证开发者"，右键点图标选"打开"即可，或者在终端跑：

```bash
xattr -cr /Applications/Lume.app
```

（DMG 未经 Apple 公证，因为个人项目不签名。）

## 从源码运行（开发者）

**需求：** Node.js 20+、macOS。

```bash
git clone https://github.com/xiangjie-zhu/Lume.git
cd Lume
npm install

# 浏览器里跑（Vite dev server）
npm run dev

# Electron 桌面模式（热重载 + DevTools）
npm run electron:dev
```

## 打包自己的 DMG

```bash
npm run dist:mac
```

产物在 `dist-electron/Lume-<version>-arm64.dmg`。在 M 系列 Mac 上默认只打 arm64；要同时打 Intel 版：

```bash
./node_modules/.bin/electron-builder --mac dmg --x64
# 或通用二进制
./node_modules/.bin/electron-builder --mac dmg --universal
```

## 自动化测试

一个端到端 smoke test 会启动 Electron、注入一个测试 PDF、验证 pdfjs 成功渲染、并确认历史记录持久化：

```bash
npm run build
./node_modules/.bin/electron scripts/test-pdf.cjs
```

预期输出：

```
✓ PDF rendered successfully (canvas 150x150)
✓ History recorded and visible on Home Dashboard
```

## 自定义图标

图标由 `scripts/build-icon.cjs` 生成（用 Electron 的 offscreen 渲染把一段 HTML 画成 PNG，再用 `iconutil` 打包成 `.icns`）。改了设计后重新生成：

```bash
npm run icon
```

输出：`build/icon.png`、`build/icon.icns`。

## 技术栈

- **UI：** React 19 + Vite + Tailwind v4 + Motion
- **PDF：** [`pdfjs-dist`](https://github.com/mozilla/pdf.js)（渲染）+ [`pdf-lib`](https://pdf-lib.js.org/)（编辑）
- **桌面壳：** Electron 33 + electron-builder
- **存储：** localforage（IndexedDB 包装）

资源通过自定义 `app://` 协议加载（而非 `file://`），解决 pdfjs Worker 在 `file://` origin 下的安全限制。

## 项目结构

```
src/
  App.tsx            # 顶层布局、tab 管理
  main.tsx           # React 入口 + pdfjs worker 初始化
  components/        # 共享组件（HomeDashboard）
  tools/             # 各工具实现（ReaderTool、ConvertTool 等）
  lib/
    storage.ts       # 历史记录（localforage + 事件订阅）
    utils.ts         # 下载、格式化辅助
electron/
  main.cjs           # Electron 主进程；注册 app:// 协议
scripts/
  build-icon.cjs     # 图标生成
  test-pdf.cjs       # E2E 冒烟测试
build/
  icon.icns          # 应用图标（提交到仓库，打包会用）
  icon.png
```

## 常见坑

- **"Failed to load PDF"** — 通常是 `pdfjs-dist` 版本和 `react-pdf` 内置版本不匹配。`package.json` 里 `pdfjs-dist` 的版本必须和 `react-pdf/node_modules/pdfjs-dist` 对齐（目前都是 `5.4.296`）。
- **DMG 打不开（"已损坏"）** — 因为未公证。`xattr -cr /Applications/Lume.app` 清掉隔离属性即可。
- **重新生成 DMG 后图标没更新** — macOS 的 LaunchServices 有缓存：
  ```bash
  /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user
  killall Dock Finder
  ```

## License

MIT
