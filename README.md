# MoligodToolBox

面向 Windows 的本地游戏工具箱，提供自定义准星、可视化自动化、截图与离线 OCR。

当前是 **0.1.0 开发版**，桌面客户端使用 Tauri 2、TypeScript 和 Rust，工具通过独立进程按需启动。关闭主窗口后可通过系统托盘重新打开或退出。

## 许可与署名

本项目第一方代码和文档采用 **GNU General Public License v3.0（GPL-3.0-only）**，允许使用、修改、商用和收费分发。对外分发基于本项目代码的衍生程序时，需要按 GPL-3.0 提供完整对应源码，并向接收者授予相同的使用、修改及再分发权利；后续修改版继续适用这些要求。分发时保留版权、许可和修改说明。[完整许可](LICENSE) · [版权声明](NOTICE)

```text
MoligodToolBox — Copyright (c) 2026 moligod
https://github.com/moligod/MoligodToolBox
```

源码提供义务以对外分发为主要触发条件，个人或组织内部使用的修改可以保留内部使用。第三方组件适用各自许可，相关声明及二进制分发待核对项见第三方文档。[第三方声明](THIRD_PARTY_NOTICES.md)

## 当前可用

- 紧凑工具列表、独立工具窗口、系统托盘、单实例与贴顶隐藏。
- 原生准星：十字、圆点、圆圈、静态图片；颜色、尺寸、间距、不透明度；显示器与位置偏移；键盘/鼠标显隐快捷键（点击或按住）。
- 工具箱界面、准星参数预览、配置保存、工具内准星码生成、复制与载入。
- 可视化自动化助手：Blockly 动作编排、窗口绑定、输入、截图、图像匹配、离线 OCR、变量与控制流、组件动作代码分享。
- 独立 Rust 核心：参数约束、按需任务线程、协作取消与回收。
- 版本化配置、同目录临时文件替换、上一版备份、损坏及未来版本保护。
- 核心/存储测试、预设契约测试、依赖边界检查、前端体积预算、Windows CI。

组件库的“获取官方组件”从官方 GitHub 目录读取动作代码。主窗口版本号支持正式 Releases 检查、红点提示和确认后的签名更新，维护步骤见发布文档。[官方组件与版本更新](docs/github-distribution.md)

**尚未接入**：独立原生模块联网下载安装、攻略服务。旧准星不做结构或格式兼容；不导入其注册表、分享口令、管理员模式和后台更新逻辑。

## 使用准星

桌面客户端 → 自定义准星 → 显示准星。默认 F8 切换显隐；点击快捷键按钮后，按下并松开键盘键或鼠标左/右/中/侧键进行录入。支持点击切换和按住隐藏、松开恢复；不会阻止原按键传给其他程序。
开启后参数实时更新，保存配置可供下次打开使用。启动客户端不会自动开启准星。
主按钮在“显示/关闭准星”间切换，关闭销毁窗口、释放输入监听并回收线程。快捷键仍可临时显隐，托盘菜单也有“关闭准星”。
图片支持 PNG/JPG/BMP/GIF 静态首帧，最大 8 MiB，透明边缘自动裁剪；没有 512×512 的导入或显示限制，仍保留异常尺寸解码保护和缩放内存预算。图片独立保存在应用配置目录，不包含在准星码中。
坐标是所选显示器中心的物理像素偏移，选中显示器断开时回退主屏。建议在窗口化或无边框游戏中使用；独占全屏及不同游戏兼容性尚需实机验收。

实现与验证边界见 [原生准星](docs/crosshair.md)。

## 自动化与模块化

桌面客户端 → 自动化助手。绑定窗口、添加步骤、检查后运行；Ctrl+Alt+F10 紧急停止。组件可以导出为动作代码分享，图片模板需单独准备。详细功能和限制见 [自动化助手](docs/automation.md)，打包与未来下载安装方案见 [独立模块](docs/modules.md)。

## 开发

Windows 10/11 x64；需要 PowerShell 7、MSVC C++ 构建工具、WebView2、Rust（由 rust-toolchain.toml 固定）和 Node.js 24.13.0。

