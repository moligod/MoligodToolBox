# 参与贡献

欢迎提交问题报告、文档改进及代码变更。项目第一方代码和文档采用 GPL-3.0-only，允许商用，分发衍生程序时需按 GPL-3.0 提供完整对应源码。贡献前请阅读许可及第三方声明。[许可](LICENSE) · [版权声明](NOTICE) · [第三方声明](THIRD_PARTY_NOTICES.md)

## 开发环境

使用 Windows 10/11 x64、PowerShell 7、Node.js 24.13.0、MSVC C++ 构建工具和 WebView2。Rust 工具链由 `rust-toolchain.toml` 固定。依赖安装与 OCR 资源准备步骤见项目说明。[README](README.md)

## 代码边界

- `crates/core` 保存领域模型、参数约束和任务生命周期。
- `src-tauri` 组合存储、窗口及独立工具模块。
- 前端原生调用统一经过 `src/api.ts`。
- 工具按需启动，提供停止及资源释放，配置使用带版本的数据格式。
- 结构性变更应在架构文档中记录理由与验证证据。[架构决策](docs/architecture.md)

## 提交前检查

```powershell
npm test
npm run test:core
npm run check:boundaries
npm run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
```

涉及 IPC、Tauri 或原生模块时，补充桌面构建及对应模块验证，并在 `docs/verification.md` 记录实际结果。运行全仓库格式检查可执行 `npm run format:check`。

提交问题或 PR 时，请描述复现步骤、预期与实际行为、环境和已执行检查。提交截图、日志、配置或示例任务前，请先清除个人信息及凭据，并使用虚构测试数据。

分发本项目代码或衍生程序时，请保留版权及许可声明，标明修改，并按 GPL-3.0 的要求提供完整对应源码和必要构建文件。涉及的第三方组件应携带对应声明。
