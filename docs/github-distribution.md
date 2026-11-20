# 官方组件与版本更新

客户端固定使用 `moligod/MoligodToolBox` 作为官方仓库，组件目录位于 main 分支的 `official-components/`，版本更新读取正式 GitHub Releases。

该仓库由原 `DF-AutomatedTool` 重命名承接，保留原 Stars、Forks、Issues 和提交历史。原先创建的私有空仓库已改名为 `moligod-toolkit-empty-backup`。重构源码已接续原 main 历史上传，官方目录及示例文件已通过公开 HTTP 读取验证。

## 使用方式

自动化助手 → 组件库 → 获取官方组件，获取目录后显示名称、说明及导入按钮。选择导入后下载动作代码，复用现有组件校验和原子追加流程。关闭弹窗或开始运行后，迟到的下载结果会失效。无法连接、仓库未公开或请求失败时，界面提示“无法访问官方 GitHub 仓库”并提供重新获取。

主窗口初始化后单次检查最新正式 Release。版本号按钮有红点时表示发现新版本，点击会显示版本号、更新说明及确认按钮。确认后下载并验证更新签名，通过校验后调用安装包更新客户端。安装前会回收准星和自动化模块，安装程序完成后重启客户端。更新前请保存正在编辑的任务。

检测时仅将附带 `latest.json` 的正式 Release 识别为工具箱更新。原仓库的 `v1.1` 等旧程序版本通过附件识别后跳过。

检查失败时，版本号的提示显示失败原因，点击可以重试。更新检查与官方组件下载使用有界超时，本地工具可以继续使用。浏览器预览中的版本更新按钮禁用，组件获取通过桌面客户端执行。

## 维护官方组件

从组件库导出动作代码，保存为 `official-components/<id>.json`，再在 `official-components/index.json` 登记 id、name 和 description。id 只使用小写字母、数字、连字符，最长64字节。目录最多100项，单次响应最多1MiB，具体格式见目录说明。[官方组件格式](../official-components/README.md)

组件动作代码及图片模板由维护者检查后提交，添加准备说明和预期效果。当前示例只等待1秒。

## 签名密钥

验证公钥保存在 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。对应私钥已在本机生成，位置为 `.local/updater/signing.key`，此目录由 Git 忽略。请将私钥另行备份，并在正式仓库的 Actions Secrets 中设置以下值。

- `TAURI_SIGNING_PRIVATE_KEY` 为私钥文件的完整内容。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 为生成私钥时设置的密码，本轮生成时采用空密码。

发布版本需要沿用客户端信任的签名密钥，便于已安装客户端验证后续更新。密钥及密码通过 GitHub Secrets 传入发布构建。

## 发布版本

1. 将 package.json、package-lock.json、Cargo.toml 和 src-tauri/tauri.conf.json 的版本更新为相同的正式 SemVer 版本，运行验证并提交源码。
2. 创建对应的 `vMAJOR.MINOR.PATCH` 标签并推送至官方仓库。
3. 在 GitHub Actions 手动运行 Signed Windows release，填写已有标签及 Release 显示名称；首版均为 v2.0.0。
4. 工作流构建 NSIS 安装包和更新签名，在该标签下创建草稿 Release，上传安装包、签名及 latest.json。
5. 核对草稿中的安装包和签名清单，完成目标 Windows 环境验收后发布正式 Release，并将该版本标记为 Latest。

工作流按标签源码构建并检查版本一致性。普通本地构建沿用开发构建方式；签名更新产物由 release 工作流通过 `createUpdaterArtifacts` 生成。更新下载地址限定于官方仓库及用户确认的版本标签，安装前由 Tauri updater 验证签名。[Tauri updater](https://v2.tauri.app/plugin/updater/) · [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)

v2.0.1 起安装包使用全机安装，目标固定为 `Program Files\MoligodToolBox`。从 v2.0.0 迁移会创建新的全机安装，旧版每用户程序目录会保留。启动新版时请使用全机安装位置或相应快捷方式。同一 Windows 账号的任务和配置仍从原数据目录读取。

也可在本地执行 `./scripts/prepare-ocr.ps1`，再执行 `./scripts/build-release.ps1`。脚本使用受忽略保护的本机签名密钥或现有签名环境变量，构建后扫描程序与模块中的本机路径和凭据。需在不含个人信息的构建目录及 Cargo 缓存中生成发布文件；Rust 路径映射不能替代最终二进制扫描。

## 当前验证边界

源码已上传至正式 `MoligodToolBox` main 分支。官方组件目录与示例公开读取均返回HTTP200，示例内容与本机一致。v2.0.0已公开发布并标记Latest，包含Windows x64安装包、签名、latest.json与SHA256SUMS.txt。四个GitHub附件的服务端SHA-256均与本机一致；公开更新清单及安装包地址HTTP200，更新清单内容一致。[v2.0.0](https://github.com/moligod/MoligodToolBox/releases/tag/v2.0.0)

GitHub Actions因账号账单锁定而未能启动，本轮采用本机签名构建。GPU运行库采用经作者同意的限定链接例外并随包保留供应商许可；跨版本真实安装及游戏环境需另行验收。[第三方声明](../THIRD_PARTY_NOTICES.md)