自动化 OCR 使用 Rust 原生 PP-OCRv6 small/tiny，支持 CPU、A 卡（DML）、N 卡（TensorRT RTX）。按 [OCR 构建说明](modules/ocr/README.md) 用 PowerShell 7 准备原生库与模型，Cargo 编译 OCR 程序；构建及客户端均无需 Python。

```powershell
npm ci
./scripts/prepare-ocr.ps1
npm run tauri dev
```

OCR 准备脚本会在构建阶段下载原生库和模型，并校验固定 SHA-256。首次构建前执行，耗时与网络及硬件有关。客户端使用已准备好的本地资源运行。重复开发启动前，可通过系统托盘退出已有客户端，并关闭原开发终端，释放 EXE 和端口。

单独预览界面：`npm run dev`，浏览器打开 http://127.0.0.1:1420。工具原生操作在浏览器中禁用；游戏资料保存在浏览器的独立资料库，可通过导入导出转移到桌面客户端。

## 游戏资料模块

源码包含本机游戏资料库，支持封面、横幅、截图、草稿、搜索筛选及 JSON 导入导出。当前桌面启动入口为紧凑工具列表，资料库界面可在浏览器开发预览中查看。导入同 ID 时默认保留本机版本，可以明确选择替换；详情展示介绍、平台、开发商、发行商、日期及截图大图。

首版为离线资料管理，不包含联网商店、社区、安装或启动游戏。图片支持 PNG/JPEG/WebP，单张不超过1.5MiB，每款最多6张截图；最多100款游戏，总资料文件不超过24MiB。游戏资料与图片独立保存在 app_data_dir 下的 `game-library.json`，每次覆盖前保留上一版 `game-library.json.bak`，不混入准星/自动化配置。损坏或未来版本文件不会被默认值覆盖。

构建独立程序（本机仍需 WebView2）：

```powershell
npm run tauri build -- --no-bundle
```

输出：`target/release/moligod.exe`，必须连同 `target/release/modules/` 分发。构建 NSIS 安装包用 `npm run tauri build`；签名更新工作流与发布步骤见 [官方组件与版本更新](docs/github-distribution.md)，首次签名 Release 尚未发布。

## 验证

```powershell
npm test
npm run test:core
npm run check:boundaries
npm run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test -p moligod-crosshair --locked
cargo run -p moligod-crosshair --example smoke
```

提交 Cargo.lock 和 package-lock.json。新增依赖必须说明用途、体积及运行时成本。每次发布前按 [性能验收](docs/performance.md) 测量完整进程树。

## 结构

- `src/`：TypeScript 界面，系统调用集中在 api.ts。
- `src-tauri/`：桌面组合根、命令、窗口和托盘。
- `crates/core/`：不依赖 Tauri、Windows 或存储的业务模型与任务生命周期。
- `crates/storage/`：配置持久化适配器。
- `crates/crosshair/`：原生窗口、消息循环、热键与有限大小的图片处理。
- `docs/`：架构决策、迁移清单、性能与验证记录。
- `.reference/`：本机旧仓库只读参考，已忽略提交，不参与编译和分发。

贡献流程和提交前检查见贡献指南。[参与贡献](CONTRIBUTING.md)

详见 [架构决策](docs/architecture.md)、[迁移清单](docs/migration.md)、[验证记录](docs/verification.md)。

界面使用本项目的分段按钮样式和 [Lucide](https://lucide.dev) 静态图标，来源与历史设计记录见 [UI 组件说明](docs/rare-ui.md)。

## 配置与恢复

配置在 Tauri 的 app_config_dir 下；Windows 默认是 `%APPDATA%/com.moligod.desktop/settings.json`。
成功覆盖保存前保留上一版 `settings.json.bak`。损坏、超限或不支持的版本会报错并禁止覆盖；不会悄悄重置。

恢复时先退出客户端，把原文件另存为带时间戳的副本，再将确认有效的备份复制为 settings.json。未来版本应使用对应新版客户端读取。当前为内部格式 3，读取本项目早期设置时在内存中补齐新字段并保持原有快捷键语义；仅用户保存时写入当前格式，旧文件保留在备份中。

## 产品边界

本地工具可以离线运行。主窗口初始化后会单次检查官方 GitHub Releases，点击版本号可以重试；获取官方组件由用户点击触发。联网能力通过桌面适配层接入，失败时反馈错误。本地任务执行、准星与已导入组件使用本机资源。
