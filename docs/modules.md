# 独立工具模块 · 2026-09-27

准星与自动化现在均为独立 Rust EXE。平台主程序不链接其图像、输入或 OCR 引擎；平台启动仅读取模块清单，不启动工具进程。打开工具设置时按需启动，关闭设置且工具未运行时释放；运行中的工具可继续工作，平台退出会回收所有子进程。

## 分层

- `crates/core`：共享参数和可取消任务；不依赖平台。
- `crates/module-protocol`：版本化长度前缀 JSON，16 MiB 帧上限。
- `crates/module-host`：发现、校验、启动、请求、事件、超时与进程回收。
- `modules/crosshair`、`modules/automation`：独立可执行入口。
- `crates/crosshair`、`crates/automation`：各工具运行引擎。
- `src-tauri`：UI 命令、状态缓存、编辑器/运行生命周期组合。

每个模块目录包含 manifest.json 与 EXE。清单声明 id、独立 version、protocol、platform、entry 和 sha256；启动前校验路径、平台与实际文件哈希，握手再校验模块身份及版本。Windows Job Object 在平台异常退出时回收子进程。阻塞的停止与等待在后台执行，不占用 UI 线程。

## 当前分发

```powershell
npm run modules:dev
npm run modules:package
npm run tauri build -- --ci
```

Tauri 开发与发布构建会自动构建对应工具。NSIS 安装包自带两个工具，离线可用。v2.0.1 起，正式宿主使用全机安装包，固定从 `Program Files\MoligodToolBox` 启动；源码调试使用 `npm run tauri dev`。

开发与发布模块是独立输出。修改模块 Rust 代码后，已运行的 Vite 热更新不会重新构建开发模块。修改完成后使用 `npm run modules:sync` 同步构建两套模块；Tauri 构建的 beforeBuildCommand 也调用此命令，防止只更新发布版而留下旧开发引擎。空闲时关闭并重新打开工具以载入新清单。截图协议变化须分别运行 `cargo run -p moligod-automation --example native_smoke --locked -- --module-ocr-snapshot` 与追加 `--release-module` 的验证，不能只用发布版结果代替开发版验收。

- 开发模块：bundled-modules/dev/<id>。
- 安装包资源：modules/<id>（由 bundled-modules/package 打入）。
- 开发模式本地覆盖：app_local_data_dir/modules/<id>，存在其清单时优先使用；损坏会报错。正式版只加载全机安装目录内的随包模块。
- 独立分发 ZIP：module-packages/<id>-<version>-windows-x86_64.zip。
- 配置/图片/脚本位于 app_config_dir，和工具程序分开；替换 EXE 不删除用户数据。

开发缓存采用带内容哈希的文件名，避免覆盖正在执行的文件；安装包只包含当前引擎，不带旧缓存。

## 后续点击下载安装

界面未来显示“下载 → 安装中 → 打开”，下载器获取模块包，验证可信发布者签名与哈希，暂存解压并检查路径和协议。能经管理员宿主启动的程序需安装到受保护目录。已有启动、停止、IPC、状态通知继续复用。工具升级前停止该模块，保留旧版本以便失败回滚。

本轮已形成独立模块 ZIP 和本地发现路径，尚未实现网络下载、签名信任、升级回滚或卸载 UI。SHA256 只验证完整性，不代表发布者认证。工具 UI 目前随平台发布，新增/修改界面仍需更新平台；模块引擎可独立打包。没有承诺下载任意未知工具即可动态装入任意界面。

## OCR 模型资源 · 2026-10-21

自动化模块现在必须连同ocr-runtime目录分发，内含冻结worker、ONNX Runtime及PP-OCRv6 small/tiny两套模型。首次构建前按modules/ocr/README.md显式准备一次；常规构建不联网下载。build-modules复制资源到dev、release/package与target/release/modules，独立ZIP也包含此目录。缺少资源会构建失败。平台启动仍不加载OCR进程/模型；只在识别时按需启动，任务结束或模块退出回收。
