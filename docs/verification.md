# v2.0.0 安装包与发布准备 · 2026-11-16

- 用户确认本次发布安装包，Release名称与标签均为v2.0.0，npm、Cargo工作区及Tauri内部版本统一为2.0.0。第一方代码保留GPL-3.0-only，按作者明确同意附加仅针对DirectML、TensorRT for RTX及必需CUDA Runtime的链接例外。
- 源码b50c253已普通快进推送至MoligodToolBox，公开raw组件目录及等待示例返回HTTP200，示例与本机内容一致。GitHub仓库身份、160 Stars及18 Forks保留。
- 版本调整后再次通过180项前端测试、12项桌面原生、13项核心及9项存储测试，依赖边界、Rust格式及workspace Clippy通过。
- 发布构建映射Rust源路径，并使用不含个人信息的独立Cargo缓存，避免AWS-LC的C/C++断言路径泄露本机账号。主程序及39个模块、模型、运行库文件通过UTF-8/UTF-16本机路径、凭据与私密文件类型扫描。扫描器对构造的UTF-16私密路径能正确拒绝。
- 最终暂存OCR运行库的固定中英图片验证通过：CPU small/tiny、DirectML tiny及NVIDIA tiny均返回预期文本。结果位于target/toolbox-v2-ocr-*.jsonl。
- 最终前端构建主资源252.0KiB/254KiB，按需796.6KiB/798KiB，桌面release构建1分17秒。主程序产品名MoligodToolBox，文件及产品版本2.0.0。完整依赖声明作为独立原生资源打包，未增加前端预算。
- 317个源码候选文件通过隐私规则扫描；检出的邮箱只出现在供应商许可、第三方版权及图标文件名中。签名私钥与本机用户数据没有进入Git索引或安装资源。项目许可、限定例外、供应商许可及依赖声明均加入安装资源。
- NSIS安装包及签名完成，安装包119578882字节，SHA-256为c39c463863a46002d2469782bb2453647a984d0ea6c4970741a9425dd85f14db。独立密码学验证接受原始安装包，拒绝修改后的内容及版本；模块哈希与清单、全部运行库库存核对通过。最终42个发布候选文件隐私扫描无命中。
- v2.0.0于2026-11-16 16:01:20 UTC公开发布并设为Latest，标签对应源码a58c368。安装包、.sig、latest.json及SHA256SUMS.txt四个附件的GitHub服务端SHA-256均与本机一致。匿名访问latest API得到v2.0.0，公开latest.json HTTP200且文件哈希一致，安装包HEAD HTTP200且长度119578882。证据target/toolbox-v2-signature-verification.json、toolbox-v2-public-verification.json及release-privacy-report.json。
- 构建日志target/toolbox-v2-installer-final-build.log。GitHub Actions因账号账单锁定未启动；全仓库既有格式债务、跨版本真实安装、安装/卸载及真实游戏验收不标为通过。

# MoligodToolBox 仓库名称与上传准备 · 2026-11-16

- GitHub正式仓库由原DF-AutomatedTool承接并最终改名为MoligodToolBox，仓库身份R_kgDOQ2cEYA保持不变，核对为160 Stars、18 Forks。保留原main历史，不强推。空的私有预备仓库保持moligod-toolkit-empty-backup。
- 官方组件raw根目录、GitHub Releases查询仓库、安装包来源约束、updater清单端点、发布工作流及公开文档均已同步新名称。npm包名为moligod-toolbox。
- npm test通过180项，cargo test -p moligod --lib --locked通过12项，npm run test:core通过13项核心及9项存储测试。依赖边界、cargo fmt --all -- --check及cargo clippy --workspace --all-targets --locked -- -D warnings通过。
- npm run tauri -- build --no-bundle通过，release构建1分22秒，输出target/release/moligod.exe。前端主资源252.0KiB/254KiB，按需资源796.6KiB/798KiB。日志位于target/toolbox-rename-frontend-tests.log、toolbox-rename-native-tests.log、toolbox-rename-core-tests.log、toolbox-rename-clippy.log及toolbox-rename-desktop-build.log。
- 300个拟上传文件通过本机路径、私钥、令牌及凭据规则扫描。私钥、构建产物、用户数据及.reference未进入索引，提交身份使用公开账号及GitHub noreply邮箱。
- 全仓库Prettier既有90个文件格式问题沿用此前记录；本轮未做全量格式改写。首次签名Release、真实跨版本安装及新版原生WebView2实机验收仍待完成。

# 旧仓库承接与更新兼容 · 2026-11-16

- 用户确认使用原DF-AutomatedTool仓库承接重构版，并采用moligod-toolkit名称。将先前私有空仓库改名为moligod-toolkit-empty-backup，再将原仓库重命名为moligod-toolkit。GitHub API确认仓库身份R_kgDOQ2cEYA保留，Stars为160、Forks为18，默认分支为main，原DF-AutomatedTool地址能解析到新仓库。
- 官方组件目录、GitHub Releases API、安装包地址约束、应用配置和origin已采用moligod/moligod-toolkit。重构代码和官方组件文件继续保留本地。
- 原仓库当前最新Release为v1.1，包含DF-AutomatedTool1.1.zip及旧动作JSON。更新检测先确认latest.json附件，再比较版本，跳过旧程序历史发布，避免旧版号导致格式错误或触发新版更新提示。新增固定历史Release夹具覆盖v1.1及无更新清单的高版本发布。
- `npm test`180项、桌面库原生测试12项、依赖边界、Rust格式和workspace Clippy通过。最终桌面release构建通过，耗时1分16秒，产物target/release/moligod.exe。日志位于target/repository-continuation-*.log，前端资源252.0KiB/254KiB及796.6KiB/798KiB。300个拟发布文件的隐私规则扫描未检出匹配项。

# GitHub 官方组件与签名更新 · 2026-11-16

- 组件库新增“获取官方组件”，主窗口版本号改为更新按钮。官方仓库固定为moligod/moligod-toolkit，组件位于main分支official-components目录，正式版本通过GitHub Releases API检查。主窗口初始化后执行一次检测，用户点击可重试。组件请求按点击触发，访问失败显示“无法访问官方 GitHub 仓库”。
- 原生网络适配限制1MiB响应、5秒连接超时及15秒请求超时，校验调用窗口、组件标识及目录版本。安装时重新核对已确认版本，限定官方Release安装包路径，通过Tauri updater验证签名与签名绑定版本。网络下载与安装资源回收分别运行于异步与后台任务。
- `npm test`通过180项。新回归覆盖更新检测去重、用户确认前零安装、失败后重新检查最新版本、红点与纯文本说明、迟到组件下载/模块加载、重复导入提交、官方示例兼容现有编解码。主桌面库11项原生测试通过，包含3项GitHub目录、SemVer与下载地址边界测试。核心13项及存储9项通过。
- 依赖边界、Rust格式、workspace Clippy及新增文档/样式的定向Prettier检查通过。TypeScript/Vite及体积检查通过，主资源252.0KiB/254KiB，按需Blockly及离线资源796.6KiB/798KiB，按需预算调整原因已记录于架构文档。
- 官方CLI生成本机更新签名密钥，对本地示例生成带0.2.0版本的签名。Node标准库Ed25519/BLAKE2b独立验证签名成功，篡改内容或签名版本均失败，结果target/github-signature-verification.json。私钥位于Git忽略的.local/updater/signing.key，公钥写入应用配置。
- Edge无头浏览器使用隔离IPC夹具检查实际Blockly组件库，确认双按钮有间隔，导入后组件从2项变为3项，原有组件保留。记录target/github-ui-palette.json，截图target/github-ui-palette-import.png。340×720主窗口确认版本红点、更新确认及取消/更新按钮完整可见，记录target/github-ui-update.json，截图target/github-ui-update-narrow.png。预览采用测试后端，安装操作由测试桩拒绝。
- 最终`npm run tauri -- build --no-bundle`完成，release构建1分16秒，产物target/release/moligod.exe，日志target/github-features-desktop-complete.log。为释放输出路径，将运行中的旧宿主EXE在原目录重命名为before-github备份，原宿主继续运行旧版。构建输出含链接器“正在创建库”提示，Clippy的-D warnings检查通过。
- 拟发布299个文件的隐私规则扫描未检出匹配项，Git忽略签名私钥，远程仓库配置为空。上传继续按用户此前要求暂缓。正式线上目录、GitHub安装包下载、真实跨版本安装及新版原生交互/完整进程树性能待公开仓库、配置签名Secrets和发布正式Release后验收。

# 工具箱网站入口底部对齐 · 2026-11-16

- 用户要求三个网站入口置于工具箱底部，保留“关闭窗口后仍在系统托盘运行”提示。调整紧凑侧栏中网站组的弹性外边距和提示区外边距。
- `npm test` 174 项、`npm run check:boundaries` 及 `npm run build` 通过。主资源246.2KiB/254KiB，按需Blockly及离线资源795.5KiB/796KiB。日志位于target/launcher-bottom-*.log。
- Edge无头浏览器生成340×720实际页面预览，截图确认本地工具置顶、三个网站入口位于提示上方、托盘提示完整显示。截图target/launcher-bottom-preview.png。多尺寸夹具的结构结果输出为空，本轮以默认尺寸截图为视觉证据，原生WebView2及小窗口滚动待实机复验。

# GPL-3.0 许可调整验证 · 2026-11-16

- 用户最终选择允许商用，分发衍生程序及后续修改版时继续提供完整对应源码。第一方代码与文档采用 GPL-3.0-only，LICENSE 使用 GNU 官方原文。README、NOTICE、贡献指南、第三方声明及 npm 许可元数据已同步。
- 原 Rare UI GooeyNav 样式附带 Commons Clause 限制。运行样式替换为本项目独立编写的 `src/components/segmented-controls.css`，使用固定间距、独立圆角、ARIA 状态下划线及可见键盘焦点。旧样式本机备份位于忽略目录 `target/licensing-backup`，历史来源及原许可保留在文档和 public/licenses。
- `npm test` 174 项、`npm run test:core` 核心 13 项及存储 9 项、依赖边界、Rust 格式和 workspace Clippy 均通过。日志位于本地 `target/gpl-*.log`。
- `npm run build` 通过，主资源 246.1 KiB / 254 KiB，按需 Blockly 与离线资源 795.5 KiB / 796 KiB。新 CSS 和主要许可文档通过定向 Prettier 检查。
- 浏览器连接创建及状态查询均超时，本轮分段按钮实际视觉和浏览器交互待复验。现有前端控制器测试及构建检查通过。
- GPU OCR 供应商原生资源的 GPL 组合与二进制分发条件列为待核对项。当前 GitHub 上传继续按用户要求暂缓。

# 源码公开准备验证 · 2026-11-16

以下记录为许可选择过程中的历史快照，最终许可见上节。

- 项目公开名称与 npm 元数据为 `moligod-toolkit`。第一方代码及文档采用 PolyForm Noncommercial 1.0.0，官方许可原文保存为 LICENSE，项目名、作者及预定仓库链接保存为 NOTICE 中的 Required Notice。README、CONTRIBUTING.md 和 THIRD_PARTY_NOTICES.md 说明使用、构建、署名和第三方许可。
- 拟发布文件按 Git 已跟踪及未忽略未跟踪文件合并去重，共 288 个文件、约 2.33 MiB。规则扫描覆盖本机用户及工作目录、私钥、常见 GitHub/API 令牌、凭据字面量及含凭据 URL，未检出匹配项。邮箱候选人工核对为图标文件名中的 `@2x.png`。原始审计结果位于本地 `target/publication-privacy-audit.json`。
- 历史设计文档中的本机绝对路径已替换为来源说明。忽略规则新增环境凭据、私钥、转储及根目录诊断、截图文件夹。Git 仓库级提交邮箱使用 GitHub noreply 地址。
- `npm test` 174 项通过；`npm run test:core` 核心 13 项、存储 9 项通过；`npm run check:boundaries`、`cargo fmt --all -- --check` 和 `cargo clippy --workspace --all-targets --locked -- -D warnings` 通过。
- `npm run build` 通过，主资源 247.5 KiB / 254 KiB，按需 Blockly 及离线资源 796.0 KiB / 796 KiB。README、CONTRIBUTING.md、THIRD_PARTY_NOTICES.md、docs/publication-progress.md 和 package.json 的定向 Prettier 检查通过。日志位于本地 `target/publication-*.log`。
- 整理前执行的 `npm run format:check` 报告 90 个既有文件格式问题，日志 `target/open-source-format-baseline.log`。全仓格式统一为后续待办。
- 用户要求暂缓上传，本轮成果保留在本地。Git 仓库当前尚无提交及远程配置。实际 Windows 窗口、输入、游戏兼容性和完整进程树性能待后续实机验收。

# 模块化与自动化重写验证 · 2026-09-27

本节为当前版本证据；下方 2026-09-26 的记录是历史快照，其中“未接入自动化/OCR”和旧体积数据不再描述当前实现。

- `cargo test --workspace --lib --locked`：21 个 Rust 单元测试通过；补充脚本保存保护测试后，自动化6项通过，合计22项。
- `npm test`：13 个前端/格式契约测试通过；`npm run build` 通过，前端资源101.4 KiB /150 KiB。
- `npm run check:boundaries`、Prettier、rustfmt、workspace Clippy `-D warnings` 通过；主程序禁止直接依赖两个工具引擎。
- crosshair_smoke：实际独立准星进程握手、显示/隐藏、状态事件、错误命令、关闭和重启通过。
- automation_smoke：实际模块脚本检查/保存/读取、循环变量结果106、状态事件、取消长等待和进程回收通过。
- native_smoke：专用 EDIT 窗口截图与 Windows OCR、Ctrl+A、Unicode 输入、输入后 OCR 均通过。
- 父进程异常退出实验：crosshair_smoke --abrupt 退出300ms后，该子进程已不存在，Windows Job 回收生效。
- 浏览器：打开自动化弹窗、添加750ms步骤、上移、JSON同步/应用通过；浏览器执行按钮禁用。截图 artifacts/automation-ui.png。该证据不能代替原生桌面按钮端到端验收。

本轮没有使用实际游戏运行自动化。游戏画面 OCR 准确率、不同 DPI/多显示器、受遮挡及独占全屏、长时间运行仍需验收。网络下载器、签名与线上升级未实现；目前按计划由完整安装包提供模块。下文历史性能记录不能当作本轮测量。

# 底座验证记录 · 2026-09-26

准星码输入框改为单行 text input。自定义图片样式点击生成时，输入框直接显示“自定义图片禁止生成准星码”，不产生准星码；编码函数也拒绝图片样式，并有回归测试。浏览器实际选择图片样式并点击生成，已确认该文字出现在单行框内。Node 13 个测试和前端构建通过。

“关闭设置/保存配置”从弹窗底部移至右侧参数列、快捷键一行下方，并保持右对齐。保留原按钮与表单行为。浏览器已截图核对位置；前端构建通过。

预览区固定为正方形，移除预览下方说明以免额外占高；浏览器实测 250×250。移除准星码介绍、范围说明和生成成功文字，生成后仅更新码输入框；保留输入框无障碍名称和错误反馈。浏览器已实际生成并确认不出现成功提示，前端构建通过。图片共享码本轮仅讨论可行性，未加入上传或图片编码功能。

准星码输入框及生成/复制/导入按钮已移至左侧预览下方、显示开关与显示器选择之后；删除原底部占位。浏览器已核对位置，并实际验证生成和导入仍正常。前端构建通过。

## 偏移拖动与提示精简

移除准星运行状态长文、显示器标签、预览操作说明和位置说明。偏移一行移至快捷键上方，垂直箭头上下排列，快捷键录入与触发方式同行。
偏移交互改为指针捕获拖动，数值从拖动起点计算，水平沿 X、垂直沿 Y；静止不随时间变化，没有重复计时器。松开/取消/失焦/关弹窗停止；单击仍可单步微调。
浏览器实际拖动验证：水平向右 30px 后 0→30，垂直向上 20px 后 0→-20。新的拖动计算回归测试通过，Node 共 13 个用例通过；前端构建与边界检查通过。

## 控件同行与单一开关

颜色和不透明度合为一行；移除独立“关闭准星”按钮，单一按钮在未运行时显示、运行时关闭并释放资源（快捷键临时隐藏期间仍可关闭）。显示器下拉移到此按钮右侧，同一行底部对齐。
浏览器已核对布局和按钮数量；TypeScript/前端构建与边界检查通过。

## 准星码与工具内预设

删除全局“我的预设”导航、独立预设页面及首页预设入口。准星设置内新增生成、复制和载入准星码，取消 JSON 文件导入导出交互。
自有 MG1 字符串编码仅含样式参数，附完整性校验；不携带本机显示器、偏移、快捷键或图片文件/标识。图片码载入后需另选图片。长度上限与参数校验同时执行，拒绝旧项目代码。
3 个准星码回归测试覆盖往返、本机参数保留、损坏码拒绝与图片隔离；Node 总计 13 个用例通过。浏览器已验证生成码、改动尺寸后载入恢复为 24、复制成功，且首页不再出现预设导航。

## 按键录入、按住模式与紧凑布局

快捷键改为点击后录入键盘或鼠标，支持左/右/中键及两个侧键。点击模式只在首次按下切换（过滤自动重复）；按住模式在按下时隐藏，松开恢复按下前的显示状态。录入开始/结束暂停和恢复触发，录入指针事件不误点其他控件、不弹出右键菜单。
原生使用 Raw Input 背景输入事件，只注册当前绑定所需的键盘或鼠标类别，停止时移除并还原先前注册；不使用低级输入钩子、不吞游戏输入、不轮询。配置升级为 3，已有当前项目设置保留 F8 等原有绑定语义。
尺寸/粗细、间距/圆点大小为两列；不透明度改数字输入；快捷键与显示器并排，另设触发方式。
验证：14 个 Rust 测试、10 个 Node 测试通过，覆盖键鼠映射、按住恢复、重复按下、旧绑定迁移。原生 smoke 通过监听设备切换、录入暂停恢复、启停回收。浏览器已实际录入 G 和鼠标右键并核对布局；实体侧键与真实游戏内行为仍待实机验收。

## 透明图片边缘与尺寸限制

修复前新增测试明确失败：白色像素经透明黑色插值后变为 [192,192,192]，700×600 图片被 512 限制拒绝。
改为 alpha 预乘缩放并移除 512 导入/显示限制后，同样测试通过：透明白色边缘维持白色，原生 BGRA 的 RGB 与 alpha 相等；700×600 图片正常导入并缩放为 1400×1200。保留 8 MiB 输入、解码尺寸/内存和渲染内存保护。
这是人工构造透明图对当前实现的回归验证，并未使用用户旧版出现黑边的原图；原图自带的黑色边框/不透明背景不会被删除。

预设界面移除“支持 moligod v1/v2”文案。预设导入只接受当前导出格式，删除早期格式补默认字段与 mixed 样式转换；旧预设拒绝用例已加入测试。本机既有设置文件不清空，此改动不引入任何旧 Python 项目支持。

图片格式说明已补充“PNG 支持透明背景，JPG 不支持透明背景；需要透明准星时建议使用 PNG”。仅文案变更，前端构建通过。

## 偏移按钮长按

水平偏移改为左右按钮，垂直偏移改为上下按钮，隐藏原生数字输入框的小步进箭头。按下立即变动 1 像素，350ms 后每 50ms 连续步进；松开、取消指针、失焦、隐藏页面、关闭设置或卸载时取消计时，到边界也停止。只有按住时创建计时器，改动复用实时更新队列。
新增 2 个重复控制测试，覆盖延迟连续步进、松开停止、边界停止与重新按下，共 8 个 Node 测试通过。浏览器按钮单击确认水平偏移 0→1；真实桌面长按仍待用户体验确认。

## 样式精简与实时更新

移除十字＋圆点，已有 mixed 参数归一为 cross。主按钮只切换“显示/隐藏”，另保留关闭工具释放资源。
所有参数输入、样式切换、图片选择、居中和方向键均接入实时更新。最新值队列限制一个在途和一个待更新，显隐/停止与更新串行；隐藏状态下参数更新不会主动显示覆盖层。
新增 3 个更新队列回归用例，覆盖快速连续输入合并、停止屏障与清空、异常后继续更新；连同预设测试共 6 个 Node 用例通过。前端构建、Clippy 通过。

## 图片预览 EncodingError 修复

复现：`node scripts/check-image-preview.mjs`，浏览器访问 127.0.0.1:1431。使用真实的预览解码函数、客户端 CSP 和已知有效 PNG，修复前输出 `FAIL: EncodingError: The source image cannot be decoded.`，策略事件为 `img-src: blob`。
原因：预览通过 Blob URL 解码，但 img-src 仅允许 self/data，Chromium 将被策略阻止的图片表现为解码失败。
修复：仅在 img-src 增加 blob:；提取共享 decodePngPreview，页面和回归工具使用同一函数。错误与过期请求仍释放 Blob URL。
同一回归入口修复后输出 `PASS: PNG decoded 32×32`。前端构建与边界检查通过；未使用用户原图，不将此结果当成所有图片格式的验收。

## 全新 Rust 准星（本轮）

用户明确要求从头重写、不要仿旧版结构；已接入独立原生透明窗口，不依赖 Python，不增加 WebView，不实现旧版兼容层。
支持十字/圆点/混合/圆圈/静态图片、颜色/不透明度、显示器中心偏移、方向键微调、F6–F11 显隐快捷键、保存/导入导出本项目预设。

- Rust 8 个核心/存储/栅格测试通过；Node 3 个预设契约测试通过；边界检查、格式、Clippy `-D warnings`、Windows Release 构建通过。
- 原生 smoke：100 次创建、更新、隐藏、恢复、销毁；无残留窗口，GDI 0→0，前台窗口未改变，HTTRANSPARENT 命中，空闲不重绘。
- 原生 smoke：错误图片更新保留已有覆盖层；F9 注册冲突、WM_HOTKEY 切换、停止后注销成功；当前 1 台显示器的物理坐标偏移通过。
- 浏览器：设置面板、样式切换、方向键使水平偏移 0→1 正常，原生操作在浏览器预览禁用。
- 独立覆盖层 Release smoke --hold：16.27 秒、2 个进程（测试程序及其控制台宿主）、私有提交量 2.98 MiB、工作集 17.99 MiB，累计 CPU 时间未增长。**不包括 Tauri 主界面**，不是整个客户端的内存占用。
- 新版客户端已启动并响应。准星尚未开启时，预热 10 秒后的 10.29 秒采样：7 个进程、私有提交量 183.36 MiB、工作集 376.19 MiB、累计 CPU 时间未增长；记录在 artifacts/crosshair-client-idle.json。未测主界面与准星同时运行时的增量，不将两个独立样本直接相减。
- 本项目早期 v1 配置读取时升级至 v2，读不写盘，保存时保留原始备份；此兼容仅针对 moligod 本身，不针对旧 Python 工具。

边界：尚未完成真实游戏、实体键盘、混合 DPI 多屏/热插拔，以及 Tauri 原生按钮点击的端到端验收。原生 API 测试不冒充这些验收。自动化助手仍未接入。
详细实现见 docs/crosshair.md；采样原始数据为 artifacts/crosshair-native-idle.json。

## 顶栏与页脚精简

按红框移除顶部“游戏工具箱/开发版”“本地工作台”、左下角连接状态和版本、底部标语与版权，并删除相关 DOM 更新代码和无用样式。未标注的浏览器预览提示保留。
浏览器已核对三角洲页面，相关区域均已移除，无控制台 error/warn；前端构建与依赖边界检查通过。

## 通用工具与攻略站入口调整

自定义准星和自动化助手均归入通用工具，分类计数为 2。三角洲行动独立页面仅保留攻略站按钮，链接为 https://moligod.com。
本轮 Windows Release 构建和 Clippy 通过，新版客户端已启动；尚未进行原生按钮唤起默认浏览器的端到端点击验收。
浏览器已确认分类包含两项、独立页面只有标题与入口，以及 href 地址；前端构建、依赖边界检查通过。桌面使用仅允许固定地址的 Rust 命令调用系统默认浏览器，未把攻略网站嵌入 WebView。

## 无边框窗口调整

按用户红框截图移除 Windows 系统标题栏，将最小化、最大化/还原和关闭融入深色顶栏。仅 main 获得必要窗口权限，窗口关闭继续触发既有托盘策略。
根页面固定高度且不滚动；中央 main 区域独立滚动，使用细深色滚动条。
前端构建约 55.8 KiB；预设测试、格式、依赖边界、Clippy 和 Windows Release 构建通过。
浏览器 1120×760 下文档高度等于视口高度，main 高 692，顶栏按钮右边界 1110，无横向溢出。浏览器预览原生按钮禁用。
真实窗口检查记录保存在 artifacts/window-chrome-check.json 和 artifacts/window-client-check.json。Tao 的无边框实现保留 WS_CAPTION 位、通过 WM_NCCALCSIZE 改变非客户区，因此不能单凭该位判定标题栏是否存在；额外读取客户区原点与窗口顶部的几何差值。拖动、双击、最小化和托盘往返的真实点击验收仍需单独进行，不以浏览器预览替代。

## 界面调整补充

本轮按用户提供的 Steam/TapTap/WeGame 截图调整桌面布局，核心 Rust 和配置格式未变。
浏览器已检查：游戏分类、按钮搜索、Enter 搜索 OCR、无结果与清除筛选、可配置状态筛选、卡片/列表切换、准星弹窗和 Esc 关闭。
1120×730 和 820×600 下检查布局，820 宽时文档宽度 805（滚动条占 15px），无横向溢出。
TypeScript/前端构建、预设契约测试和依赖边界检查通过；前端总资源约 38.2 KiB，含本地图标。
下方的 EXE 哈希和进程内存属于此前底座版本，不代表本轮更新后的性能测量。

本轮 Windows Release 构建通过，并已重新启动客户端。浏览器控制台未发现 error/warn。原生界面点击路径仍不作为已验收项。

## 已验证

- Rust 核心/存储 5 个测试通过：参数约束、重复启动拒绝、20 次取消/重启、Drop 回收、线程 panic 传播、原子覆盖与备份、损坏/未来版本/超限配置保护。
- Node 预设契约 2 个测试通过：导入参数保持及不合法格式/参数拒绝。
- TypeScript 严格检查、依赖边界检查、Prettier、rustfmt、Clippy `-D warnings` 通过。
- Windows Release EXE 构建通过；前端 HTML/CSS/JS 合计约 25.1 KiB（未压缩），预算 150 KiB。
- 浏览器检查：工具箱/预设/设置导航，准星弹窗，尺寸从 24 调到 40 的实时预览，Esc 关闭，浏览器模式禁止原生写入；控制台未捕获 error/warn。
- Release 程序启动后进程 Responding=true，窗口标题 moligod；再次启动的进程在 5 秒内退出，原进程继续运行。
- Windows CI 定义已写入，尚未推送仓库或运行远程 CI。

## 原生证据边界

浏览器 UI 检查不是 WebView2 原生交互测试；存储单测不是点击保存按钮的端到端测试。
本轮未验证原生保存/导入导出对话框、托盘菜单点击及关闭到托盘往返。
当前托盘行为为隐藏窗口，**不会销毁 WebView**；托盘降占用是下一项性能验证，不能宣称关闭后已释放全部 UI 内存。
开发环境的安装包生成、代码签名、自动更新及升级恢复尚未验收。
没有覆盖层/实际自动化/OCR 的运行证据，因为这些能力尚未接入。

## 性能记录

测试环境：Windows 11 专业版 10.0.26200，AMD Ryzen 7 9800X3D，约 31.6 GiB 可用物理内存，16 个逻辑处理器。Rust 1.97.1、Node 24.13.0，Release 构建。

初次启动采样约 215 MiB 私有提交量，仅作初始观察，不作为稳定预算或产品承诺。
最终 EXE：6,163,968 bytes（约 5.88 MiB），不包括系统 WebView2 运行库。
SHA256：`A264C5CAF768F5D7A9CB48AC5532BEFA46C5476C65B9CA0E1FD1445AA9CAEE1A`。

预热约 23 秒后采样 20.28 秒，主窗口空闲，包含 WebView2 的 7 个进程，采样前后进程集合稳定：

| 指标           | 本次观察                                   |
| -------------- | ------------------------------------------ |
| 私有提交量合计 | 194.48 MiB                                 |
| 工作集合计     | 385.70 MiB（可能重复统计共享页）           |
| CPU            | 该时间窗中累计 CPU 时间未增长，采样显示 0% |

这是单机单次观察，不能据此声称长期零 CPU 或已达到极致轻量。尚未做 5 次冷启动和托盘内存基线。
原始进程信息保存在忽略提交的 artifacts/launch.json 与 artifacts/idle-baseline.json。

## 本轮安装包与 Release 空闲测量

最终 `npm run modules:package` 与 `npm run tauri build -- --ci` 成功，NSIS 包包含两个模块的 EXE 和 manifest（已核对生成的安装脚本）。两个 ZIP 逐一重算包内引擎 SHA256，与清单一致。

- NSIS：target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe，2,381,941 bytes。未执行安装向导/卸载/升级验收，未签名。
- 平台主 EXE：6,811,648 bytes；准星引擎约0.92 MiB、自动化引擎约2.35 MiB（未压缩）。
- ZIP：准星463,533 bytes，自动化1,040,621 bytes。未来还需可信签名、下载器与原子安装。
- 正常关闭开发版后启动最终 Release。预热10秒，空闲采样20.29秒；完整进程树7个进程，集合稳定，只有平台和WebView2，没有工具引擎进程。
- 私有提交合计187.13 MiB；工作集合计414.02 MiB（可能重复统计共享页）。本次采样累计CPU增量0；不是长期零CPU承诺，也不代表WebView常驻内存已达到最终目标。
- 原始记录：artifacts/modules-release-idle.json。当前启动的是最终Release程序，开发源码仍可用start-dev.bat启动。

## 窗口绑定标签与布局调整 · 2026-09-27

顶部改为窗口 A/B 标签、新建窗口、删除窗口、刷新窗口；当前标签下选择系统窗口。新增按 A–Z 分配，删除不重编号，不关闭系统窗口。步骤仍引用的标签拒绝删除；运行中禁止增删和改绑定。Rust Slot 扩展到 A–Z，原 A/B 脚本仍可读取；导入脚本时自动补齐使用的标签。窗口句柄及 PID 仍为本次会话绑定，不写入分享脚本。

添加步骤/执行步骤改为7:3，窄屏折叠为单列。浏览器实测680.4px/291.6px，比例70%/30%，无横向溢出。实际操作验证新增C、步骤目标选择C、被引用时删除拒绝、删除对应步骤后删除C成功；控制台无error/warn。截图：artifacts/automation-layout-70-30.png。

Node13项、自动化7项（含新增窗口标识往返/非法名称测试）、core/storage9项均通过。TypeScript/前端构建、依赖边界、Clippy通过，前端103.3 KiB。原生多窗口点击操作未在真实游戏中重测。

本轮独立模块ZIP及NSIS安装包重新构建成功，更新后的Release已启动，进程Responding=true。

## 窗口管理归入添加步骤列 · 2026-09-27

窗口标签、新建/删除/刷新及系统窗口选择框整体移入 auto-composer，和添加步骤共用左侧70%列；执行步骤保持右侧30%，从分栏顶部开始。仅调整HTML层级，保留所有控件ID与交互。

浏览器已确认工具栏和选择框完全落在左列内（列宽687.67px，内部控件666.88px，差值为分隔线与内边距）。截图artifacts/automation-window-left-column.png。前端构建、依赖边界检查通过，资源仍103.3 KiB。

本轮NSIS构建通过，更新后的Release已重新启动。

## 主内容区工具页面与可收起侧栏 · 2026-09-27

准星和自动化由 dialog 改为 main 内普通 section 页面；统一导航在离开工具页时发送关闭生命周期事件，继续释放空闲模块、取消准星录入和拖动，运行中的工具按既有规则保留。返回工具箱按钮取代弹窗关闭按钮。侧栏增加收起/展开按钮，收起宽70px，只显示图标，保留可访问名称和悬停标题；用版本化 localStorage 键保存展示偏好，存储不可用不影响导航。

浏览器验证：收起宽70px、刷新后恢复、两个工具均为main子元素、无打开的dialog、页面切换只显示一个页面、准星快捷键录入期间点击设置可退出录入、重新进入仍为F8；未发现控制台error/warn。前端13项测试、构建及边界检查通过，资源107.0 KiB。截图artifacts/tools-main-content.png。没有以浏览器验证替代原生模块运行验收。

本轮Release EXE和NSIS安装包构建通过。保留正在运行的开发版进程，未强制关闭或重启用户客户端。

## 顶部返回与拖动取坐标 · 2026-09-27

工具页返回按钮统一放在主内容区顶部右侧，移除原“本地运行·按需开启”和准星页重复返回按钮。自动化英文/中文大标题隐藏为可访问标题，移除桌面模式常驻紧急停止说明；错误/操作反馈仍按需显示，不删除Ctrl+Alt+F10功能。

自动化坐标下新增“按住拖动取坐标”：先绑定系统窗口并选择动作目标，按住左键拖到对应窗口客户区，松开后填写X/Y。原生模块仅在显式取点期间检查鼠标/Esc（8ms，最多15秒），使用物理像素DPI上下文和ScreenToClient，验证HWND/PID、鼠标实际所在窗口和客户区边界；不主动移动鼠标或发送点击。不在平台UI线程阻塞，浏览器模式禁用。旧截图选点方式仍保留。

原生fixture测试验证客户区(35,45)→桌面→客户区往返，以及区外点拒绝；第一次测试暴露测试线程DPI虚拟化舍入，按生产取点相同的PerMonitorV2上下文修正后通过。原有OCR/输入fixture通过，自动化7项、前端13项、Clippy/边界/前端构建通过。实际手动按住拖出WebView到游戏窗口的端到端交互尚待用户验收。

本轮模块ZIP、Release及NSIS构建完成；模块RPC回归与core/storage9项通过。当前开发进程保留，未强制退出。截图artifacts/automation-drag-point.png为浏览器预览，原生取点按钮按设计禁用。

## OCR截图框选区域 · 2026-09-27

点击动作使用单点X/Y与原生拖动取点；OCR、图像匹配、保存截图改为矩形选择，隐藏原生单点拖动按钮。点击“截取窗口并框选区域”显示绑定窗口的新截图，在截图上按住左键拖出矩形，松开填写左上X/Y、宽/高，并显示左右角坐标与选区覆盖框。支持反向拖动、出界裁剪、Esc/指针取消；0面积不覆盖已有参数。截图按原始像素尺寸换算，缩略显示不改变识别坐标。OCR测试与保存步骤继续使用同一region字段。

切换动作、目标、窗口绑定、刷新窗口或离开页面会废弃截图及迟到响应。截图解码完成后滚到可见区域。纯几何回归覆盖缩放坐标、反向选择、边界与零面积，Node合计15项通过；前端构建110.4KiB、边界和格式检查通过。浏览器验证OCR有左上坐标/宽高及框选入口，单点拖动按钮隐藏；浏览器不允许原生截图，实际游戏截图拖框到OCR完整路径未作本轮端到端验收。

本轮Release与NSIS安装包构建完成。

## 修复截图无弹窗/目标窗口遮挡 · 2026-09-27

检查发现原路径仅展开主页面下方的img并scrollIntoView，从未创建截图弹窗；native::capture会focus目标窗口，而宿主之前未恢复moligod焦点。改为独立截图选择dialog：点击即打开加载状态，绑定错误、IPC错误、解码错误在弹窗内显示，成功显示图片。选点/框选完成后关闭弹窗返回参数；取消或关闭使迟到结果失效。工具编辑器本身仍在主内容区。宿主preview/ocr-test完成（包括错误）后，编辑器仍打开时恢复平台窗口焦点。

复用生产screenshot-dialog组件的tests/fixtures/screenshot-picker.html回归页：浏览器实际点击后:modal=true、图片naturalWidth=800且可见；取消后可重新打开，模拟错误显示于弹窗并隐藏旧图。该测试使用明确标识的测试SVG，不代表真实游戏截图验收。Node15项、前端构建、边界检查和workspace Clippy通过；前端111.6KiB。真实游戏窗口捕获/切回平台仍待用户复核。

本轮Release与NSIS安装包构建通过。

## 修复截图被前台激活限制拦截 · 2026-09-28

native::capture原先直接调用focus，导致截图报“无法激活目标窗口，已停止输入”。改为独立WGC窗口适配器，删除截图中的focus/桌面BitBlt依赖。所有截图消费者共用此路径，输入动作本身仍保留激活保护。

已只读参考WebTrade的WGC、新帧获取、前后台输入锁、动作分组、监控生命周期与OCR模块；具体映射见webtrade-reference.md。

`cargo run -p moligod-automation --example native_smoke`现在默认执行捕获回归：目标后台且被自有窗口覆盖，读到目标12345；前台句柄不变；修改目标为67890再次截图得到新内容；越界拒绝；客户区坐标往返通过。前台输入独立保留在 --with-input，本轮因操作系统激活限制未通过，不以截图回归代替输入验收。7项自动化单测、15项Node测试、Clippy、边界、格式检查通过。

新增windows-capture 2.0.1仅打入自动化引擎；本次Release引擎2.52MiB（此前2.36MiB）。这是文件体积，不能当作常驻内存数据；旧进程树性能记录不代表本轮WGC工作期间占用。实际用户游戏/多DPI屏幕仍待复核。最小化与受保护画面不能承诺捕获。

## 独立截图/OCR子窗口 · 2026-09-28

将原截图HTML dialog与底部OCR文本替换为Tauri独立WebviewWindow（owner为main）。新增auxiliary.html与受限capability、标签校验的状态/选区提交命令、选区边界校验与单会话回收。修复全局CloseRequested原本对任意窗口都退出app的问题，现在只有main执行关闭/托盘逻辑。

后端选区测试覆盖完整边界、越界、负坐标和OCR模式禁止回填；通过。浏览器测试tests/fixtures/auxiliary-content.html复用生产渲染器，OCR展示中文/多行/数字；区域页面实际拖框得到(88,104)到(283,166)、195×62，并启用确认按钮。截图artifacts/ocr-child-content.png是明确测试内容，不是一次真实OCR请求。独立原生窗口的用户操作往返仍待桌面验收。

本轮15项前端测试、后端选区校验、workspace Clippy、格式/边界检查通过。双入口前端114.8KiB；Release及NSIS构建完成。主页面浏览器检查不存在dialog元素，工具页正常打开且无控制台error/warn。

## 修复OCR模块进程访问冲突 · 2026-09-28

新增`cargo run -p moligod-automation --example native_smoke -- --module-ocr`，通过真正ModuleClient子进程对专用后台测试窗口连续请求preview→ocr-test。修复前复现“IPC: 模块进程已退出”，首轮未完成。Windows Application日志给出engine-b42b526ee936d4b0.exe异常0xc0000005、RVA 0x3f87b3；用该构建PDB解析至Windows.Foundation.Metadata.IsApiContractPresentByMajor调用。

原模块每个预览/OCR请求构造并销毁NativeDriver，RoInitialize/RoUninitialize随请求结束，而WGC/WinRT工厂缓存跨请求存在。模块入口增加线程绑定的WinRtApartment守卫，将MTA初始化保持到工作线程停止、对象释放和进程退出；不是忽略异常或重启重试。修复后相同IPC烟测5轮全部读出12345，正常shutdown。

7项自动化单测、workspace Clippy、边界检查通过。新增module-host仅作为自动化crate的dev-dependency用于跨进程回归，不打入工具运行引擎。此前直接调用引擎的测试没有覆盖每次IPC请求重建COM环境，不能替代本次回归。

同一跨进程回归对Release模块也连续5轮通过（--module-ocr --release-module），每轮包含真实WGC截图和Windows OCR。

## WebTrade 任务、动作组和双区域OCR迁移 · 2026-09-28

只读参考 WebTrade：backend/main.py 的任务保存、`flatten_actions` 与交互执行；frontend/js/modules/interaction-editor.js 的动作组、选中/拖动排序；frontend/js/modules/roi-editor.js 的成对区域 `name_roi`/`price_roi`、截图上双框；backend/interaction.py 的点击/滚动边界。保留本项目 Rust 引擎/Windows OCR，不引入云端、数据库、Python、TensorRT、ONNX模型或旧任务格式。

- 新版任务文件 `tasks/<UUID>.json` schemaVersion=1，包含名称、源窗口槽位、循环间隔、自己的脚本。最多保存64项；覆盖已有项先验证旧内容；归档移到 `tasks/trash`。窗口HWND/PID不持久化，重启后须重新选择源窗口。
- TaskManager 按任务实例独立运行，最多4个并发。每项启动/停止/全部启动/全部停止、状态事件、变量、日志独立；宿主离开编辑页时只在所有任务均停止后卸载模块。进程退出先对所有任务发取消，再逐个等待，避免工作线程占住输入锁。Ctrl+Alt+F10 由运行中任务共用一处注册，触发时取消全部；前台输入使用一处串行锁，截图可并行且仍取新帧。
- 动作组以树形脚本保存，编译前有界展开后复用原有控制流引擎。编辑器支持新建、连续选中的动作批量成组、在列表内拖动重排及拖进组；旧单层脚本保留可读取。拖动动作按时长沿客户区物理坐标插值，取消/失焦释放鼠标按键；滚轮动作有坐标与增量约束。
- 单个OCR继续用一框；成组OCR在同一截图上选A/B两个矩形，从同一新帧裁剪并识别，保存对象 `{A,B}`。`SetFromOcr` 明确选组变量与A或B写入目标变量；截图测试结果子窗口分别显示A/B。区域、变量、脚本数量及耗时均有限制。
- 当前OCR仍是Windows.Media.Ocr。WebTrade的模型设备下拉、后台PostMessage输入、云端上传及旧数据格式未加入，不把无法可靠后台操控的游戏标成已支持。

证据：Rust单测验证组展开及B值选择、损坏任务拒绝覆盖/归档；跨进程原生fixture验证同帧A/B识别、两个独立任务并发、停一个另一个继续、停止全部和模块重启后的任务文件保留。浏览器验证任务表、双区域OCR源变量选择、批量成组与嵌套列表；子窗口A/B两次框选后确认按钮启用。实际游戏的拖动输入、OCR准确率和长期多任务资源占用仍需实机验收。截图 `artifacts/ocr-pair-selection.png` 是测试图片，不是游戏实测。

## 最终构建核对 · 2026-09-28

最终 `npm run build` 前端132.6KiB/150KiB；`cargo clippy --workspace --all-targets --locked -- -D warnings`、`npm run format:check`、依赖边界检查通过。自动化Rust单测10项，Node回归17项。两条真实模块IPC smoke分别通过：双区域OCR A/B并选择B赋值；两任务并行，单独停止/全部停止，模块重启后任务文件仍在。WGC字幕/OCR旧实例崩溃回归继续保留。

`npm run tauri build -- --ci` 完成，NSIS安装包 `target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe`，安装脚本包含两个独立引擎。模块ZIP逐一重算SHA256与manifest一致：自动化1,175,516字节、准星463,547字节。前端最后修改时间早于最终EXE，确保安装包包含连续成组保护与任务监控界面。

浏览器确认任务配置与状态入口、成组OCR变量来源下拉、连续动作批量成组及子列表，双框测试图片先A后B完成时确认按钮启用；控制台无error/warn。截图 `artifacts/automation-tasks-and-actions.png` 与 `artifacts/ocr-pair-selection.png` 为UI/合成图片证据。浏览器不是原生任务保存或真实游戏输入验收。真实游戏的拖动注入、各语言OCR准确率和四任务长期内存/CPU仍需实机观察。当前安装包没有云端功能。

最终源文件时间与产物核对：前端132.6KiB，Release和NSIS安装包构建通过；开发模块manifest已重新生成。NSIS列出的自动化/准星引擎均由当前manifest提供。实际游戏多任务输入仍待用户验收。

## 准星触发方式切换与自动保存 · 2026-09-28

原生回归 `cargo run -p moligod-crosshair --example smoke -- --mode-switch` 修复前失败：点击模式隐藏后，切成按住隐藏仍不可见。原因是原实现保存并恢复旧可见性，旧状态为隐藏时，松手也只能恢复隐藏。修复后该回归通过，并检查真实窗口 `IsWindowVisible`，不只检查返回的状态字段。

- 按住隐藏在启动/切模式时恢复可见，松手始终恢复可见；新增按住显示/松手隐藏，启动/切模式从隐藏开始。清理旧按键状态；按键重复不反复切换。清除按住显示的快捷键恢复可见，单纯调整外观保持现有显隐。
- “显示”改为“显示准星”；移除保存按钮，所有有效参数修改自动保存，准星未启动时仍保存。连续修改合并最新值，旧保存回复不会回写覆盖新草稿；与窗口设置共享写入队列，避免丢失另一字段。损坏/未来配置仍由存储层拒绝覆盖，失败保留草稿并报错；不完整数字不保存。浏览器预览只保存当前页面会话。
- Node20项通过，新增自动保存并发/错误恢复及三种触发方式校验；core7、storage5、crosshair5项通过，含新模式落盘重读和上一版备份。原有100次原生启停、无焦点抢占、GDI 0→0、空闲无重绘回归继续通过。
- 浏览器验证无保存按钮、三种触发选项、未开启时修改参数后切页重开仍保留最新有效值；清空数字未覆盖先前值，控制台无error/warn。截图 `artifacts/crosshair-hotkey-autosave.png` 为浏览器界面证据，不能代替真实游戏/实体键鼠验收。

Release、NSIS安装包以及开发模块已重新构建，前端132.4KiB/150KiB。开发模块通过真实ModuleClient RPC显隐/切模式/更新/停止/重启回归。仍保留现有开发进程，未强制关闭用户客户端；已加载的旧模块需停止后重新开启或重启客户端。

Release模块同一RPC回归通过（`crosshair_smoke --release-module --hold`），30秒保持期间drawCount不变并正常shutdown。按完整进程树采样10.37秒，共4个稳定进程（测试宿主、准星模块及控制台进程），私有提交4.92MiB、工作集33.32MiB、采样累计CPU未增长；原始数据 `artifacts/crosshair-autosave-release-tree.json`。该采样不含Tauri/WebView，不能当成整个平台内存，也没有测量连续滑动参数时的磁盘吞吐。

`npm test`、`npm run test:core`、依赖边界、前端构建、Prettier、fmt、workspace Clippy与diff检查通过。最终安装包2,494,632字节，准星独立ZIP463,599字节；已核对NSIS脚本包含当前两个模块引擎及清单，未执行安装/升级向导。实体鼠标按住/松手及真实游戏覆盖仍需实际使用验收。

## 准星按钮文案与可点击目录 · 2026-09-28

按钮同步改为“开启自定义准星/关闭自定义准星”，宽度按内容计算并与显示器选择维持同一行；准星页面去掉可见CROSSHAIR及重复中文标题，保留visually-hidden标题供辅助技术及切页焦点使用。

面包屑改为链接，工作台返回工具箱，当前目录的名称、目标与当前页面同步；复用showPage，离开工具页继续触发close生命周期。浏览器实际点击当前目录及工作台返回正常；录入快捷键期间点击工作台，再进入准星页恢复F8且录入状态为false。按钮101.6px、显示器138.4px，同一行没有页面横向溢出，控制台无error/warn。截图 `artifacts/crosshair-breadcrumb.png` 为界面预览证据。

20项Node回归、TypeScript/前端构建（132.5KiB/150KiB）、依赖边界、Prettier及diff检查通过。仅调整前端结构、导航和文案，没有新增原生调用或改变准星显隐/自动保存协议。Release与NSIS已重新构建，安装/升级向导未执行。

## 工具标签、卡片开关与顶部间距 · 2026-09-28

顶部改为工作台按钮及会话内工具标签。打开准星/自动化时去重创建标签；切换或返回主页保留表单/模块编辑器，deactivate仅取消临时录键和截图交互，close才调用原有release。关闭后台标签不切换当前页，关闭当前页选相邻标签，全部关闭返回工作台；运行中的工具继续由自己的开关停止。原生初始化等上次release完成后执行，自动化初始化请求串行且使用会话代次丢弃已关闭页面的迟到结果。

准星卡片右上新增开启/关闭，使用最近有效配置、同一状态事件及既有start/stop API；浏览器模式禁用，不模拟原生开启。两个工具页顶部增加20px间距，标签栏滚动时固定可见，无新增启动进程、定时轮询或依赖。

23项Node回归通过，含标签去重/主页保留、后台关闭不跳页、当前关闭回相邻及全部关闭回主页。浏览器验证：准星不完整透明度输入切到自动化再返回仍保留；自动化任务名、650ms待添加参数和3步动作列表切换后保留；临时快捷键录入切页后取消。实际关闭后台/当前/最后标签均正确，ArrowRight可切换并将焦点放到新标签，始终只有一个.page可见；20px内距、无横向溢出，控制台无error/warn。截图 `artifacts/tool-tabs-home.png` 和 `artifacts/tool-tabs-crosshair.png` 为浏览器界面证据。

TypeScript/前端构建135.8KiB/150KiB、依赖边界、Prettier与diff检查通过。实体桌面卡片开关、模块初始化期间快速关闭重开及实际游戏交互未由浏览器验证，需在桌面使用中复核；运行引擎与原生命令未变更。

最终 `npm run tauri build -- --ci` 通过，包含串行初始化保护；NSIS安装包2,497,807字节（2026-09-28 12:13:47 +08:00）。未强制停止现有客户端，安装/升级向导未执行。

## 标签等宽与恢复返回按钮 · 2026-09-28

工作台和两个工具标签统一为120×36px；工具标签区域保留横向滚动，右侧返回工具箱按钮不收缩。移除卡片开关的HTML、事件与状态更新代码，状态徽标仍显示。返回按钮复用showPage，返回主页时不关闭工具标签。

浏览器实测三个标签的宽/高均为120/36，top均为78.1；卡片快捷按钮元素数量为0。点击返回后可从主页打开自动化，两个标签均保留，工具页右侧返回按钮可见。23项Node回归、前端构建（135.2KiB/150KiB）、依赖边界通过。本轮为前端布局和入口调整，没有修改原生命令。

最终Release与NSIS构建通过，Prettier及diff检查通过。界面截图为 `artifacts/tool-tabs-uniform-return.png`，控制台无error/warn；未执行安装向导。

## 任务行选择与动作窗口归属 · 2026-09-30

任务配置区仅保留“任务名称”和“每次任务间隔（毫秒）”，删除任务下拉与任务级窗口源。点击下方任务行选中，高亮行并回填该项名称/间隔/脚本；移除重复的编辑按钮，运行/停止及日志详情仍是独立操作。Enter可选择任务，切换保留各任务草稿；无效JSON阻止切换以保留输入。异步读取检查选择代次，迟到结果不覆盖最后选择。动作目标及窗口绑定继续位于步骤编辑区，读取嵌套动作组时也创建相应槽位。

删除前端和TaskManager的任务级窗口源检查，实际窗口依赖由Automation对编译后的动作逐项检查。新版任务保存为schemaVersion=2；固定v1夹具验证源窗口A被移除后动作目标B保持不变，读取不改原文件，首次保存保留原字节.json.v1.bak；损坏、未知字段和未来版本均不能覆盖。

验证结果：

- Node23项、core7项、storage5项、automation13项通过；新增任务版本读取/备份、未知数据保护以及动作缺失绑定拒绝测试。
- Debug和Release独立模块RPC分别通过：两个纯等待任务以空bindings启动并行，停止一项另一项仍运行、全部停止、模块重启后任务保存仍在；列表不再返回source字段。
- 生产页面浏览器验证配置区仅两个字段、原任务下拉/窗口源元素不存在、无横向溢出，新增点击动作选窗口B后步骤显示“鼠标点击 · B”。任务组件夹具使用生产HTML/CSS和组件、测试数据后端，验证选择两行分别回填5000/8000ms与不同脚本，6500ms草稿切换后保留，Enter选中，保存请求schema2且无source；延迟2秒的较早读取没有覆盖最后选中的任务；无效JSON保持原选择及文本。浏览器fixture不执行原生输入，不替代桌面交互验收。
- TypeScript、依赖边界、前端构建135.4KiB/150KiB、fmt、workspace Clippy、Prettier及diff检查通过。截图 `artifacts/automation-task-metadata.png` 为生产页面浏览器预览，`artifacts/automation-task-row-selection.png` 为测试任务选择预览。

最终 `npm run tauri build -- --ci` 完成。NSIS安装包 `target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe` 为2,495,767字节（2026-09-30 16:30:31 +08:00），安装脚本包含当前自动化/准星引擎和清单；自动化Release SHA256为11ff5ce6902579cab311bbe960d08d31762949d93ceaa17e873be146f674dd3c。保留用户现有客户端及开发服务，未执行安装/升级向导，当前已加载的旧模块需重启客户端更新。实体窗口输入与OCR效果属于既有实机验收范围，本轮没有将浏览器测试标成实机结果。

## 动作分类与两/三列参数 · 2026-09-30

操作选择拆成分类和操作两个下拉，28个原动作分入6类，每类4–6项。分类切换保留上次所选动作，包含识别方式切换产生的ocrGroup；参数值与动作列表保持。短参数为两列，当前动作只有三个短字段时为三列；坐标成对、长内容整行，650px以下分类与参数改为单列。原70%添加步骤/30%执行步骤布局不变，没有新增原生命令、引擎依赖或持久化字段。

浏览器遍历6类28个操作，核对各操作可见字段、所有操作均可选择、无页面横向溢出。实测点击动作的目标/鼠标按键同一行，按住时间/步骤前延时同一行，宽度均约373.65px；滚动动作目标/滚动量/延时三项同一行，宽度均约245.76px。分类和操作同一行。截图 `artifacts/automation-actions-categorized.png` 和 `artifacts/automation-actions-three-columns.png` 为生产页面浏览器预览，控制台无error/warn；未将浏览器预览标成原生输入执行。

参数验证发现并修复原有编码遗漏：drag、scroll、ocrGroup此前没有target，ocrGroup还带有Rust枚举不支持的reuse字段。现在补齐目标，reuse选项只在单个OCR显示和编码；同时补齐新增动作的中文步骤名称。从真实表单依次添加点击/拖动/滚动/OCR成组/取B值（窗口B、右键、坐标12/34、按住60ms、延时20ms），保留原注释和等待共7步。脚本导出到 `artifacts/automation-categorized-script.json`，通过Release模块真实stdio协议的validate和shutdown；回复valid=true、进程正常退出，未执行输入/截图/OCR。证据 `artifacts/automation-categorized-script-validation.json`，模块SHA256仍为11ff5ce6902579cab311bbe960d08d31762949d93ceaa17e873be146f674dd3c。

23项Node回归、core7项、storage5项、TypeScript、依赖边界、fmt、workspace Clippy、Prettier与diff检查通过。最终前端137.9KiB/150KiB；最终Release与NSIS安装包构建完成，包含上述参数编码修复。没有执行安装/升级向导；游戏实际输入和识别效果未在本轮重新验收。

## 任务标题按钮、逐项运行与三行列表 · 2026-09-30

新建/保存移到“我的任务”标题旁，归档入口保留并补充提示。删除上方运行当前、停止当前、运行全部、停止全部的HTML及事件；各保存任务行右侧独立显示运行/停止，按自己的running状态禁用，保留原task-start/task-stop协议。任务选择、草稿、详情及原生归档机制不变。

列表最多展示前三项实际高度，包含草稿；普通行52px，间隙8px，三行172px；超出时局部滚动。展开详情和窗口尺寸变化时重新计算高度，状态重绘保存scrollTop，避免运行任务事件将滚动位置复位。无轮询及新增原生命令。

生产任务组件/HTML/CSS夹具使用5个保存任务加草稿验证：6行均52px、clientHeight172px、scrollHeight352px；四个顶部运行控制元素均不存在。新建/保存按钮top均113.8，标题top121.4，垂直居中同一行。访问最后任务、点击运行后该行运行禁用/停止启用，停止后反转；运行其他行不改变当前任务选择，选择价格识别正确回填8000ms。末项状态重绘后列表仍停留在底部；Home可回顶部。截图 `artifacts/automation-task-toolbar-scroll.png` 明确标识测试数据，不是原生任务执行证据，控制台无error/warn。

Node23项、core7项、storage5项、TypeScript、依赖边界、前端构建137.8KiB/150KiB、fmt、workspace Clippy、Prettier及diff检查通过。本轮只调整前端任务控制和布局，运行引擎未变更；最终 `npm run tauri build -- --ci` 完成，Release和NSIS安装包已更新，未执行安装向导。不将浏览器按钮测试当成真实游戏执行。

## 可执行积木编辑器 · 2026-09-30

以原schema1脚本构造积木树：组、循环、条件/分支为容器，普通动作按类别着色；保留开始/结束标记和其它字段写回原脚本。指针捕获实现实际拖放，避免依赖WebView中的HTML原生拖拽行为；鼠标标题/握柄、前后槽位、嵌套槽位、键盘上下排序、连续选择成组及容器删除均使用同一模型。字段合法输入即时更新JSON而不重绘输入框；运行中的单脚本不能插入、成组或改参数。执行索引映射仍按原引擎展开顺序计算。

- Node27项通过；新增4项涵盖运行时拒绝编辑、带延时/窗口目标的循环条件/ElseIf/Else/组往返、完整控制块移动及源数据不变、自嵌套拒绝、新建闭合、不完整分支拒绝与34层深度拒绝。原动作组/拖动、任务导航及其它回归保留。
- 生产页面浏览器实际创建循环、内部等待、嵌套条件及否则分支；块内等待100→120立即反映到JSON。实际指针拖入循环后500ms动作位于loop与endLoop之间，拖回外层后位于endLoop之后；键盘上移完整循环保留内部步骤。连续选择循环和注释后生成动作组，9项组内原步骤/结束标记完整保留；拖组到自身槽位提示拒绝，JSON未变。已有10步JSON重新导入仍显示循环/分支；无页面横向溢出，画布单独滚动，控制台无error/warn。
- 从真实界面生成的 `artifacts/automation-block-program.json` 通过Release模块stdio的validate、schema2任务保存/重读，以及空bindings单次脚本执行。10个源步骤的三次循环/条件脚本最终completed、running=false、error=null、executed=21，模块正常shutdown。`artifacts/automation-block-program-runtime.json` 保存回复/日志；该测试仅等待和控制流，不执行窗口输入、截图或OCR。成组导出另存 `artifacts/automation-block-grouped-program.json`。
- 截图 `artifacts/automation-block-editor.png` 为浏览器编辑预览；不能替代游戏动作验收。工具页、窗口绑定、任务数据及70/30布局沿用，辅助截图/OCR子窗口没有改变。

TypeScript、Node27项、core7项、storage5项、依赖边界、fmt、workspace Clippy、Prettier与diff检查通过。前端149.5KiB/150KiB，没有新增框架/模型/网络依赖；Rust引擎和协议未变更。最终 `npm run tauri build -- --ci` 完成，Release/NSIS已更新，含单脚本运行时禁用成组的保护。安装向导未执行。

## 动作积木等宽布局 · 2026-09-30

按后续要求将桌面添加步骤/动作积木从70/30调整为50/50，列间距仍为24px，窗口绑定保留在左列；窄窗口上下排列规则不变。1280px浏览器预览实测两列均555.8px，页面scrollWidth与viewport均1280px，无横向溢出。重新导入既有循环/条件示例，嵌套积木正常展示，控制台无error/warn。截图 `artifacts/automation-blocks-equal-columns.png` 为浏览器布局证据。

Node27项、core7项、storage5项、依赖边界、fmt及workspace Clippy通过；前端构建149.5KiB/150KiB。Prettier及diff检查通过，最终Release/NSIS构建完成，安装包已更新，未执行安装向导。本轮仅修改布局和说明，Rust执行与持久化格式不变。

## 上下布局与代码样式动作序列 · 2026-10-05

移除左右布局，改为顶部分类/操作/添加工具栏及参数，下方全宽序列。代码行使用行号、缩进线、括号/分号、固定语法和可编辑参数颜色；循环/条件/组折叠、全部展开/折叠及执行时展开祖先。折叠不改JSON，内部结构移动保留折叠状态，运行中仅查看折叠可用。复用原模型及Rust格式，不新增IPC或持久化字段。

- Node29项、core7项、storage5项、依赖边界、fmt及workspace Clippy通过。新增折叠状态不进入脚本/移动后保留与HTML压缩保护原文测试。前端139.9KiB/150KiB；只移除构建HTML缩进，没有增加预算。
- 浏览器真实UI导入既有10步循环/条件脚本，行号01–10；全部折叠/展开保持源脚本，修改等待100→120即时写回；折叠循环后键盘下移/上移完整容器，折叠状态保留；将500ms根动作指针拖入循环后位于endIf与endLoop之间。窗口管理展开新增窗口C成功。
- 生产构建页面实测上下位置：OCR成组参数4列各267.5px，添加区bottom959.95、序列top975.95，间距16px，两区全宽；640px预览参数单列494px，页面无横向溢出。单个/成组OCR坐标及宽高控件保留，本轮没有执行实际OCR。
- `tests/fixtures/automation-code-editor.html` 使用生产编辑器模拟运行状态：输入全部禁用，折叠仍可用；定位步骤2后两个祖先自动展开并高亮2。夹具明确无原生动作执行。
- 生产浏览器控制台无error/warn；截图 `artifacts/automation-code-editor.png` 展示代码及折叠预览。本轮浏览器证据不替代游戏输入/识别实机验收。

最终 `npm run tauri build -- --ci` 成功，Release及NSIS安装包已更新，未执行安装向导，未停止用户现有客户端/开发服务。

## 任务/添加两列与参数点击跳页修复 · 2026-10-05

任务区与添加区置于同一grid的上方两列，动作序列跨两列。1280px预览两块top均224px、宽均559.8px、间距16px，序列宽1135.6px；640px退回单列，参数单列494px，页面scrollWidth=viewport=640，无横向溢出。截图 `artifacts/automation-task-composer-columns.png` 展示并排布局及编辑后的草稿。

原始页面打开自动化后点击初始注释的内容输入框，复现automation-dialog.hidden=true且工具箱0个工具。initCatalog在初始动作已创建后，对全局[data-category]注册点击，误将动作div的comment/input分类当作目录筛选；输入点击冒泡触发showTools。修复将分类监听及状态渲染约束为button[data-category]。

`node --test tests/catalog-events.test.mjs` 在修复前精确断言失败（tools而非automation），修复后通过；测试实际initCatalog事件绑定、输入到动作父行的点击冒泡，以及正常分类按钮继续筛选。完整Node30项通过，core7项、storage5项、依赖边界、fmt、workspace Clippy及前端构建140.2KiB/150KiB通过。

浏览器回验原始内容/等待输入框：点击后仍在自动化且工具计数2；修改注释及等待650ms即时写回JSON。分类仍显示2个通用工具，搜索不存在工具显示0，清除后恢复；标签返回自动化保持编辑草稿。控制台无error/warn。本轮未执行窗口输入或OCR，原生协议与存储格式不变。

Prettier及diff检查通过；最终Release/NSIS构建成功，安装包已更新，安装向导未执行。

## 自动化新手引导与界面整理 · 2026-10-08

保留任务/动作两列及全宽代码区，增加可收起的三步说明、常用动作入口、逐动作填写提示、窗口选择提示、秒数换算与中文任务状态。文件操作和JSON默认折叠。首次进入及新建任务为空序列，检查/运行在空序列时禁用；不改变Rust执行器、IPC、持久化版本和已有保存文件。

浏览器实际交互验证：新建“入门练习”，2000毫秒立即显示2秒，草稿行名称同步；添加等待1000并直接改成1500，JSON同步且停留在自动化页。点击/按键/等待/OCR快捷入口正确同步分类、参数和帮助；未绑定提示展开窗口选择并聚焦，新建窗口后提示正确指向窗口C。返回工具箱再切回保留参数、名称及草稿。控制台无error。高级文件区默认收起。

1280px任务和添加面板均559.8px且同一top，序列1135.6px；640px OCR表单及面板自动单列，document.scrollWidth=640、main.scrollWidth=clientWidth=560。任务选择夹具中6行列表可视高172px、滚动高352px，保持3行局部滚动；价格识别间隔改为3500，切换任务再回来显示3.5秒，动作和窗口B保留；新建得到空steps且原5个保存任务仍在。夹具只使用内存数据，不执行原生输入。

30项Node测试、core7项、storage5项、依赖边界、cargo fmt和workspace Clippy通过。最终Tauri Release/NSIS构建成功，前端149.7KiB/150KiB；引擎仍为engine-11ff5ce6902579ca.exe。安装包在target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe。未执行安装向导，未停止用户客户端或开发服务。本轮原生输入/OCR执行未重新验收。

截图：artifacts/automation-beginner-overview.png、artifacts/automation-beginner-sequence.png。浏览器预览中的原生按钮按原有规则禁用，不代表桌面运行效果。

## 首次选择与自然语言步骤回验 · 2026-10-08

在上一轮基础上改为首次选择才展开表单、默认自然语言步骤和按需修改，原代码显示留作可选视图。删除重复顶部文字引导及已弃用内嵌截图CSS。32项Node测试通过（新增时间摘要不改变原值、目标窗口/预等待说明、功能键/箭头/未知键码显示），core7项、storage5项、边界检查、fmt、workspace Clippy、TypeScript、Prettier和diff检查通过。

真实浏览器交互：首次进入六个常用意图入口均未选中，参数表单不可见；一键等待示例得到ms=1000。展开本步修改并填写1.5，摘要立即显示1.5秒、JSON为1500且仍在自动化页。添加区填写0.25秒新增ms=250。步骤/代码视图来回切换保留1250毫秒、循环开始延时25、内部延时50、结束延时75、目标B及Ctrl+A，循环仍保持折叠。OCR仅展示窗口、识别方式、截图框选及测试入口；坐标、变量与附加设置默认折叠。控制台无error。

640px预览六个入口两列，每项239px；页面宽度640、main clientWidth=scrollWidth=560，无横向溢出。截图artifacts/automation-intent-first.png和artifacts/automation-readable-steps.png。界面截图为浏览器预览，不是原生输入/OCR验收。

Release与NSIS重新构建成功，安装包target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe已更新，未执行安装。引擎仍为engine-11ff5ce6902579ca.exe。本轮前端152.9KiB；按ADR-015审查后预算由150调整为155KiB，无新增依赖和后台任务。原生OCR、截图和真实输入未重测。

## 窗口标签与 OCR 选区窗口调整 · 2026-10-08

窗口标签内删除、末尾 ＋、软件选择框右侧刷新已实现，移除重复绑定提示。OCR 识别方式移到独立截图窗口标题旁，切换清空旧选区；会话只允许 OCR 截图请求切换 region/regionPair。截图和 OCR 结果窗口使用深色自定义标题栏，权限增量限于自身的最小化、最大化/还原与拖动。

检查：32项Node测试通过；core7项、storage5项通过；宿主auxiliary两项Rust测试通过，覆盖双框完整性、范围和未经允许的模式切换（取点/结果窗口不得转为框选）；依赖边界、fmt、workspace Clippy、TypeScript、Prettier、diff检查通过。原生引擎仍为engine-11ff5ce6902579ca.exe。

浏览器主界面验证：新增C后删除非当前B，当前槽位/动作目标保持C；删除C回到A且唯一剩余标签禁止删除；动作组内部引用B时删除B被阻止，脚本仍保留。加号与最后标签间距8px，刷新在软件下拉框右侧，主页面无旧绑定提示和识别方式下拉。

辅助窗口测试夹具验证：单区域切A/B后，一个框时确认禁用，第二框完成后启用；两个区域分别显示A/B。切回单区域后两框清除且确认禁用，可重新选择。截图换算得到A(72,92,117,39)、B(222,92,118,39)。主界面和子窗口夹具控制台无error/warn。截图见artifacts/automation-window-controls.png和artifacts/ocr-region-mode-header.png。夹具只用合成图像，不调用截图/OCR引擎。

最终Release/NSIS打包成功，前端154.8KiB/155KiB；安装包target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe为2,505,075字节，未执行安装。真实桌面标题栏拖动/最小化/最大化、真实截图及主子窗口回填仍需桌面验收；本次证据为浏览器交互、宿主协议测试和完整构建，不能等同原生端到端验收。未停止用户客户端或开发服务。

## 脚本操作栏平铺 · 2026-10-08

仅调整 index.html 和相关 CSS：去掉“脚本文件与高级设置”的外层折叠入口，保留说明、脚本名称、已保存脚本、打开、保存、导入、导出、JSON 编辑与结果变量。名称和文件操作合并为单行，空间不足时在工具栏内横向滚动；JSON 独立折叠保持原状，结果变量 details 默认 open。

浏览器验证六个工具栏项目中心线一致；外层容器为 DIV，结果变量 open=true。通过键盘编辑脚本名后 JSON name 同步，仍在自动化页；控制台无error/warn。截图artifacts/automation-script-toolbar.png。原生保存、导入、导出逻辑未更改，本次未操作用户磁盘脚本。

32项Node测试、core7项、storage5项、边界检查、fmt、workspace Clippy和前端构建通过，前端154.9KiB/155KiB。无新增依赖、IPC或持久化格式调整。

本轮 Release/NSIS 安装包构建成功，target/release/bundle/nsis/moligod_0.1.0_x64-setup.exe 已更新，未执行安装。

## 原位插入动作与未完成红框 · 2026-10-13

移除独立的“想让电脑做什么”卡片区；空序列、动作前后和容器内部的插入入口均打开分类菜单。点击动作立即插入当前槽位，自动展开该行设置；修改即时同步JSON，收起设置不会删除未完成动作。目标窗口未选择/绑定失效、区域未配置时显示红框和具体缺失项；等待不依赖窗口。既有代码视图、分组、折叠和按键排序保留。共享配置面板在重绘前收回，嵌套插入待DOM挂载后才展开，旧取点/模板/截图回复检查归属，不能写入别的行。

验证通过：36项Node测试（新增4项覆盖窗口+区域分阶段补全、A/B完整性、坐标0合法而默认未选择、模板/按键/等待校验和未完成草稿的移动/分组/JSON往返）；core7项、storage5项；依赖边界、cargo fmt、workspace Clippy、TypeScript、修改文件Prettier及git diff检查。最终前端构建158.5KiB/160KiB；预算调整的范围和理由见ADR-017。

浏览器实际交互：OCR选中即生成一行并展开配置；在其前面插入等待后顺序正确；手填200×80后只保留窗口缺失提示。清空等待值时aria-invalid=true，恢复1.5秒后为false。代码视图将1.5改为2，返回后摘要与JSON一致。循环内部插入0.25秒等待、折叠并切换两种视图后，JSON仍为loop/wait(ms=250)/endLoop。菜单取消不新增动作；旧卡片数量0，共享配置面板数量1。1280px浏览器中main的clientWidth与scrollWidth均1200，无横向溢出；小屏断点样式保留，本次没有实际窄屏回验。嵌套插入过程中发现的提前访问未挂载DOM错误已修复，修复后回验无新增error/warn。

截图：artifacts/automation-inline-insert.jpg、artifacts/automation-insert-menu.jpg。窗口绑定有效后去除OCR红框由纯函数测试覆盖；浏览器没有真实系统窗口，未把模拟绑定当作原生验收。真实窗口选择、截图/OCR回填、运行及原生保存未在本轮执行；未修改IPC/Tauri/Rust或安装包，没有停止用户现有客户端。未完成项留在前端草稿，原生保存/执行仍通过原有严格校验。

## 动作同行配置与任务工具栏 · 2026-10-13

根据后续截图反馈，动作参数不再展开到标题下方：当前动作标题、软件选择、目标窗口与设置按钮在同一行；窗口管理、坐标、更多设置采用小浮层。任务操作、名称/间隔、任务列表在横向工具栏中分组排列。保留未配置红框、即时同步、代码视图及原生窗口绑定入口。

浏览器验证：1280px页面中三组工具栏顶部均为238.8px，X分别118.8/376.4/705.2px，工具栏高134px；激活窗口编辑行高55.6px。main的clientWidth/scrollWidth均1200，无横向页面溢出。新建窗口C立即回填当前动作target；前延时250即时写入JSON。OCR的200×80手动区域与目标B正确保存，区域提示消失，未绑定软件的窗口提示与红框继续保留；OCR编辑行66px（含行内滚动条）。浮层第二次点击正常收起、打开不增加行高；切换动作关闭旧浮层。任务名称“窗口切换”与2000毫秒同步显示为草稿/间隔2秒。控制台无error/warn。

36项Node测试、core7项、storage5项、依赖边界、fmt、workspace Clippy、TypeScript及前端构建通过；清理旧样式后仍满足160KiB预算，未提升预算。Prettier和diff检查见本轮命令结果。截图artifacts/automation-compact-row-ribbon.jpg。此轮为浏览器交互与静态/单元检查；真实系统窗口绑定、截图/OCR执行、安装包未重新验收或打包，没有修改原生代码或用户保存任务。

## 动作菜单样式与任务说明清理 · 2026-10-13

删除任务栏“一轮动作做完后，等待 5 秒再开始下一轮。”及对应动态提示逻辑，保留间隔输入、校验与任务配置。插入菜单改为紧凑深色双列按钮、轻量关闭按钮，保留分类、悬停与键盘焦点；弹出位置按实际尺寸计算。归档行为经源代码确认：先停止任务，再将 JSON 移到 tasks/trash，界面目前没有恢复入口；本次没有执行归档或更改保存的任务。

浏览器验证：基础菜单宽300px、高141.6px，动作按钮高36px、背景rgb(37,45,55)。点击关闭与Escape均不新增动作；切换识别分类后点“读取屏幕文字”即时插入一行，缺窗口/区域红框保留。等待说明不存在，输入2500毫秒后仍正确保留。控制台无error/warn。截图artifacts/automation-action-menu-polish.jpg。

36项Node测试、core7项与storage5项、依赖边界、fmt、workspace Clippy、Prettier、diff检查及前端构建通过，保持160KiB预算。此轮只修改前端，没有重新打包桌面安装包；真实窗口选择及原生任务执行不在本轮浏览器验证范围。

## 脚本文件与结果面板整理 · 2026-10-13

底部脚本管理和识别结果改为两个常显面板，宽屏左右排列、1000px以下上下排列；删除高级JSON编辑入口、批量成组按钮和无用途的步骤勾选框，保留既有组动作兼容。无结果时显示说明文字。脚本文本移到局部状态，名称输入即时同步；成功导入后更新提示，避免保留上次导入错误。

浏览器验证：默认显示两个面板，无JSON入口和选择动作复选框；等待2.5秒正确导出ms=2500。有效脚本导入后恢复该动作；schemaVersion=999导入被拒绝，原动作保留。编辑脚本名称后导出内容与输入一致。控制台无error/warn，截图artifacts/automation-script-panels.jpg。真实原生任务保存/打开和执行未在浏览器验收，没有重新打包安装包或修改用户现有任务。

36项Node测试、core7项及storage5项、依赖边界、fmt、workspace Clippy、Prettier、diff检查及前端构建通过，最终159.1KiB/160KiB。原运行锁测试移除已经删除的批量成组调用，继续验证运行期间拒绝插入；组结构往返/拖动兼容测试保留。

## 动作设置另起一行 · 2026-10-13

根据最新截图反馈，点击修改后保留第一行完整步骤摘要、问题提示及排序/删除按钮，共享设置栏在其下独占一行；设置内容仍横向排列，宽度不足时仅设置栏滚动。完成后收起，未配置红框保持。只调整布局和展开时的摘要呈现，不更改动作数据或原生调用。

浏览器验证OCR动作完成→修改→选择窗口A：摘要底部404.85px，设置栏顶部415.6px，设置栏宽1050.8px，确实在标题下方；红框rgb(229,117,117)，main宽度与scrollWidth均1200px。控制台无error/warn。截图artifacts/automation-settings-second-row.jpg。36项Node测试、core7项、storage5项、边界检查、fmt、workspace Clippy、Prettier、diff检查及构建通过，158.7KiB/160KiB。未重新打包安装包，真实窗口绑定与执行未在本轮验收。

## 复杂动作弹窗与简单动作直接修改 · 2026-10-14

复杂动作（窗口、鼠标键盘、OCR等）点击修改后打开设置弹窗；等待、注释、循环等1–2项常用设置的动作直接行内编辑。保留即时同步、未完成红框及原窗口管理/坐标/更多设置浮层。共用同一个表单，不复制控件或数据；关闭时回收至隐藏宿主，恢复原行展开状态及焦点。

浏览器验证：OCR插入后弹窗打开，配置target=A、区域200×80；完成关闭后区域问题消失，仅剩未绑定窗口提示。关闭按钮和Esc均能返回列表并恢复修改按钮焦点；重新打开后A及200×80仍保留。等待2.5秒完成后再点修改，modal=false、表单位于原步骤、值仍为2.5；切回OCR正常显示弹窗。控制台无error/warn。截图artifacts/automation-action-settings-dialog.jpg。

36项Node测试、core7项、storage5项、依赖边界、fmt、workspace Clippy、Prettier、diff检查及前端构建通过，159.8KiB/160KiB。未修改原生代码、保存的任务或安装包。浏览器无法验证真实窗口绑定、辅助截图窗口与modal的原生组合交互，这部分仍需桌面端验收。

## 按需动作面板 · 2026-10-14

插入动作入口改为左分类/右动作的浮动面板，取消分类下拉框与双列卡片。六个分类直接可见，动作以紧凑列表展示；会话内记住上次选择分类。仅点击插入位置时显示，选择动作立即插入该位置并关闭，Esc、关闭按钮和点击面板外沿用Popover关闭行为，不占页面固定布局。既有复杂设置弹窗与简单动作行内编辑保留。

浏览器验证：鼠标键盘分类通过Esc关闭，步骤数不变；重新打开保留该分类。Enter切换到识别截图后选择OCR，正确插到原等待动作之前，并打开设置弹窗。点击截图确认的面板外空白处后菜单关闭，仍为2步；控制台无error/warn。一次测试点击了被浮层覆盖的底层标题，实际命中OCR动作，已清理该临时测试动作并按可见空白处重新验证。截图artifacts/automation-action-palette.jpg。

36项Node测试、core7项与storage5项、边界检查、fmt、workspace Clippy、Prettier、diff检查及前端构建通过，仍满足160KiB预算。未重新打包安装包，未操作用户保存的原生任务。

## 顶部任务与脚本面板重排 · 2026-10-15

- 任务区改为两行：操作/名称/间隔在上，任务列表在下；脚本文件和识别结果移到顶部右侧，动作序列独占下方。1200px以下上下排列，700px以下脚本与结果也上下排列。保留所有原控件ID和读写事件，不改IPC或持久化数据。
- 浏览器1920px检查三块顶部面板和下方步骤；新增等待、修改任务名、完成行内设置成功。1000px与700px检查页面无横向溢出，控制台无警告/错误。截图：artifacts/automation-top-panels.jpg。
- npm test 36项、test:core 12项、check:boundaries、cargo fmt、workspace clippy、build均通过；前端160.0KiB未超过160KiB。清理被覆盖/隐藏的旧样式，未增加预算。
- 只验证浏览器布局与本地检查；桌面任务保存/运行未实测，未重新打包安装包。

## 统一任务面板 · 2026-10-15

- 合并任务与脚本文件区域，移除独立脚本名称/保存脚本按钮。任务名称同步脚本名称；保存任务继续保存名称、间隔和全部动作。导入/导出保持schema1兼容，旧脚本可通过折叠入口载入为新任务。
- 浏览器验证：任务改名“合并面板验证”，导出的JSON名称一致且等待动作1000ms保留；新建后再导入恢复名称与动作并显示新任务草稿；schema999文件报错且保留当前内容。旧脚本入口可展开，700px无页面横向溢出，控制台无错误/警告。截图artifacts/automation-unified-tasks.jpg。
- npm test 36项、test:core 12项、check:boundaries、cargo fmt、workspace clippy及build通过，159.7KiB/160KiB预算。未操作原生已保存任务/旧脚本，桌面读写及执行未实测，未重新打包。

## 任务行内名称与间隔 · 2026-10-15

- 将唯一的任务名称/间隔输入移到当前选中任务行，默认呈现无边框文字，点击或Tab即可编辑；删除上方重复表单。状态重绘复用输入节点并恢复焦点/文本光标，切换任务继续使用既有草稿。
- 新建和导入草稿的间隔默认1000ms；新建名称依据会话已用名称、已保存任务及草稿避重，按新任务、新任务1、新任务2递增。已保存任务读取原间隔，不改持久化格式。
- 浏览器验证初始新任务/1000ms、改名与2500ms在插入步骤后保留；连续新建得到新任务1/2/3且均1000ms；连续键入不丢焦点，Tab进入间隔。1720px和700px无页面横向溢出，控制台无警告/错误。截图artifacts/automation-inline-task-fields.jpg。
- npm test 36项、test:core 12项、boundaries、fmt、clippy、build通过，160.0KiB未超过预算。桌面保存/任务状态事件未实测，未重新打包。

## 工具栏同排与窗口下限 · 2026-10-15

- 导入、导出、载入已有脚本移到任务操作按钮右侧；标题独占首行，任务列表仍在下方。
- 按用户后续修订，以刚调整的1094×800为基准，高度减少四分之一、宽度增加三分之一，主窗口默认及最小尺寸设为1459×600。只影响主窗口，不改截图辅助窗口。
- 浏览器1459×600确认新建和导入按钮top一致，页面scrollWidth等于1459，无横向溢出。截图artifacts/automation-toolbar-minimum.jpg。npm test 36项、test:core 12项、boundaries、fmt、clippy与前端构建通过，159.9KiB/160KiB。未进行原生拖动尺寸验收。
- 最终1459×600配置的桌面Release编译通过（tauri build --no-bundle），产物target/release/moligod.exe；未生成NSIS安装包。

## 按参考图设置窗口尺寸 · 2026-10-15

- 读取用户PNG文件头确认图片1600×900；将主窗口默认和最小宽高均设为1600×900，替代上一版1459×600。不修改辅助窗口。
- 前端构建159.9KiB/160KiB、依赖边界、Rust fmt和Clippy通过；未进行原生窗口拖动验收。尺寸使用Tauri逻辑像素，系统缩放下实际物理像素可能不同。
- 桌面Release编译通过：target/release/moligod.exe（tauri build --no-bundle），未生成安装包。

## 已有脚本直接展示 · 2026-10-15

- 去掉“载入已有脚本”的details/summary折叠入口，将已有脚本选择框和载入为新任务按钮直接放在工具栏，保留原ID和事件；移除折叠入口样式。
- npm test 36项、check:boundaries、前端build通过；本次仅HTML/CSS调整，未重新编译桌面程序或进行原生界面验收。
- 同日后续移除下拉框上方“已有脚本”可见文字，保留aria-label供辅助技术识别；前端构建通过。

## DPI窗口尺寸修正 · 2026-10-15

- 修正上一版逻辑像素与物理像素混用：主窗口setup使用PhysicalSize(1600,900)设置最小尺寸及初始尺寸，完成后显示。核对本地Tauri/tao实现，物理尺寸约束保留为物理单位。
- 前端build、boundaries、cargo fmt和workspace clippy通过。原生窗口实测及跨DPI显示器拖动尚未验收；之前仅配置1600×900并不代表真实窗口尺寸已验证。
- 修正后的桌面Release程序编译通过：target/release/moligod.exe（无安装包）；需要完全退出旧进程后启动新版验证。

## 任务列表操作入口 · 2026-10-16

- 名称和间隔之间增加竖向分隔，两个输入各带可点击的铅笔label，点击聚焦对应输入。
- 新建入口改为列表标题行右侧＋；保存/删除移入当前选中任务行右侧，重绘前收回同一组按钮，保留原事件与当前任务保存/归档逻辑。删除已保存任务仍为归档，未增加永久删除。
- npm test 36项、test:core 12项、boundaries、fmt、clippy与前端构建通过（159.9KiB/160KiB）。本轮浏览器工具不可用，未进行界面与原生读写验收，未重新编译安装包。

## 任务输入框常显 · 2026-10-16

- 移除名称/间隔旁的铅笔label；输入框以低对比边框和背景常显，聚焦保留强调色边框。新建＋按钮缩为26×26。
- 前端build通过，159.8KiB/160KiB；本次仅HTML/CSS微调，未进行界面实测或重新打包。
- 同日去掉任务行selected状态的绿色边框和背景，保留选中任务行为及普通深色样式；前端构建通过（159.7KiB）。

## 各任务行常显操作按钮 · 2026-10-16

- 每行均生成保存、删除、运行、停止按钮，不再只在选中行显示保存/删除；无效操作置灰。状态文字保留。删除仍为本地归档。
- 保存读取点击行对应的编辑草稿或已保存任务；未选中行保存/归档不切换当前编辑任务。移除共享按钮及其DOM搬移。
- 新增轻量DOM/后端替身回归测试，验证所有行四按钮常显、未保存任务运行禁用、未选中行保存名称/间隔/ID正确、运行/停止/删除均使用该行ID且保留当前草稿。npm test 37项、test:core 12项、boundaries、fmt、clippy和build通过（159.2KiB）。未做原生界面验收或重新打包。

## 全局浮动提醒 · 2026-10-16

- 自动化message改为注入全局notify，移除页面内automation-notice。全局原生manual popover在顶部居中展示白底成功/错误提示，最多3条，成功4秒/错误8秒自动关闭，也可点击关闭；textContent写入消息。
- 当前源码未残留旧auto-task-save/delete查找；新增自动化控件ID对照HTML回归检查，覆盖disabled赋值所用控件，避免按钮迁移后空元素引用。截图报错未在当前原生运行中复现，不宣称已定位截图版本的调用栈。
- 新增提醒堆叠/关闭/旧计时器不隐藏新提醒测试。npm test 39项、test:core 12项、boundaries、fmt、clippy、Prettier与前端build通过（159.6KiB）。未实测桌面浮层显示效果。
- 包含最新控件调整和全局提醒的桌面Release构建通过：target/release/moligod.exe，未生成安装包。

## 任务行重绘空引用修复 · 2026-10-16

- 定位截图reading value异常：paint将共享输入移入尚未挂入document的新任务行，随后生成按钮aria-label时再通过getElementById读取名称，得到null。改为paint开始时捕获名称，不在节点离线期间查询。
- 修正回归测试的DOM替身：getElementById仅返回连接到文档树的节点。旧实现该测试失败，修复后39项Node测试通过；弥补之前仅按ID映射返回离线节点导致的漏测。前端构建159.6KiB通过，原生窗口运行效果未实测。
- 修复版桌面Release编译通过（target/release/moligod.exe）；test:core、boundaries、fmt、clippy通过。

## 首次打开不选中任务 · 2026-10-16

- selectedId区分null（未选择）与空字符串（新建草稿）。初始化仅展示已有任务，不自动建立草稿或读取某个任务；点击任务、＋或导入后进入编辑，未选择时隐藏步骤编辑区。
- 移除任务行idle对应“未运行”文字，保留未保存、其他运行状态及错误。首个新建名称从新任务开始，间隔1000ms。
- 回归测试覆盖初始化无选择/无task-load/无额外草稿、未运行文字隐藏、点击＋进入编辑及既有行操作隔离。39项Node测试、前端build、boundaries通过；未实测原生界面，未重新打包。

## 导入入口与逐行导出 · 2026-10-16

- 删除顶部脚本工具栏及已保存脚本选择/载入入口和对应查询监听；保留原本磁盘文件。导入按钮移到任务列表右上角＋左侧，仍导入schema1为新任务草稿。
- 任务行去掉未保存/运行状态/错误的摘要文字；保留名称、间隔、操作按钮及原有变量日志详情。每行保存前增加导出按钮，选中行导出即时草稿，未选中行优先导出该行草稿，否则读取对应任务脚本；不切换选中任务。导出仍是单个动作脚本schema1，不含任务间隔。
- 回归测试验证已保存未选中行与当前未保存草稿导出名称正确且不切换编辑对象；旧控件ID引用检查通过。39项Node测试、boundaries、前端build通过（158.6KiB）。未进行原生导入导出界面验收，未重新打包。

## 统一右侧运行结果 · 2026-10-16

- 删除任务行内变量/日志折叠区，右侧统一显示状态、执行步数、错误、识别变量及最近20条日志；动作序列下方auto-log移至右侧。
- 选中任务、任务状态事件和刷新均更新右侧；其他任务事件不覆盖选中任务。新建/导入清空旧结果。独立序列执行仍可展示结果，已选中任务的结果优先；不把任务状态写入独立序列执行锁。
- 回归测试覆盖选中任务结果、当前任务事件更新、未选中事件隔离、新建清空及独立运行回退标记；39项Node测试、test:core、boundaries、fmt、clippy与前端build通过（158.4KiB）。未实测原生界面或重新打包。

## 任务入口文案与顺序 · 2026-10-16

- 列表右上角按钮依次改为“新建任务”“导入任务”，新建按钮取消固定方形尺寸，统一使用紧凑文字按钮间距；保留原有事件与导入行为。
- 前端build通过（158.4KiB）；未实测原生界面或重新打包。

## 任务标题合并到列表工具行 · 2026-10-16

- 将“我的任务”移到任务数量左侧，删除独占标题行与编号装饰；移除原标题和列表间的分隔线及上方间距，新建/导入仍在同一行右侧。
- 前端build通过（158.4KiB）；未实测原生界面或重新打包。

## 任务列表标题行留白 · 2026-10-16

- 标题工具行增加上8px、下12px内边距，拉开与任务列表的距离，保持文字和按钮垂直居中。
- 前端build通过（158.4KiB）；未实测原生界面或重新打包。

## 全局提醒深色样式 · 2026-10-16

- 全局提醒改为深灰背景、浅色文字、6px圆角与柔和阴影，文字13px、图标16px；成功用浅绿、错误用浅红。保留顶部居中、自动消失及点击关闭行为。
- 前端build通过（158.5KiB）；未实测原生界面或重新打包。

## 关闭自动化标签清空选择 · 2026-10-16

- 关闭标签原本触发release，但任务管理器的selectedId仍保留。close事件现在保存当前草稿、清空选中任务和右侧结果并隐藏步骤区；递增选择版本，使尚未返回的任务加载不能恢复旧选择。普通页面切换不清空选择。
- 39项Node测试通过，新增关闭后刷新保持无选中、重新选择可恢复草稿的验证；boundaries和前端build通过（158.6KiB）。未实测原生关闭/重开或重新打包。

## 右侧常驻动作库 · 2026-10-16

- 插入动作分类和选项由浮层移至步骤区右侧310px面板，左侧保留视图/运行工具与步骤；窄于1100px时改为上下排列。保留点击插入位置后选择动作的机制，未指定时沿用末尾插入。
- 移除菜单popover开关和定位代码，运行中禁用动作选项，分类切换也保持禁用状态。
- 39项Node测试、boundaries、前端build通过（158.5KiB）；未实测原生布局或重新打包。

## 任务与编辑区空状态 · 2026-10-16

- 空任务列表提示“暂无任务，请先创建任务或导入任务”；未选中时下方显示独立占位区，有任务提示打开任务，无任务提示创建或导入。选中任务后隐藏占位并显示编辑区，保留草稿也计入可打开任务。
- 回归验证空列表提示和任务存在标记；39项Node测试、boundaries、前端build通过（159.2KiB）。未实测原生界面或重新打包。

## 精简步骤区说明 · 2026-10-16

- 删除步骤区编号、标题、步数与说明行，移除空步骤区的“先添加一个等待1秒”按钮；保留动作库与插入入口，视图按钮右对齐。同步删除auto-step-count代码引用。
- 39项Node测试与前端build通过（159.8KiB）；未实测原生界面或重新打包。

## 删除步骤区执行按钮 · 2026-10-16

- 删除检查动作、运行当前序列、停止按钮及对应事件、控件状态引用和无用hasActions变量；保留任务行运行/停止与动作输入校验。
- 39项Node测试、boundaries与前端build通过（158.1KiB），包含控件ID有效性检查；未实测原生界面或重新打包。

## 步骤区状态条与插入入口 · 2026-10-16

- 删除步骤区运行状态条及对应DOM更新和样式；右侧运行结果不变。空步骤列表先渲染插入入口，再渲染空状态说明，使添加步骤入口位于顶部。
- 39项Node测试与前端build通过（157.6KiB）；未实测原生界面或重新打包。

## 空状态视觉层次 · 2026-10-16

- 任务列表空状态添加浅绿加号图标、独立标题与辅助说明；编辑区添加步骤图标、独立动态标题/说明和低对比度渐变背景。装饰图标对辅助技术隐藏，保留原有无任务/未选择状态切换。
- 39项Node测试和前端build通过（158.6KiB）；未实测原生视觉效果或重新打包。

## 移除空步骤说明 · 2026-10-16

- 删除“还没有要执行的步骤”及其辅助说明和闲置样式，保留顶部添加步骤入口；任务列表及未选择任务的空状态不变。
- 前端build通过（158.0KiB）；未实测原生界面或重新打包。

## 快捷键提示并入工具行 · 2026-10-16

- 紧急停止快捷键提示移到代码视图/展开/折叠按钮同一行左侧，移除原独立说明行及“运行会操作目标窗口”文字；工具行下方保留14px间距。
- 前端build通过（158.1KiB）；未实测原生布局或重新打包。

## 顺序执行的设置窗口动作 · 2026-10-16

- 新增setWindow动作，基础操作中可选择软件标题及目标代号；后续动作使用该代号，再次设置可切换绑定。设置不激活窗口。绑定标题随schema1脚本/schema2任务保存，不保存临时句柄。
- 引擎在实际执行路径上解析唯一标题并写入当前任务局部Bindings，每轮清空动态槽位；缺失/重复标题或未执行设置就使用该槽位时拒绝输入。旧无setWindow脚本仍走原静态绑定接口。编辑预览按文本顺序查找之前的设置，不模拟条件分支。
- 41项Node测试通过，新增草稿完整性/往返/前后绑定及分组场景；自动化Rust15项测试通过，新增重复运行顺序切换、动态绑定隔离、条件跳过/未来设置不能使用旧绑定、找不到窗口失败。固定旧任务兼容测试通过。
- test:core 12项、boundaries、fmt、全workspace clippy通过；前端build159.3KiB通过。Release自动化模块与桌面程序构建成功，输出target/release/moligod.exe（no-bundle，无安装器）。未执行真实软件窗口切换或原生编辑UI验收，当前已打开的进程未重启。

## 移除管理窗口 · 2026-10-16

- 删除管理窗口入口、代号标签及新增/删除控件和对应事件/样式；目标窗口下拉直接提供A–Z代号，无需先创建代号。设置窗口动作仍按选择的软件与代号保存，现有任务数据不变。
- 41项Node测试和前端build通过（156.4KiB）；未实测原生界面或重新打包桌面程序。

## 等待参数同行展示 · 2026-10-16

- 等待动作将执行前等待输入移到主要参数区域，与等待秒数同行，隐藏更多设置入口；切换到其他动作时归还原附加参数容器，沿用原字段和保存逻辑。
- 41项Node测试和前端build通过（156.5KiB）；未实测原生界面或重新打包。

## 目标窗口按需新增与数字名称 · 2026-10-16

- 默认提供窗口1，下拉末尾新增“＋ 新建窗口”，点击分配下一个可用代号并自动选择；新任务恢复单个默认代号，已有任务按引用恢复代号。下拉、代码字段和步骤摘要统一显示窗口1/2/3，内部仍沿用A–Z以兼容原任务及引擎，达到26个后不再显示新增入口。
- 41项Node测试通过，摘要预期更新为数字显示；前端build通过。未实测原生下拉交互或重新打包。

## 等待动作仅保留时长 · 2026-10-16

- 等待动作只显示等待秒数与完成按钮，移除其前延时输入，代码视图也不重复展示。已有前延时合并为总秒数显示/编辑与摘要；底层保留原schema1字段，极限旧数据按原3600000ms等待加60000ms前延时容量表示，不丢失总时长。其他动作的前延时设置不变。
- 42项Node测试通过，覆盖旧前延时合并、上界时长及再次缩短不重复叠加；前端build通过。未实测原生界面或重新打包。

## 等待标题行直接编辑 · 2026-10-16

- 步骤视图等待动作在“第N步·等待[秒数]秒”中直接放置数字输入框，不展示修改按钮或下方设置行；新插入等待步骤直接聚焦该输入框。输入即时写入脚本，代码视图字段同步，运行锁继续禁用输入。
- 42项Node测试和前端build通过（157.8KiB附近）；未实测原生界面或重新打包。

## 输入焦点与参数标签、移除前延时设置 · 2026-10-16

- 等待行内数字输入取消绿色外轮廓，改为原边框轻微变亮。设置窗口摘要将目标代号和软件标题渲染为蓝灰色参数标签，标题通过textContent写入。
- 移除共享设置中的auto-delay及所有动作代码字段中的前延时/随机前延时输入；没有其他附加参数的动作隐藏更多设置。保留旧脚本延时数据的读取与执行语义，不自动删除持久化数据；新增动作仍使用零前延时。
- 42项Node测试及前端build通过（158.1KiB），包括移除控件引用校验；未实测原生视觉效果或重新打包。

## 步骤行紧凑间距与操作按钮 · 2026-10-16

- 上移/下移/删除按钮增至30px点击区域、17px字号，按钮间隔4px；步骤视图行上下内边距由12px缩至6px，左右不变。
- 前端build通过（158.3KiB）；未实测原生视觉效果或重新打包。

## 插入位置取消常驻高亮 · 2026-10-16

- 删除block-insertion常驻背景、文字高亮及下边线，所有插入位置默认样式统一；保留鼠标悬停、键盘焦点及拖放落点反馈。步骤视图交互时固定24px高度，避免悬停跳动。内部插入位置逻辑不变。
- 前端build通过；未实测原生界面或重新打包。

## 分组与备注同行编辑、统一输入焦点 · 2026-10-16

- 分组名称和备注内容改为标题行内输入，复用等待动作的即时更新/代码字段同步机制；不再出现修改按钮及下方配置行，分组子步骤与折叠行为不变。
- 主界面所有输入框、文本域和选择框取消绿色焦点外轮廓，使用中性灰蓝边框提示焦点；任务输入框也移除绿色聚焦边框，按钮键盘焦点保留。
- 42项Node测试和前端build通过（158.8KiB）；未实测原生交互或重新打包。

## 取消代码视图入口 · 2026-10-16

- 删除代码视图按钮、监听和无调用的setSimple切换方法，固定使用步骤视图；保留全部展开/折叠及现有动作编辑。
- 42项Node测试与前端build通过；未实测原生界面或重新打包。

## 移除步骤上下移动按钮 · 2026-10-16

- 删除每步右侧上移/下移按钮，保留删除、拖动排序及原有键盘排序；同步精简底部排序说明。
- 42项Node测试与前端build通过；未实测原生界面或重新打包。

## 设置窗口与激活窗口同行选择 · 2026-10-16

- 设置窗口动作改为步骤行内两个下拉框：目标窗口代号、软件窗口；激活窗口动作改为行内目标窗口下拉框，均不再打开配置弹窗。
- 目标窗口保留新建窗口入口，软件列表提供手动刷新并保留当前未找到的已存标题；修改即时写入动作，运行时禁用。避免选择框input冒泡提前重置选择值。
- 42项Node测试通过；前端build通过（159.3KiB/160KiB）。未实测原生界面交互或重新打包桌面程序。

## 激活窗口文案调整 · 2026-10-16

- 动作菜单与名称统一改为“切到前台”，步骤行显示“将[窗口下拉框]切到前台”，摘要同步；保留focus动作标识与执行行为。
- 前端build通过（159.3KiB/160KiB）；未重新打包桌面程序。

## 分组与备注视觉区分 · 2026-10-16

- 分组使用透明标题栏和底部分隔线，保留子步骤缩进与连接线；备注使用低对比暖色底和左侧色线。
- 两者行内文本框默认透明，悬停或编辑时显示边框与底色；编辑、拖动和执行逻辑不变。删除已无引用的参数标签样式。
- 前端build通过（159.9KiB/160KiB）；未实测桌面视觉效果或重新打包。

## 动作附属注解与取消交互 · 2026-10-16

- 动作删除按钮旁增加注解按钮，点击在动作下方展开11px单行输入，与插入动作字号一致。内容即时写入步骤annotation字段，随动作移动、分组、保存与导出保留；原有独立备注兼容。
- 未输入内容失焦自动收起；清空内容立即删除annotation并收起。注解行独立×只删除注解，不删除动作；运行锁覆盖输入与按钮。
- 43项Node测试、16项自动化Rust测试、7项core及5项storage测试通过。新增嵌套注解往返及旧步骤字段保持不变的序列化测试。boundaries、fmt、clippy和前端build通过（160.9KiB/162KiB），git diff --check通过。
- 未实测桌面鼠标编辑、失焦和删除交互。
- 桌面release构建通过：target/release/moligod.exe，包含新版注解字段支持的automation引擎；未启动或重启现有应用。

## 注解分隔线 · 2026-10-16

- 注解输入左侧增加2px灰蓝竖线、底部增加1px淡虚线，保持11px字号与删除入口。
- 前端build通过（161.0KiB/162KiB）；未实测桌面视觉效果或重新打包。

## 插入入口按需显示 · 2026-10-16

- 每个步骤列表（包括分组内）只常显末尾插入入口，中间及开头入口默认透明，鼠标悬停、键盘焦点或拖动落点时显示。保留24px命中区域，避免悬停导致布局跳动；空列表仍显示添加入口。
- 前端build通过（161.0KiB/162KiB）；未实测桌面交互或重新打包。

## 收紧隐藏插入位置的占位 · 2026-10-16

- 修正上一轮只隐藏文字却保留24px空白的问题：中间和开头插入入口默认仅6px高，取消最小高度并裁剪溢出；悬停、键盘焦点和拖放时展开，末尾入口保持显示。
- 前端build通过（161.1KiB/162KiB）；未实测桌面效果或重新打包。

## 注释文字与线条弱化 · 2026-10-16

- 注释沿用11px小字，文字颜色与插入动作统一为#8b9d76；左线由2px实线改为1px淡灰蓝虚线，保留底部虚线。
- 前端build通过（161.1KiB/162KiB）；未实测桌面效果或重新打包。

## 移除动作标题步骤编号 · 2026-10-16

- 删除动作标题及悬停摘要中的“第X步”前缀，涵盖等待、分组、备注、窗口下拉框及其他动作。清理仅用于显示编号的计数器，执行索引与运行高亮保持不变。
- 前端build通过（161.0KiB/162KiB）；未实测桌面效果或重新打包。

## 窗口切换名称 · 2026-10-16

- 动作名称改为“窗口切换”，行内显示“窗口切换：[窗口下拉框]”，摘要同步。帮助文字仍解释切到前台的实际行为。
- 前端build通过；未重新打包桌面程序。

## 移除独立备注动作入口 · 2026-10-16

- 从动作选项移除comment，分类动作库由该选项生成，不再提供独立备注动作。保留旧任务中comment的读取编辑兼容及动作附属注解按钮。
- 前端build通过；未重新打包桌面程序。

## 开发引擎落后导致setWindow拒绝 · 2026-10-16

- 现场进程为target/debug/moligod.exe，自动化子进程来自bundled-modules/dev/automation/engine-61613f9747205a6c.exe；此前release构建不刷新dev目录，导致新前端提交setWindow时旧引擎报unknown variant。
- npm run modules:dev成功，开发manifest更新为engine-3b08ea0ed81459cc.exe。新增IPC冒烟校验setWindow/focus及annotation的组合，仅validate不执行窗口操作；automation_smoke通过，数据位于临时目录。
- 未强制终止用户应用或引擎；无任务运行时关闭自动化助手标签触发release/shutdown，再打开按新manifest启动引擎。当前UI切换后的加载仍待用户确认。

## 动作未配置仅显示红框 · 2026-10-16

- 删除动作行中的校验说明文本及对应样式，保留block-incomplete红色边框和aria-invalid，原有参数校验不变。
- 前端build通过（160.8KiB/162KiB）；未重新打包桌面程序。

## 窗口切换等待时间修正 · 2026-10-16

- 用户报告“无法激活目标窗口”。检查发现focus仅在SetForegroundWindow后等待30ms便判失败。改为最多1秒、每20ms可取消的前台确认；每次复核HWND/PID，未切成功仍终止输入，不发送辅助按键或提升权限。
- 这修复了过短确认窗口，不证明本次故障唯一根因；Windows前台切换限制仍可能拒绝请求。参考https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow 。
- 16项automation测试、workspace clippy通过，开发引擎构建成功并更新manifest。未自动操作用户目标窗口，实际切换仍需现场复测。

## 任务循环与间隔开关 · 2026-10-16

- 每个任务可勾选循环；新建默认不勾选，间隔输入禁用，运行强制一次且interval_ms=0。循环时repeats=0并使用任务间隔。旧任务缺loop字段保留原循环行为；保存后下次运行生效。
- 草稿切换、保存、行摘要及导出脚本repeats同步开关；导入无限循环脚本恢复勾选。有效间隔在关闭循环时保留，禁用状态下无效值保存回默认1000。
- 43项前端测试、17项自动化测试通过；新增单次完成不等待60秒间隔、循环持续等待及停止的运行测试，兼容旧字段与持久化开关测试。clippy、boundaries及前端build通过（162.4KiB/164KiB），dev与release引擎均更新。未实测桌面勾选交互。
- 桌面release构建通过：target/release/moligod.exe。现有开发进程未强制重启，需停止任务后关闭并重开自动化助手以加载新版开发引擎。

## 循环位置与运行按钮合并 · 2026-10-16

- 循环勾选移到选中任务的导出按钮左侧，同一行排列；运行与停止合成一个根据running状态切换的按钮，保留停止后从头运行语义。
- 修复共享checkbox移入临时行后无法通过document查询的问题：渲染前保存控件引用。任务行交互测试通过，覆盖运行/停止状态切换及草稿保留；前端build通过（162.5KiB/164KiB）。未重新打包或实测桌面视觉效果。
- 现场旧进程为engine-c4859716c2de3513.exe，dev manifest已是engine-52c78d4cf7f04bdc.exe，unknown field loop来自未卸载旧引擎；需停止任务后关闭并重开自动化助手，未强制终止用户进程。

## 循环按钮与默认关闭 · 2026-10-16

- 复选框替换为导出左侧的循环按钮，与任务操作共用按钮高度；开启高亮并启用间隔，关闭恢复普通按钮并禁用间隔。
- 新建默认关闭，前后端缺失loop字段也默认false；已显式保存的开启值保留。共享按钮移动使用提前保存引用，避免行渲染期间控件查询失败。
- 43项前端测试、17项自动化Rust测试、前端build和clippy通过；dev引擎已更新。未实测桌面视觉效果，未重新打包主程序。

## 保存时自动恢复旧循环引擎 · 2026-10-16

- 再次确认现场仍运行engine-c4859716c2de3513.exe，dev manifest已为engine-7e2a532bc5b758fd.exe。
- task-save遇到精确unknown field `loop`错误时查询运行状态；有任务运行则保留草稿并提示先停止，没有任务运行时调用已有release/open后仅重试保存一次。复用同一id及原始payload，不删loop字段、不降级丢失设置。原生release仍会检查legacy运行状态，避免终止活跃执行。
- 43项前端测试及build通过（162.8KiB/164KiB）；测试模拟旧引擎拒绝、release/open、相同payload重试及草稿保留。实际UI再次保存后的进程切换待确认，未强制终止用户进程或重新打包主程序。

## QQ窗口切换与主程序权限交接 · 2026-10-16

- 用户确认目标为QQ，1秒前台等待后仍失败。源码发现主程序点击运行与子引擎执行之间缺少AllowSetForegroundWindow交接，已补充仅授予活跃引擎PID的best-effort调用；并非已证明QQ失败的唯一原因。
- 17项自动化测试、1项module-host测试、clippy及boundaries通过；主程序release构建中。未对QQ执行真实窗口切换，运行权限/窗口响应仍待现场验收。改动涉及主程序，旧主进程无法仅靠前端热更新获得修复。
- 后续：桌面release构建成功，产物target/release/moligod.exe；未代用户重启或实测QQ切换。

## 鼠标操作统一入口与配置 · 2026-10-16

- 动作库合并点击/拖动/滚动为“鼠标操作”入口，按键与输入文本保持独立；同一设置弹窗用操作类型下拉选择三种鼠标操作，并按类型显示现有参数。
- 切换保留target与起点坐标、兼容的鼠标按键，其他类型专属字段使用各自默认值并删除不适用字段；步骤注解和延时保留，同类型选择不重置。旧脚本仍使用click/drag/scroll原格式，未修改原生协议。
- 44项前端测试通过，覆盖类型转换、字段清理及元数据保留；build（163.7KiB/164KiB）、boundaries、diff检查通过。未实测桌面弹窗或重新打包。

## 鼠标设置与截图同界面 · 2026-10-16

- 鼠标操作设置中默认展示截图区，目标已绑定时自动加载；点击设置位置，拖动设置起终点，滚动也可在图上选位置。提供刷新截图、位置标记和坐标反馈，完成按钮位于截图下方。旧截图选点/拖动取点入口在鼠标界面隐藏，区域与OCR工作流不变。
- 缩略图坐标按返回的原始物理尺寸转换，越界指针钳制到图内；保留拖动方向。请求代次与编辑对象共同校验，关闭或切换目标使旧请求失效；运行锁和pointercancel防止误写。
- 46项Node测试通过，覆盖缩放/边界钳制、反向拖动及点击/滚动参数写回；前端build通过（167.2KiB/168KiB），boundaries及diff检查通过。未实测桌面截图加载/鼠标拖选，未重新打包主程序。

## 鼠标操作类型切换复用截图 · 2026-10-16

- 操作类型切换不再清空预览或发起capture，仅更新交互模式、提示和坐标标记，取消未完成的拖动；正在加载的同目标截图仍可用于新类型。
- 初次打开自动加载，目标切换及刷新截图按钮仍重新截图；关闭和换目标继续使旧请求失效。
- 47项Node测试通过，新增预览组件测试验证类型切换不增加capture调用、加载期间换类型、手动刷新及关闭后拒绝旧结果。前端build通过（167.2KiB/168KiB），未实测桌面或重新打包。

## 鼠标设置顶部工具栏与参数展开 · 2026-10-16

- 鼠标操作标题右侧同排展示刷新截图和完成，坐标及更多设置在参数区直接展开，不再通过popover打开；非鼠标动作仍保留原配置方式。
- 清理已被截图选点替代的隐藏拖动取点按钮及监听；切换回其他动作时恢复popover属性和完成按钮位置，关闭时仅对有效popover调用hidePopover。
- 47项前端测试通过；前端build通过（167.5KiB/168KiB），未实测桌面布局或重新打包。

## 截图显示不全修复 · 2026-10-17

- 鼠标预览请求改用原生fullWindow，截图时读取当前物理客户区尺寸，修复窗口放大后仍使用绑定时缓存范围导致的裁切风险；固定900×600缩略图改为等比缩小，避免失真。
- 新增宽屏、竖屏、小图尺寸及右下角像素保留测试。18项自动化Rust测试、47项前端测试、clippy、fmt、boundaries通过；前端build通过（167.5KiB/168KiB），dev引擎已更新。
- 未对用户当前窗口做真实截图验收；旧引擎需关闭并重开助手后加载新manifest。
- 桌面release构建完成：target/release/moligod.exe，包含完整窗口预览的新引擎。

## 旧截图引擎缺少区域自动恢复 · 2026-10-17

- 现场运行engine-7e2a532bc5b758fd.exe，dev manifest已经指向支持fullWindow的engine-df4a77a5b7498693.exe，确认本次缺少区域来自旧引擎。
- 全窗口preview收到缺少区域时查询独立运行及任务状态；仅空闲时release/open并重试一次，编辑草稿和参数不变。关闭编辑页不重开引擎，切换动作后不重试旧动作；现有请求代次继续丢弃过期画面。不降级使用旧尺寸区域。
- 47项现有前端测试及build通过（167.8KiB/168KiB）；实际刷新后的进程切换仍待验收，未重新打包主程序。

## 2026-10-17 鼠标参数第二行、模式选择与测试动作

- 浏览器实测：点击、拖动、滚动切换后第一行包含类型/目标/前后台模式，第二行参数横排。拖动X/Y/终点X/终点Y/时长的输入框实测y均为358px，后台模式切换类型后保留。临时草稿未保存，浏览器执行按钮正确禁用。截图target/mouse-settings-preview.png。
- npm test：48通过；automation Rust：21通过；core/storage：7+5通过。新增旧动作默认前台、后台mode往返、模式跨类型保留，以及本机隐藏Win32测试窗口接收右键/滚轮消息、滚轮屏幕坐标、拖动取消释放、取消后不再发送输入测试。
- npm run check:boundaries、npm run build（169.4/171KiB）、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings通过。后台测试窗口未获得前台焦点；不代表QQ或游戏已响应后台鼠标消息。
- 原生test-action只接受鼠标动作且构建一次执行脚本，复用stop与紧急停止；现有任务运行时拒绝测试。桌面按钮全链路及QQ前后台点击仍待实际客户端验收；浏览器验证不替代原生验收。引擎与宿主均改变，需要重新启动更新后的客户端才能使用新接口，未关闭用户正在运行的实例或丢弃草稿。
- 补充原生IPC验证：使用独立临时数据目录和自建隐藏测试窗口启动新版dev引擎，test-action拒绝wait，后台click状态最终completed且executed=1，shutdown正常退出。未操作用户QQ窗口。npm run modules:dev与npm run tauri -- build --no-bundle均通过，桌面产物target/release/moligod.exe。

## 2026-10-17 移除鼠标截图操作提示

移除截图成功后的点击/拖动说明与选点后重复坐标文字，坐标仍显示于第二行输入框，画布保留选点标记；加载、未绑定及失败状态仍有反馈。坐标换算按每次事件的当前DOM矩形映射到截图原始像素，不依赖固定devicePixelRatio。增加100%/125%/150%/200%显示尺寸换算测试；这是数学映射验证，未在多显示器实机验证。原生截图及输入使用per-monitor-v2上下文。已存动作仍使用绝对客户区像素，目标软件跨屏DPI变化导致内容布局改变时，不会自动重新定位目标控件，需要刷新截图并重新选点。
验证结果：npm test 49项通过，npm run build通过（169.2/171KiB），check:boundaries通过；仅前端改动，本次未重新打包桌面EXE。

## 2026-10-17 脚本统一缩放与直接软件目标

- 脚本顶层第一项“缩放”百分比，缺失/null旧文件保留未知语义；导入确认修改全脚本坐标及基准，取消不改脚本。嵌套分组、OCR区域、鼠标起终点换算测试通过，时长/滚轮量/注解不变，同基准不重复缩放。
- 52项Node测试、24项automation测试、core/storage共12项通过。tsc/build及边界检查通过；前端173.0/174KiB。fmt与workspace clippy通过。
- 新目标window:标题替代UI槽位绑定；动作库移除setWindow，旧A–Z与setWindow仍可读取执行。标题缺失/重名均拒绝，不持久化HWND。直接目标摘要测试及序列化测试通过。
- 原生独立IPC验证：创建仅供本次验证的屏外不激活Per-Monitor V2窗口，空bindings加直接标题即可运行；本机查询缩放125%，源脚本250%，原坐标(120,160)实际接收WM_LBUTTONDOWN坐标(60,80)，执行1步完成。改成不存在的标题后正确报错，shutdown正常；临时数据及窗口已清理，未操作QQ。
- 排查发现DPI不感知窗口在接收消息时会有Windows逻辑坐标虚拟化，不应直接用其逻辑坐标作为物理像素验收。窗口缩放读取统一per-monitor-v2上下文并查询所在显示器有效DPI，避免命令线程与输入线程DPI上下文不同产生不一致。截图过程中DPI变化拒绝提交，要求刷新。
- 未验证真实双屏拖动、QQ/游戏内部布局改变或模板匹配素材随DPI缩放。执行适配使用源数据临时副本，磁盘只在用户保存时更新；布局重排/不同软件版本不属于简单缩放可保证范围。新版宿主与引擎需一起重启使用，未强制关闭用户实例。
- 浏览器实际检查：基础动作仅等待/窗口切换/动作分组，没有设置窗口入口；新建窗口切换显示“选择软件窗口”和刷新列表，不再显示窗口1或新建槽位。浏览器未连接原生窗口枚举，软件列表及执行由上述原生IPC测试另行验证。截图target/direct-window-preview.png。
- 最终新版dev引擎及release桌面构建均通过，最终release引擎engine-291eee00fc69c315.exe，桌面产物target/release/moligod.exe；包含直接软件目标、显示器缩放读取及前端统一缩放逻辑。
2026-10-17：按截图将鼠标设置首行调整为目标窗口、操作类型、操作模式；仅移动HTML节点，前端构建通过，未重新打包桌面EXE。

## 行内键盘与可选目标 · 2026-10-17

前台点击/后台点击显示改为前台操作/后台操作。按键与文本直接在动作行编辑，默认省略target，窗口下拉可恢复“当前前台窗口（不切换）”；显式选择继续激活后输入。Rust Key/Text兼容旧目标且允许省略；按键与文本都检查输入中失焦并保留取消及释放。

验证：53项Node测试、25项自动化Rust测试、7项核心+5项存储测试通过；边界、cargo fmt、workspace all-targets Clippy通过。构建前端174.1KiB/175KiB。浏览器预览实际添加两个动作，无弹窗，录入Ctrl+A与中文文本，摘要即时更新且默认不选窗口；截图target/inline-keyboard-preview.png。未向QQ或用户实际窗口发送键盘输入，真实软件输入仍待验收。
桌面release重新构建成功：target/release/moligod.exe；开发引擎engine-820f471aa5001eec.exe、release引擎engine-446c0ec3218a23c9.exe。未重启用户正在使用的程序。

## OCR 选区与测试合并 · 2026-10-17

OCR设置默认加载完整截图，同窗框选单区域或A/B区域，右上方提供测试区域OCR、刷新截图、完成，结果以内联文字显示。坐标/更多设置直接展开；保留现有缩放换算和过期请求隔离。其他图像匹配/保存截图辅助窗不变。

54项Node测试、核心7项/存储5项、边界、fmt、workspace all-targets Clippy通过；前端176.9KiB/178KiB。截图回归覆盖反向框选、零面积不提交、A/B独立更新、模式切换不重新抓图。浏览器实际打开OCR并切到双区域，确认只有一个设置窗、参数直接显示、无第二选区弹窗。浏览器无原生目标窗口，未将此验证视为桌面截图/OCR识别验收。
桌面release构建成功：target/release/moligod.exe。布局截图：target/ocr-inline-preview.png（浏览器无目标窗口）。未重启用户程序。

## 日志固定面板 · 2026-10-19
删除运行结果标题与状态摘要，改为识别日志/执行日志tab切换，共用260px固定高面板，输出内部滚动；执行错误保留在执行输出中，不再截断为20行。54项Node测试、前端build（177.8/178KiB）、边界检查通过。浏览器实际点击执行日志，确认对应输出显示且DOM测量面板高度260px。无原生或IPC改动。
桌面release构建成功：target/release/moligod.exe；预览截图target/log-tabs-preview.png。

## 滚动方向与次数 · 2026-10-19

滚动设置改为“滚动方向：”向下/向上与“滚动次数：”1至10次下拉，每次120单位，默认向下1次。摘要同步显示方向和次数；旧脚本沿用delta，非整格值在设置中保留原值选项，打开不自动取整，不改变原生发送方式。

验证：54项Node测试、核心7项/存储5项测试、边界检查、cargo fmt、workspace all-targets Clippy通过；前端构建178.5KiB/179KiB。浏览器实际选择向上2次，完成后摘要正确，重新打开仍为向上2次；向下10次选项正常。浏览器预览未执行原生滚轮或验证目标软件响应。截图target/scroll-controls-preview.png。未修改或保存用户任务，未关闭运行中的客户端。
桌面release构建成功：target/release/moligod.exe；未自动重启用户客户端。

## 鼠标操作使用说明 · 2026-10-19

按用户提供文字，在鼠标操作标题右侧、测试/刷新/完成按钮左侧增加使用说明及后台模式提示。文字为12px次要色，标题与说明间隔24px，空间不足自然换行；点击、拖动和滚动共用，其他动作不添加。仅改前端说明及样式。

54项Node测试、依赖边界、前端构建（178.9/179KiB）通过。浏览器1280px预览核对说明完整显示、与标题及右侧按钮无重叠，截图target/mouse-usage-preview.png。未触发原生鼠标输入，未保存用户任务或重启用户客户端。
最终样式对应的桌面release构建成功：target/release/moligod.exe。

## 键盘操作命名与目标选择布局 · 2026-10-19

动作库及行内“按键 / 组合键”改为“键盘操作”。键盘及输入文本的目标窗口标签和下拉移至各自参数末尾，宽度从210px改为105px；窗口切换、按键录入、输入文本和目标保存逻辑不变。

54项Node测试、依赖边界、前端构建（低于179KiB预算）通过。浏览器创建两条临时动作，确认名称已更新；DOM实测两条下拉宽度均105px，均为参数容器最后元素。截图target/keyboard-target-layout.png；未保存用户任务或执行原生输入。
桌面release构建成功：target/release/moligod.exe；未自动重启用户客户端。

## 四种识别截图动作统一面板 · 2026-10-19
动作库合并为识别/截图入口，面板类型可切换OCR、A/B OCR、图像匹配、保存截图；后两者复用内嵌截图选区，不再需要辅助选区窗。转换保留公共目标与区域，清除不兼容字段。55项Node测试通过，build179.6/180KiB、边界检查通过。浏览器实际切换图像匹配显示模板/阈值、保存截图显示图片名称，均保持同一面板。原生窗口识别/截图实际效果未在浏览器验收。
桌面release构建成功：target/release/moligod.exe。预览截图target/recognition-panel-preview.png。

## 双区域简化与独立变量 · 2026-10-20
隐藏识别截图的X/Y/宽高和区域B参数，删除A/B下拉，画布按A、B顺序轮换并标记字母；只接受非零区域。双区域显示独立A/B保存变量，默认result_A/result_B；原生成组结果兼容保留，同时发布两个文本变量。55项Node、25项automation、7项core、5项storage通过；边界/fmt/Clippy通过，build180.5/182KiB。模拟指针回归验证A/B/A轮换和截图不刷新；执行器回归核对两个文本结果及旧setFromOcr仍可用。浏览器确认数字坐标/区域选择下拉已隐藏，独立变量可编辑。未在浏览器中验证原生OCR识别。截图target/ocr-pair-simple-preview.png。
桌面release构建通过：target/release/moligod.exe；开发引擎engine-a1ff26c2cdaa4f0d.exe，release引擎engine-28669d1b32a78cca.exe。

## 正则移入条件判断 · 2026-10-20
移除动作库取成组OCR值和正则匹配，保留旧脚本运行。if/elseIf的判断方式可选正则，分别填写匹配变量与规则，复用expression字段保存 =~ 条件。规则预编译验证，支持布尔短路组合。56项Node测试、27项自动化Rust、7项核心与5项存储通过；边界/fmt/Clippy通过，build182.0/182KiB。引擎回归实际执行正则if分支；表达式测试覆盖匹配/不匹配/无效规则/缺失变量/转义/短路。浏览器验证入口移除、条件编辑与关闭重开回显。截图target/if-regex-preview.png。
桌面release构建通过：target/release/moligod.exe；开发引擎engine-db033b923a100392.exe、release引擎engine-d3925c3fd7098237.exe。

## 取消模板文件选择保留设置窗 · 2026-10-20

原因：input[type=file]取消事件冒泡到settingsDialog，其cancel监听器无条件调用finishSetup。改为仅处理event.target为settingsDialog本身的取消，子输入的cancel不触发设置关闭或清空编辑状态。新增测试提取真实注册回调，修复前文件取消用例失败（closed=1），修复后通过；同时验证弹窗自身取消仍preventDefault并关闭一次。58项Node测试、前端build、边界检查通过。为维持182KiB原预算，仅将过时的“请先选择已设置的目标窗口”缩为“请先选择目标窗口”。测试覆盖事件处理层；未通过原生文件窗口实际点击取消验收。
桌面release构建通过：target/release/moligod.exe。未重启用户程序。

## 截图保存位置按钮 · 2026-10-20

在图片名称旁新增修改保存位置，主程序原生文件夹选择器返回绝对路径，取消返回null且保留动作/弹窗；路径存到Capture.directory并由引擎实际选择输出目录，缺失保留默认captures。60项Node测试（含选择成功/取消/旧请求不覆盖新动作）、28项automation、核心7/存储5通过。边界/fmt/Clippy通过，前端182.7/183KiB。Rust回归覆盖自选与默认目录、绝对路径校验、旧动作和新增路径序列化。浏览器确认按钮布局；浏览器不支持原生文件夹选择，尚未实际点击原生选择器并验证截图文件写入。预览target/capture-directory-preview.png。
桌面release构建通过：target/release/moligod.exe；开发引擎engine-d28a2d5f13d07eef.exe，release引擎engine-8adedf511da8f5c2.exe。

## 模板选择第二行 · 2026-10-20
图像匹配的模板按钮和文件名整块独占参数第二行；第一行保留目标窗口、结果变量、匹配阈值。长文件名省略显示，不再挤压第一行。仅HTML/CSS布局变化，npm build通过183.0/183KiB。浏览器测量第一行bottom346、模板行top365，确认独立第二行。截图target/template-second-row-preview.png。
桌面release构建通过：target/release/moligod.exe。

## 保存位置文字居中 · 2026-10-20
将auto-capture-path的grid自对齐改为center，与修改保存位置按钮垂直居中。仅CSS改动，npm build通过183.0/183KiB。浏览器测量按钮和文字中心均为352px。预览target/capture-path-aligned-preview.png。
桌面release构建通过：target/release/moligod.exe。

## 弹窗关闭按钮对齐 · 2026-10-20
鼠标及识别截图的X进入标题工具栏最右侧，与完成按钮共用垂直中线。非可视设置归还dialog，关闭监听保持不变。60项Node测试、npm build通过183.1/184KiB。浏览器测量完成与X中心均299px，并点击X确认关闭设置、动作仍保留。截图target/dialog-close-aligned-preview.png。
桌面release构建通过：target/release/moligod.exe。

## 变量保存标签 · 2026-10-20
设置变量与计算变量中的结果名称（变量名）改为结果保存为，其他动作标签保留。仅前端文案，npm build通过183.3/184KiB。核对执行器：If条件假跳到否则分支或结束继续；Assert条件假返回断言失败并停止。
桌面release构建通过：target/release/moligod.exe。

## 条件分支卡片样式 · 2026-10-20
否则如果和否则改为IF相同的卡片边框/背景/摘要/右侧工具。ElseIf使用共享条件设置（含正则），完成后回显当前条件；Else只保留摘要与删除。原分支顺序与内部步骤序列化保持不变。60项Node、前端build184.1/185KiB、边界检查通过。浏览器建立三个分支并修改ElseIf正则，关闭编辑后摘要正常显示。截图target/condition-branch-cards-preview.png。
最终Tauri桌面release构建通过：target/release/moligod.exe，包含分支编辑后摘要回显修正。

## 条件分支缩进 · 2026-10-20
ElseIf/Else增加独立分支内容容器，复用分组的32px外边距、12px内边距和左竖线，分支内部步骤继续缩进。没有改变BlockPath、执行顺序或持久化数据。60项Node测试、npm build通过184.2/185KiB。浏览器测量主IF左边265.6、分支卡片310.4、分支内部stack342.4（另含12px内边距），层级符合分组样式。截图target/condition-branch-indent-preview.png。
桌面release构建通过：target/release/moligod.exe。

## 简单动作第一行编辑 · 2026-10-20
IF/ElseIf、断言、循环、设置变量、计算变量、标签/跳转的编辑区加入标题所在行，紧凑控件宽度避免两个输入框挤出完成按钮；结束编辑恢复摘要。break/continue不再展开只有完成按钮的空设置区，并隐藏修改入口。60项Node测试、边界和前端build通过184.9/185KiB。浏览器核对IF与表达式中线一致、循环标题与次数中线一致，断言内容宽度等于可见宽度（448px，无横向溢出），跳出循环添加后没有完成按钮。截图target/compact-action-rows-preview.png。
桌面release构建通过：target/release/moligod.exe。

## 简单动作输入框常驻 · 2026-10-20
简单动作各自渲染行内参数，创建即显示，输入直接更新对应Step；不再点击修改或完成，支持多行同时编辑。IF/ElseIf保留表达式/正则方式及独立变量规则控件，沿用同一表达式格式；设置变量的值保留JSON/文本解析。无效数字输入即时标红。60项Node测试、build187.2/188KiB、边界通过。浏览器同时编辑IF与断言，再添加分支和循环，确认内容保留；循环清空标红后改为5，再添加变量动作，值仍为5。界面修改按钮数量0且完成按钮不可见。截图target/persistent-inline-actions-preview.png。
桌面release构建通过：target/release/moligod.exe。

## PP-OCRv6 small/tiny 离线接入 · 2026-10-21

- 官方模型来源见modules/ocr/models.lock.json：四个PaddlePaddle ONNX仓库固定commit，模型SHA256下载校验；各自inference.yml提供字典/DB参数。旧.reference只有v5，未修改或作为新运行时依赖。独立CPU worker打包含Python/ORT，无系统语言包依赖；关闭ORT遥测，运行时不下载模型。资源约212.7MiB。新增runtime源码指纹，修改源码后未重新冻结会构建报错；CI显式安装锁定依赖/准备模型。
- 61项Node测试通过；包含默认small、切换双区域保留tiny、序列化往返、非法模型拒绝。core7/storage5，automation普通30通过+1项显式资源测试默认忽略；该资源测试已单独运行通过。依赖边界、cargo fmt和workspace全目标clippy -D warnings通过。前端build187.8/188KiB。
- 冻结worker实际识别tests/fixtures/ocr-bilingual.png，small/tiny均精确输出“中文识别测试 12345\nMOLIGOD 67890”；空白结果为空，不回旧文字。测试预先取消、加载中取消、识别取消后drop，OpenProcess/WaitForSingleObject验证退出回收。缓存键包含档位。
- cargo run -p moligod-automation --example native_smoke --locked -- --module-ocr-models通过：真实专用Windows EDIT测试窗口+WGC+模块IPC，small/tiny单/双区域测试、数字筛选均成功；正式脚本顺序执行small单区→tiny单区→tiny双区，small_result/tiny_result/left/right变量均包含12345。没有操作QQ或其他用户目标窗口。
- release同项验收通过（target/release/examples/native_smoke.exe --module-ocr-models --release-module）。10ms采样整个release测试进程树（测试窗口/模块/worker/conhost共6进程），采样峰值220.3MiB，记录target/ocr-release-tree-metrics.json。这不是完整Tauri/WebView2应用总占用。
- 冻结worker单独5次样本：small加载401ms、推理35–50ms、树采样峰值176.2MiB；tiny加载332ms、14–23ms、120.8MiB，关闭stdin正常退出。记录target/ocr-runtime-metrics.json；样本尺寸740×200，不能外推到整个游戏画面或低端CPU。
- 浏览器可视验证默认small、切换tiny后切换A/B模式仍保留，模型控件与目标窗口同一行。截图target/ocr-model-choice-preview.png。浏览器未执行原生OCR，原生证据来自上述真实模块测试。
- Tauri桌面release构建通过：target/release/moligod.exe，automation engine-4093a81c6c5d250b.exe。冻结worker更新后已同步dev、package、target/release/modules所有资源；未生成/安装NSIS，没有替换或重启用户当前客户端。真实QQ/游戏字体、DPI跨屏后的准确率与完整应用性能仍需现场验收。

## 全局OCR模型与CPU/GPU设备 · 2026-10-22

- “我的任务”标题行新增识别方式（CPU/GPU）和模型（small/tiny）下拉，移除OCR动作弹窗中的模型选择。单区域/A-B测试与所有任务统一使用模块ocr-settings.json，默认CPU+small。设置schema1、4KiB上限、原子保存/备份；不支持版本/坏数据不被覆盖，前端设置读取错误不阻止其他任务界面加载。驱动创建时快照配置；修改不改变正在运行中的快照，下一次运行/测试生效。旧每动作ocrModel仍能读取与往返，不再覆盖全局值，新动作不再生成该字段。
- CPU包换为锁定onnxruntime-directml 1.24.1，worker明确cpu/gpu参数、model/device握手与回包校验。GPU要求DmlExecutionProvider并关闭mem_pattern/并行执行/整会话回退；无法初始化时错误提示切CPU。CPU会话只请求CPU provider。不支持的单个算子可能由ORT放到CPU，不承诺GPU所有算子全在显卡上。
- Python故障路径3项通过：缺少DML不创建会话、CPU回退会话不能伪装GPU成功、CPU不初始化GPU；CI加入该检查。冻结worker四组合CPU/GPU×small/tiny均准确识别双语740×200样本。RTX5080上small CPU40/37ms、tiny CPU19/14ms；small GPU首轮1977ms/次轮33ms、tiny GPU466/19ms。GPU首轮含shader编译，不意味着小区域一定更快。结果target/ocr-global-device-tests.json。
- native_smoke --module-ocr-models --with-gpu（dev模块）通过，真实专用EDIT窗口WGC截图+IPC，四组合单区/双区/数字筛选成功；全局设置模块重开后恢复，正式脚本在存在旧每动作档位字段时仍使用全局选择并产出所有变量。release native_smoke --module-ocr-models --release-module --with-gpu同样通过。只操作专用测试窗口，没有输入到QQ/游戏。
- release测试整个进程树10ms采样，峰值435.8MiB，含fixture/自动化模块/worker/conhost共6进程。未包含Tauri/WebView2总占用或显存统计。记录target/ocr-global-release-tree.json。
- Node61通过；automation普通32通过、1资源测试默认忽略且已单独运行通过；core7/storage5、依赖边界、fmt、workspace全目标clippy -D warnings通过。前端188.7/190KiB。
- 浏览器确认标题旁GPU+tiny、添加OCR/打开关闭设置后保持，动作弹窗无模型框。截图target/global-ocr-settings-preview.png。浏览器验证只覆盖布局，配置落盘/原生识别由上述模块测试覆盖。
- 首次最终构建与release验证并行复制占用中的worker.exe导致EPERM；验证进程退出后顺序重新构建，不关闭用户客户端或任务。最终构建状态在下方补记。未执行安装/替换当前运行客户端；其他显卡/驱动与真实QQ字体仍待现场验收。
最终顺序构建通过：target/release/moligod.exe；automation engine-096ed27708d00d45.exe，CPU/DirectML worker在dev/package/release目录哈希一致。构建后以该release模块再次运行native_smoke --module-ocr-models --release-module --with-gpu通过。
# OCR 资源精简 · 2026-10-22

- 实际计量：原target/ocr-runtime为244.58MiB；精简后219.42MiB（未压缩），减少25.17MiB约10.3%。ONNX Runtime Python绑定/native DLL/DirectML合计约62.7MiB，四个模型约35.6MiB；开发venv、下载缓存、多份构建副本不等于最终交付体积。
- prepare-ocr.py重新冻结成功，只移除截图识别不使用的OpenCV FFmpeg视频插件；增加225MiB资源预算。开发、安装资源、release运行目录均219.42MiB，旧视频插件均已清除。保留CPU/GPU与small/tiny。
- npm test 61项、core/storage 12项、边界、前端构建188.7/190KiB、fmt、workspace/all-targets clippy全部通过。冻结worker双语/空白/取消/进程回收测试通过。
- 正式release模块native_smoke --module-ocr-models --release-module --with-gpu通过：CPU/GPU × small/tiny单/双区域、设置重启持久化、脚本结果变量；本机RTX5080，不代表所有显卡和游戏准确率。
- 此项只精简发布依赖，不是裁剪ORT算子、自编译ORT或移除Python；开发环境和用户数据未删除。未安装或重启用户客户端。
- npm run tauri -- build --no-bundle成功，更新target/release/moligod.exe及配套modules；没有生成或安装NSIS安装包。


## 2026-10-22 Rust 原生 OCR 与三后端迁移

本轮取代 Python/PyInstaller OCR。项目 OCR 可执行程序、DB/CTC 前后处理和 IPC 均为 Rust；底层仍为 ONNX Runtime/DirectML/TensorRT RTX 厂商原生 DLL，不称其为 Rust 实现。small/tiny 保留，全局 CPU/A卡/N卡分别映射 CPUExecutionProvider、DmlExecutionProvider、NvTensorRTRTXExecutionProvider；旧 gpu 设置迁移为 amd。缺少 AMD 适配器明确报错，不把整会话失败静默改成 CPU。

资源版本：CPU/DML ORT1.24.4、DirectML1.15.4；N卡 ORT1.26.0、RTX EP0.5.0、TensorRT RTX1.7、CUDA cudart13.2.51。原生下载与四个模型均校验固定 SHA256。无 Python 准备流程、运行时下载、启动推理或遥测。构建脚本拒绝 Python 文件并限制原生 OCR 资产450MiB。

- 删除 modules/ocr 的 worker.py、processors.py、test_worker.py、requirements.txt、__pycache__、scripts/prepare-ocr.py，以及 CI 的 Python/pip 步骤。明确路径逐项清理 target 下 ocr-build-env、ocr-package-env、ocr-freeze-build、ocr-frozen、worker.spec 和早期 CUDA wheel 解压缓存；第一次批量计算路径删除被工具策略拒绝，改为检查非链接的绝对路径、不使用 Force 的逐项删除后成功。
- 扫描 modules/ocr、dev/release/package 三份 OCR 资源、target/ocr-runtime、target/release/modules/automation/ocr-runtime：Python文件均0。独立 automation ZIP 共37项，Python/worker.exe/_internal条目0，manifest引擎SHA256核验通过。只读 .reference、历史决策文档及第三方开发工具源码没有做破坏性清理。
- 发现并复现 RTX 动态尺寸错误：固定图片有时空检测或空识别；禁用磁盘缓存不足以修复，因此没有将缓存猜测当作根因。最终固定 ONNX 输入维度，检测960×960、识别48×3200，保留原比例补边及坐标换算，关闭ORT图优化/memory pattern/磁盘缓存/CUDA图捕获。不同后端空格识别可能不同，回归比较保留汉字数字及换行、忽略空格。
- CPU 离线 small/tiny 中英文精确文本、空图、启动前取消、识别时取消、进程释放通过。新增 RTX 回归在 RTX5080/驱动616.56 上通过：两模型各重启2次，每次在双语图和100×100空图间往返2次，81.00秒完成，无残留OCR进程。
- release native_smoke --module-ocr-models --release-module --with-nvidia通过：真正专用 EDIT 窗口、WGC、ModuleClient、CPU/N卡×small/tiny单区/双区/数字筛选、全局设置重启恢复、正式脚本变量。测试窗口显式ShowWindow后也支持隐藏控制台启动；没有输入到QQ/游戏。
- DML诊断模式 small/tiny 双语图精确识别通过，profiling确认 DmlExecutionProvider 执行；small识别中有少量ORT分配的CPU算子。当前没有AMD显卡，A卡设备选择和实际硬件识别仍待AMD实机验收，不能把N卡上的DML测试称为A卡实测。
- 最终RTX profiling：small/tiny的det和rec均为NvTensorRTRTXExecutionProvider，未出现CPU推理节点。证据 target/ocr-final-profiles。release测试进程树48次采样，工作集采样峰值952.04MiB、Private峰值1098.16MiB，包含native_smoke/conhost/automation engine/moligod-ocr；不含Tauri/WebView主程序，不是独立显存测量。证据 target/native-rust-ocr-tree.json。固定补边存在内存和首次编译成本，尚未做与DML同负载的速度对比。
- OCR资源358.76MiB：DML目录34.22MiB、N卡目录286.86MiB、模型35.82MiB、许可1.22MiB及Rust程序。独立automation压缩包160.26MiB。不是“完整N卡运行时小于200MB”，也不把构建目录总量算安装大小。
- 通过：npm test（61）、npm run test:core（7+5）、依赖边界、npm run build（188.7KiB/190KiB）、Rust OCR单测4项、automation常规33项、module-host/protocol各1项、cargo fmt --all -- --check、全workspace Clippy -D warnings、modules:dev/build/package、Tauri release --no-bundle --ci。一次并行高负载下已有task_loop测试50ms固定等待断言失败，随后完整automation测试重跑通过，未改其产品代码。全仓npm run format:check仍报26个文件格式问题，包含大量本轮未改的编辑器/样式/测试文件；没有为本任务批量重排这些文件。
- 最终产物 target/release/moligod.exe；automation engine-2062a66ab87ee611.exe；module-packages/automation-0.1.0-windows-x86_64.zip。桌面已编译，未关闭/替换用户正在运行的开发实例；不把构建成功描述为全新Windows机器或所有游戏验收。

## 2026-10-23 移除未使用的 TensorRT 插件

- 按用户要求从 OCR 交付资源移除 48.91MiB 的 tensorrt_plugins.dll。prepare-ocr.ps1 从固定 RTX 压缩包仅复制 EP、核心和 ONNX parser，清除准备目录旧插件后重建 assets.json；build-modules.mjs 拒绝含该插件的源资源，并从每个受管理 OCR 目标目录精确删除旧副本。保留必需的 onnxruntime_providers_nv_tensorrt_rtx.dll、ORT、CUDA runtime、两档模型和许可证。
- 先用仍含旧插件的准备目录验证构建明确失败，再运行准备脚本、modules:dev、modules:package。检查六处 source/test/dev/release/package/desktop OCR 目录，插件均为0，逐处29项资产SHA256校验通过；旧目标目录中的真实副本已被构建流程删除。原始厂商下载缓存保留原始归档用于固定哈希验证，不作为交付资源。
- NVIDIA目录286.86→237.95MiB；release OCR资源310.04MiB；独立automation ZIP160.26→144.25MiB，共36项，插件和Python条目均0。ZIP内29项资产及manifest引擎SHA256核验通过。证据：target/ocr-plugin-removal-verification.json。
- 移除插件后的RTX5080实测通过：offline_rtx_models_survive_restarts_and_shape_changes，small/tiny各启动两次，每次双语740×200样本与100×100空图交替两轮；63.52秒通过，中英文/数字结果正确、空图返回空。证据：target/ocr-no-plugin-regression.log。前置隔离运行库验证及算子后端记录保留在target/ocr-plugin-probe-a48f63e9dce244d89b78b97fc6c5f563；不将当前版本结论推广到未来模型或RTX版本。
- 通过：Node61项、core/storage7+5、依赖边界、前端build188.7/190KiB、cargo fmt、workspace/all-targets Clippy -D warnings、PowerShell脚本语法、Node脚本语法，以及Tauri release --no-bundle --ci。更新target/release/moligod.exe、配套modules与独立模块ZIP；未生成NSIS安装包、未安装或重启当前客户端。AMD实机和全新Windows环境验收仍沿用上节未完成项。

### 剩余 NVIDIA 资源只读审计

237.95MiB由6个DLL组成：TensorRT核心218.6891MiB、ORT14.2078MiB、RTX EP2.2814MiB、ONNX parser2.2213MiB、cudart0.5294MiB、providers_shared0.0208MiB。dumpbin核对了直接及延迟导入；先前进程加载记录中CUDA走驱动目录的nvcudart_hybrid64.dll。核心、ORT、EP、parser均实际加载，当前ONNX加载流程需要保留。

在新建隔离目录省略cudart64_13.dll与onnxruntime_providers_shared.dll、PATH限制为Windows/System32和Windows后，small/tiny各识别双语样本两次均通过，stderr为空；det/rec profiling只有NvTensorRTRTXExecutionProvider事件，没有CPU推理节点。保留shared而单独省略cudart的两档模型也通过。证据target/ocr-runtime-trim-probe-21755ca34c7f4303ae8bb7295c306bc9/results.json与providers.json。合计只可省0.5502MiB，约237.40MiB；这是当前RTX5080/驱动环境证据，NVIDIA官方integration-guide仍将这两项列为发布依赖，其他支持驱动/设备尚未验证，因此本轮没有继续改正式资源或打包规则。

进一步精简ORT可研究其官方reduced-operator自定义构建，但需验证插件EP接口和现有ONNX模型加载，不能直接替换为只支持ORT格式的basic minimal build；实际可省大小未编译测量。该路径也不会缩小218.69MiB的TensorRT核心。

## 2026-10-23 本机游戏资料库与游戏展示

- 用户确认第一版为本机资料库。新增发现页、资料管理、游戏详情和资料编辑器：名称/简介/多行介绍、开发商/发行商/日期、平台/标签、封面/主视觉/最多6张截图，草稿保存、展示/撤回、编辑、删除、搜索/筛选/排序及整库导入导出。无预置假游戏、伪评分或下载/启动按钮；原工具箱、分类和自动化工作区继续可用。
- 数据schema1，最多100款/整库24MiB；仅PNG/JPEG/WebP内嵌图片，每张1.5MiB，上传/导入限制单边8192及1600万像素。Rust验证字段、版本、日期、图片MIME/文件头/base64及容量；浏览器侧进一步实际解码图片。导入预览新增/冲突数量，默认保留本机同ID记录，替换须显式勾选。损坏、未来版本及未知字段不会用默认值覆盖。
- 桌面通过src/api.ts调用受主窗口约束的IPC，写入AppData/Roaming/com.moligod.desktop/game-library.json，使用互斥、阻塞任务与原子替换，保存前保留.json.bak。浏览器预览单独使用IndexedDB并明确显示存储范围。没有新增网络服务、登录、统计、定时任务或启动原生工具。
- 自动检查通过：npm test 69项；npm run test:core为core12+storage9；npm run check:boundaries；cargo fmt --all -- --check；cargo clippy --workspace --all-targets --locked -- -D warnings；npm run build。前端235.9KiB/240KiB，预算调整理由见ADR-026。最终npm run tauri -- build --no-bundle --ci成功，产物target/release/moligod.exe，包含最终图片读取期间禁止关闭/保存的修复。
- 浏览器实际验收：空库创建测试游戏，上传用户提供的PNG参考图为封面及截图，保存展示、刷新恢复、多行介绍/详情/截图查看、搜索空结果、导出后重导入；同ID默认不覆盖本机新改的草稿且不产生重复。转草稿后从发现页隐藏。900×700编辑器无横向溢出（弹窗852px），1600×900展示正常；工具箱自动化页往返后工作区保留。控制台错误为空。浏览器测试条目已移除，原有侧栏偏好保留。
- 最终Windows release原生验收：通过文件选择器导入浏览器导出的测试JSON；检查实际文件包含1款、PNG封面、截图与换行；桌面“导出资料库”下载JSON与原资料ID/封面/介绍一致。转为草稿后主文件为draft，备份仍为published。退出并重新启动后，首页提示1份草稿，管理和详情正确恢复图片、文字及草稿状态。测试前原生游戏库不存在，验收后只把本次同ID单条测试主文件/备份移入target/game-library-native-qa.json及.bak，保留其他用户数据；settings.json SHA256前后相同。随后重新打开干净的新版首页。
- 证据：artifacts/game-library-home.png、game-library-detail.png为浏览器截图；artifacts/game-library-desktop-detail.png及game-library-desktop.png为桌面截图。target/game-library-ui-export.json、game-library-desktop-export.json和game-library-native-qa.json/.bak保留测试文件。
- release空库闲置进程树采样11.57秒，7个稳定进程（主程序+WebView2），Private212.10MiB、工作集431.02MiB，样本CPU增量0；工作集可能重复计共享页面，不能推断峰值或普遍零CPU。证据target/game-library-release-process-tree.json。未启动OCR/自动化引擎。尚未验收100款/24MiB满库性能、全新Windows环境或NSIS安装；没有实现云同步、社区、游戏下载或启动。

## 2026-10-23 OCR 设备名称与通用显卡选择

- 下拉改为 CPU 识别、显卡识别、N卡专用（30系+）；small/tiny 保留。DirectML 移除 AMD 厂商限制，优先 Windows 高性能硬件适配器，LUID 映射回 ORT 所需的原始 DXGI 索引。保留历史 amd 配置值，不改写用户设置。
- 本机 RTX5080 使用正式 release OCR 的 --device amd 路径（不是 dml-test）：small/tiny 各识别双语样本两次，中英文数字结果均正确，进程正常 EOF 退出、stderr 为空。det/rec profiling 均出现 DmlExecutionProvider；small rec 有 8 个 CPU 节点事件，属于 ORT 算子分配。证据 target/ocr-general-gpu-20261023-102718/results.json 及同目录 profiles。AMD/Intel 实机、多显卡选择和不支持 DirectML 的硬件仍待验证。
- 浏览器预览核对三项名称，并选中最长的 N卡专用（30系+），1280×720 下文字完整无截断；随后恢复预览原 CPU 选项。截图 target/ocr-device-label-preview.png。浏览器仅验证布局，原生后端由上述 release 进程实测覆盖。
- 通过：Node 69项、core12+storage9、OCR单测4项、依赖边界、cargo fmt --all -- --check、全workspace/all-targets Clippy -D warnings；前端构建235.9/240KiB。prepare-ocr、modules:dev/package、Tauri release --no-bundle --ci 均成功；更新 target/release/moligod.exe、配套模块及独立模块ZIP。六处 OCR 资源目录和独立ZIP仍不含已移除的 TensorRT 可选插件，ZIP没有 Python/worker.exe/_internal 条目。未重启或替换用户当前运行实例，未生成安装包。

## 2026-10-24 自动化四标签工具箱

- 编辑区上方新增工具箱，含模型设置、任务管理、日志、动作。OCR 两个标签在下拉框左侧；原任务和日志移入对应面板；动作库改为按类别横排的工具栏，编辑区占满整行。工具箱正文固定220px，含标签行实际约264.8px，切换模型/日志/动作时编辑区位置不跳变。
- 浏览器1280×720实测：空任务动作页提示先新建/选择任务；新建后可添加等待与分组，等待改为2.5秒。切换四个标签后任务名、文本输入及等待值保留，日志内部的执行日志选中状态保留。日志页点击首行插入位置自动切到动作页，新文本动作确实插入等待之前。方向键/Home/End标签导航通过；控制台错误/警告为空。
- 900×650实测：页面宽度900px未被撑宽，动作工具栏可见宽588px、内容宽855px，使用自身横向滚动；恢复默认视口。截图 target/automation-toolbox-tabs.png。浏览器测试任务为临时草稿，未运行原生输入/OCR、未改用户任务文件。
- Node69项、core12+storage9、依赖边界、cargo fmt、全workspace/all-targets Clippy -D warnings通过。前端最终构建238.9/240KiB，无预算提升。Rust/core代码没有修改；原生执行功能未因界面重排重复做硬件验收。
- 最终 Tauri release --no-bundle --ci 构建成功，产物 target/release/moligod.exe 及配套模块已更新。未生成安装包，未关闭或重启用户当前客户端。

## 2026-10-24 工具箱紧凑布局与标签调整

- 按用户后续截图移除底部动作插入提示和留白，正文高度从220px减至160px；删除标签左侧“工具箱”文字，标签顺序改为任务管理、模型设置、运行日志、动作。动作区为窄窗口横向滚动条保留高度。
- 浏览器1280×720实测整体高度204.8px（减少60px），三行动作完整显示；900×650下动作区可视宽588px、内容宽855px，可视/内容高度均126px，无多余纵向滚动条，页面未被横向撑宽。Home回到任务管理，右方向键依次进入模型设置、运行日志；插入等待后切换标签保留动作。控制台无错误或警告。截图 target/automation-toolbox-compact.png；临时浏览器草稿未保存为用户任务，未执行原生动作。
- Node69项和依赖边界检查通过；此前本节关联改动的core12+storage9、cargo fmt和全workspace/all-targets Clippy已通过，本次未修改Rust代码。
- 最终前端构建238.6/240KiB；包含上述标签调整的 Tauri release --no-bundle --ci 构建成功，更新 target/release/moligod.exe。未生成安装包或重启当前客户端。

## 2026-10-24 固定工具区、快捷键与任务排序

- 上方工具区固定，下方动作编辑器占满剩余空间；删除紧急停止提示/全部展开/全部折叠工具行和底部说明，保留分组内缩进及单组折叠。新增“快捷键设置”标签，支持组合键录入、Esc取消及恢复Ctrl+Alt+F10。浏览器预览不持久化系统快捷键。
- 1280×720浏览器创建24个等待动作：动作内容高1283px、可视高349px，列表滚动从934.4回到0时工具区顶部始终137px，main滚动为0；900×650下main可视/内容均582px，无外层纵向滚动，动作列表高279px，动作工具栏横向滚动且三行完整。快捷键录入Ctrl+Shift+F8、Esc保留原值、恢复默认均通过；分组添加子步骤和折叠/展开通过。截图target/automation-pinned-workspace.png为900×650实际前端预览；控制台无错误/警告。
- Windows原生热键专项测试单独执行通过：自定义Ctrl+Alt+Shift+F24注册，共享Windows消息线程收到WM_HOTKEY后取消两个运行令牌；运行中拒绝设置修改，最后一个令牌释放后注销，冲突保存拒绝并保留原配置，再次注册成功。该测试使用进程级注册表，与默认热键任务测试并行会产生配置冲突，因此显式ignore并单独运行；首次并行失败已定位，不是任务运行回归。未向用户桌面发送按键，此证据验证注册、消息分发和释放，未代替实体键盘按键验收。
- 正式release模块使用独立target/hotkey-qa-1zF3gs目录验证：hotkey-settings默认、保存、进程退出后读回、运行中保存拒绝、停止后保存、损坏配置保留均通过。task-reorder完整顺序保存、进程重启读回、缺失ID拒绝均通过；三个任务JSON字节前后相同。脚本target/verify-emergency-settings.mjs仅运行等待动作，未操作外部软件、用户设置或用户任务。
- 任务行支持名称/空白/拖动柄拖动，拖动柄支持上下方向键，任务面板user-select为none且输入框为text。隔离浏览器测试页使用真实任务控制器和三个虚拟任务：将B拖到A前后，A的未保存名称和当前脚本保持；重新加载后B自动选中；模拟保存失败后恢复B/A/C顺序；键盘上移C得到B/C/A，当前仍为B。截图target/automation-task-order-qa.png仅为隔离夹具。初始首项选择、双向重排、缺失ID/重复ID/损坏版本保护与脚本保持均有自动化覆盖。
- Node72项、automation库36项、core12+storage9通过；automation默认忽略3项，其中上述热键专项已单独通过。依赖边界、cargo fmt、全workspace/all-targets Clippy -D warnings通过。前端243.7/244KiB，无新增依赖。正式Tauri release --no-bundle --ci已构建；未生成安装包或重启用户客户端。

## 2026-10-24 两行任务显示裁切修复

- 用户反馈任务行上下大小不同。真实任务控制器的两任务隔离夹具复现：两行高度实际均44.4px，但列表可视高90px、内容高93px，第二行底部被截约2.6px。将任务标题行底部间距从12px减为8px，保留工具箱160px正文和动作工作区尺寸。
- 1280×720验证：修复后列表可视/内容高度均94px，两行完整可见；选中第一项和第二项时行高均44.4px，不出现多余纵向滚动条。截图target/automation-task-row-height.png为隔离测试预览，未修改用户任务。控制台无错误或警告。
- Node72项、依赖边界、前端构建通过（243.7/244KiB）。本次只修改CSS间距，Rust及动作/排序逻辑未改。
- Tauri release --no-bundle --ci成功，target/release/moligod.exe已更新；未生成安装包或重启当前客户端。

## 2026-10-24 动作拖动到边缘后持续滚动

- 用户明确问题为拖到动作列表边缘不能自动滚动。原代码只在pointermove时修改scrollTop，静止按住没有后续滚动；改为活动拖动期间的动画帧循环，上下边缘持续滚动，并依据滚动后的布局刷新插入位置。松手、取消、失去捕获/焦点、隐藏/切换/关闭界面、运行和重绘清理循环；普通编辑与启动无帧轮询。
- 新增6项回归：固定指针连续20帧滚动并更新落点、中间/横向界外停止、上下反向、首尾边界、不同帧间隔与卡顿限幅、回调内取消及失效/隐藏/移除时退出。Node全套78项通过。原动作树整体移动、自身嵌套保护及脚本往返测试仍通过。
- 1280×720隔离浏览器夹具使用真实动作编辑器、28个顶层动作及嵌套组：实际向底部拖动scrollTop从0增至6.4，顺序变为2秒/分组/4秒/1秒；向顶部拖动从726.4降至720，17秒移动到12秒前；松手后block-dragging与block-drop均清除。另把1秒改成1.5秒后滚动并拖到2秒之后，数值与组内3.1/3.2秒均保留。原插入线落点规则保留，松手时无插入线不改顺序。
- 浏览器无控制台错误/警告。截图target/automation-drag-scroll-fixed.png为隔离夹具，未操作用户任务；浏览器拖动API在终点立即松手，静止长按跨帧由上述控制器测试验证，未声称实体鼠标长按实测。
- core12+storage9、依赖边界、cargo fmt、全workspace/all-targets Clippy -D warnings、前端构建通过；前端244.9/245KiB，预算调整理由见architecture.md。
- Tauri release --no-bundle --ci成功（1分07秒），target/release/moligod.exe已重新构建；未生成安装包或重启用户正在运行的开发实例。

## 2026-10-25 Blockly 动作画布

- 保留顶部五标签工具栏、原任务管理、OCR全局设置和快捷键，下方改为离线Blockly。新模块分别负责懒加载、动作块字段、连接结构与运行画布；原生IPC/Rust执行器、任务/脚本格式未修改。所有29种旧动作保留，复杂动作复用原截图设置窗，简单参数直接在块内编辑。
- 固定兼容夹具 tests/fixtures/automation-blockly-v1.json 覆盖全部动作、分组、嵌套条件/循环、ElseIf/Else、旧窗口别名、small/tiny、前延时/随机延时和注解。7项新增测试使用真实Blockly工作区，验证两次序列化完整往返、改单字段保留其他参数、实际连接重排、游离积木拒绝导出、正则表达式和分支结构恢复。夹具中的分组延时/模板ID/变量类型经过Rust校验约束修正后成为合法脚本；未知字段和未完成参数另有保留测试。
- 浏览器隔离夹具使用真实编辑器：等待1秒改1.5秒后切换任务再返回保留；添加ElseIf后Ctrl+Z恢复且子动作不变；真实鼠标把文本从IF拖到空白区，切换任务被拒绝，再拖回插槽吸附，导出恢复原动作序列；运行锁定时添加/字段编辑无效，停止后恢复。通过画布滚轮、平移及实际缩放控件。边缘持续滚动使用官方插件并补取消清理；本轮浏览器拖放接口在终点即松手，未做实体鼠标长按跨屏验收。
- 完整应用中验证鼠标设置可切换按住拖动/后台操作，识别设置可切换双区域OCR并修改A/B变量；原导入入口载入兼容夹具，原导出入口输出的全部steps及150%缩放逐字段一致。任务导出原有的循环开关仍决定repeats为0/1，本轮未改变这一既有规则。证据 target/blockly-app-export.json。实际预览截图 target/automation-blockly-preview.png 展示顶部工具栏与循环/条件积木；浏览器控制台错误/警告为空，未修改用户桌面任务数据。
- node scripts/verify-blockly-native.mjs 使用最终release模块和独立目录 target/blockly-native-6LGr9e：全部旧动作经validate编译通过、任务保存/读取通过；Blockly转换后的安全脚本通过task-save/task-start/task-statuses执行15步完成，total=3、branch=elseIf、error=null，退出码0、stderr空。没有发送外部输入或启动OCR，结果存于该目录result.json。
- 通过：npm test 85项、core12+storage9、依赖边界、cargo fmt --all -- --check、全workspace/all-targets Clippy -D warnings、TypeScript及生产构建。前端应用225.0/245KiB，懒加载Blockly及离线媒体738.3/770KiB。新增依赖无已知audit项；npm audit仍报告既有开发依赖vite/source-map-js的2项high，本轮未扩大为构建链升级。
- npm run tauri -- build --no-bundle --ci成功，包含模块构建，最终target/release/moligod.exe为7293952字节。未生成安装包或重启用户当前客户端。本轮以浏览器UI和隔离Rust任务通路验收；真实软件截图/各GPU OCR、全新Windows安装和1000积木满载性能未重复实测。
- 最终补充检查：右键“延时 / 注解”选择结束步骤，前延时改25ms、填写注解后，实际导出EndIf保留两个字段且子动作不变。7项Blockly专项再次通过，控制台为空；最终包含该入口的Tauri release再次构建成功（1分02秒），EXE尺寸仍7293952字节。

## 2026-10-26 左侧动作分类与可拖拽积木库

- 将顶部动作标签及横排按钮库移除，改为工作区内140px左侧分类栏和Blockly原生flyout。顶部任务管理/模型设置/运行日志/快捷键设置保留。六类动作沿用原筛选结果及安全未完成默认值，循环和条件模板自带结束步骤；模板不写入当前脚本。没有新增依赖或Rust/IPC修改。
- 浏览器1280×720实测：从左侧实际拖入等待、循环，再把等待拖入循环，导出steps为wait/loop/wait/endLoop、次数3，无多余库模板。证据target/blockly-left-export.json。拖入并接好的鼠标、OCR积木均自动打开原设置窗，未绑定目标保持未完成状态；浏览器未发送外部鼠标键盘或调用OCR。
- 独立夹具通过真实工作区验证运行锁定时打开分类/添加等待均不改变脚本，停止后flyout恢复。顶部标签切换后当前脚本和左侧分类栏保留。Ctrl+Z撤销新拖入积木后可重新拖入。控制台无错误/警告。最终实际预览target/automation-blockly-left-toolbox.png包含左侧分类、展开的循环积木库和右侧已连接脚本。
- CDP设置900×650验证documentWidth=900，分类栏可视279px、内容308px；选择最后分类后scrollTop=28.8且flyout可见。无外层横向溢出，窄窗口积木库和画布仍通过各自滚动条访问。该浏览器的通用viewport覆盖未改变DOM尺寸，因此此处以CDP实际innerWidth/innerHeight为证；验证后清除覆盖并恢复默认视口。
- 新增一项真实Blockly连接测试，验证同一循环模板生成独立容器、结束步骤完整、修改一个副本不污染模板/另一个副本，鼠标目标及坐标仍未完成。Node全套86项、core12+storage9、边界检查、cargo fmt、全workspace/all-targets Clippy -D warnings通过；最终模板精简后8项Blockly专项及TypeScript再次通过。
- target/verify-blockly-left-native.mjs使用独立target/blockly-native-DrBa1c目录，对浏览器实际拖放导出的脚本执行Rust编译校验、任务保存/读取；随后原有安全控制流脚本通过task-start完成15步，total=3、branch=elseIf、error=null，退出码0。没有操作用户桌面任务或外部软件。该临时脚本复用scripts/verify-blockly-native.mjs，只替换输入夹具路径。
- 最终生产构建：应用223.1/245KiB，懒加载Blockly及媒体739.8/770KiB。npm run tauri -- build --no-bundle --ci成功（1分10秒），更新target/release/moligod.exe及配套模块；EXE7293952字节。未生成安装包或重启用户当前客户端。本次未重复真实GPU OCR、外部目标软件截图或1000积木性能验收。

## 2026-10-26 备注气泡文字对比度

- Blockly备注输入框在应用深色color-scheme下呈现浅色文字，而原生气泡仍为浅黄色背景。限定.auto-blockly内的.blocklyTextarea使用light色彩方案、#20242c文字与光标，并设置选中文字的深蓝底白字；动作字段和脚本格式未修改。
- 隔离浏览器夹具实际打开积木问号备注并输入“233 备注文字”，确认浅黄背景rgb(255,252,199)、文字/光标rgb(32,36,44)，显示清楚且输入同步到原annotation字段。截图target/blockly-comment-contrast.png；未修改用户任务。
- npm test、core12+storage9、依赖边界、cargo fmt、全workspace/all-targets Clippy -D warnings、TypeScript及生产构建通过。应用223.3/245KiB，懒加载Blockly及媒体739.8/770KiB。
- Tauri release --no-bundle --ci成功（1分06秒），已更新target/release/moligod.exe；未重启当前客户端。

## 2026-10-26 行内备注与左侧画布工具

- 将问号备注气泡改为对应动作下一行，分支及结束步骤备注也按位置显示。保留原annotation完整文字与换行，显示长行按48个Unicode字符折行；备注编辑支持textarea。新增左侧底部复位/缩放/垃圾桶与展开所有备注、隐藏所有备注；工具栏固定，分类独立纵向滚动。
- 新增真实Blockly工作区测试，验证多行/长备注、分组/分支/结束注解经隐藏、改字段、编辑备注、展开、再次序列化仍完整；隐藏不改变脚本。Node全套87项、core12+storage9、边界、cargo fmt、全workspace/all-targets Clippy -D warnings通过。
- target/blockly-notes-qa.html使用真实编辑器隔离验收：将带“233”和第二行备注的等待积木拖到左侧垃圾桶，脚本由2步变1步；点击垃圾桶再拖回，恢复2步及完整备注。隐藏全部后导出仍含两条annotation；隐藏中编辑第一条多行备注保持隐藏，展开后显示两行。放大比例0.9→0.99，复位恢复0.9；运行锁定时左侧垃圾桶禁用，停止后可用。未修改用户任务。
- 900×500实际DOM尺寸下分类可视206px/内容300px，选最后分类后scrollTop约93.6，分类无横向溢出（clientWidth=scrollWidth=130）；左下工具保持可见。修正Blockly原生分类容器的换列布局为单列滚动。验证后清除尺寸覆盖；控制台无错误/警告。截图target/blockly-inline-notes-left-controls.png为隔离编辑器实际效果。
- node scripts/verify-blockly-native.mjs在target/blockly-native-zX00iP验证全部旧动作、任务保存/读取及Rust安全控制流执行，phase=completed、15步、total=3、branch=elseIf、error=null；未发送外部鼠标键盘或调用OCR。
- 最终Tauri release --no-bundle --ci成功（1分08秒），包含小窗口分类单列滚动修正；应用224.7/245KiB，懒加载Blockly及媒体742.9/770KiB。已更新target/release/moligod.exe，未生成安装包或重启当前客户端。

## 2026-10-26 移除延时设置并直接输入注释

- 当前Blockly编辑器移除“动作参数”弹窗及前延时/随机延时输入，简单动作以“注释”代替齿轮；鼠标/拖动/滚轮/OCR/匹配/截图继续提供设置及独立注释按钮。点击注释在对应动作或分支下一行展开真正的textarea并自动聚焦，多行文字即时写入原annotation，清空删除该可选字段，无完成按钮。
- 新增2项真实Blockly测试：覆盖主动作/ElseIf/Else/结束步骤直接注释编辑、收起输入后的mutation撤销重做，验证原连接与所有旧延时/动作字段不变；验证简单动作仅注释、7类空间动作保留设置。11项Blockly专项和完整npm test通过，core12+storage9、边界、fmt、全workspace/all-targets Clippy -D warnings及TypeScript通过。
- 浏览器隔离编辑器实际点击注释后输入多行，导出即时包含新文字，dialog[open]为0；清空后annotation被移除。隐藏全部备注可收起输入并保留内容，再点击某动作可独立编辑。运行锁定时textarea.readOnly=true，停止后false；在画布上Ctrl+Z/Ctrl+Shift+Z实际恢复旧/新备注，控制台无错误/警告。截图target/blockly-direct-annotation.png；未修改用户任务。
- node scripts/verify-blockly-native.mjs在target/blockly-native-dxH5gy验证全部旧动作、任务保存/读取及Rust安全控制流执行，15步完成，total=3、branch=elseIf、error=null；未发送原生输入或执行OCR。
- Tauri release --no-bundle --ci成功（1分07秒），更新target/release/moligod.exe；应用224.6/245KiB，懒加载Blockly及媒体743.7/770KiB。未生成安装包或重启当前客户端。

## 2026-10-26 窗口自动刷新、输入尺寸与独立截图

- 在target/automation-preview-qa.html/.ts使用真实index DOM、编辑器、任务管理、Blockly和预览组件，仅原生IPC边界返回固定窗口/图片/识别结果。修复前将OCR块拖离主栈再打开设置，实际显示“截图失败：Error: 有未连接的积木…”。原生preview已返回，错误由后续syncScale读取read()触发blocks.flush引起。修复后同样操作显示截图，ocr-test成功发出且结果可显示；该测试验证前端调用链，不代表本机GPU OCR或真实窗口捕获验收。
- 积木窗口下拉在打开前枚举窗口，删除独立刷新按钮；隔离边界windows调用由初始1次增至第1次打开后的2次、第2次后的3次，下拉分别显示新窗口2/3，旧未选项不残留。新增真实Blockly测试验证失效非选中窗口删除、已选目标保留，以及选择新值后不恢复旧目标。
- 注释一行高度38px（0.9倍画布实际34.2px），三行79px（实际71.1px），删回一行恢复38px。空文本字段最小56px（实际50.4px），值保持空字符串；所有独立“刷新窗口列表”积木按钮已移除。截图target/blockly-fields-fixed.png展示实际应用DOM下的布局。
- 游离OCR截图测试包含缩放100%→150%以及OCR测试回到100%，请求区域仍为x10/y10/width120/height40；画布内游离动作和当前设置动作均参与缩放。点击保存仍返回未连接提示且未发出task-save，完整任务校验未放松。证据target/ocr-unconnected-preview-fixed.png；浏览器无错误/警告，未读写用户任务或调用实际原生输入/OCR。
- 全部npm测试（Blockly专项12项）、core12+storage9、依赖边界、cargo fmt、全workspace/all-targets Clippy -D warnings、TypeScript和生产构建通过。node scripts/verify-blockly-native.mjs在target/blockly-native-xoqY5h验证全部旧动作保存/读取与Rust安全执行15步，total=3、branch=elseIf、error=null。
- Tauri release --no-bundle --ci成功（1分32秒），更新target/release/moligod.exe；应用224.6/245KiB，懒加载Blockly及媒体744.6/770KiB。未生成安装包或重启当前客户端。

## 2026-10-26 收窄积木分类栏

- 缩小分类行左右间距及底部工具内边距，分类栏最小宽度由140px调整为112px，未连接提示随栏宽调整。独立Blockly浏览器夹具中，1280×720时栏宽112px，六类名称、底部按钮完整显示且分类无横向溢出；900×500时含滚动条实际宽120px，分类可视210px/内容300px，选择末项后纵向滚动且文字完整，积木库从分类栏右边缘展开。备注开关和缩放按钮可用。截图target/blockly-narrow-toolbox.png。
- npm test、core12+storage9、依赖边界、cargo fmt、全workspace/all-targets Clippy -D warnings及前端生产构建通过；本次只调整样式，未修改脚本或Rust执行逻辑。
- Tauri release --no-bundle --ci成功（1分05秒），已更新target/release/moligod.exe；未重启当前客户端。

## 2026-10-26 分类栏边距与备注显示

- 移除 Blockly 分类左侧彩色边框，压缩分类栏并让名称居中；展开的积木库紧贴分类栏右侧。隔离浏览器在 900×500 下检查到栏宽含滚动条 112px，积木库左边缘与分类栏右边缘同为 128px，分类无横向溢出，六项文字完整。
- 备注编辑框根据对应积木的渲染宽度铺满下一行，采用浅色背景和深色文字；已显示备注使用加粗高对比文字。真实 Blockly 浏览器夹具中，按键积木宽 465.3px、备注框宽 450.9px，右侧间隔 7.2px；三行注释高度 79px，编辑结果即时保留在 annotation。未访问用户任务或执行实际按键。
- npm test 90 项、core 12 项与 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings、前端生产构建通过。未进行真实桌面应用的交互验收。
- Tauri release --no-bundle --ci 构建通过（1分15秒），已更新 target/release/moligod.exe；未重启正在运行的客户端。

## 2026-10-26 识别截图拆分为四个积木入口

- 识别截图分类直接提供读取屏幕文字、识别两处文字（A / B）、图像匹配、保存截图四种模板，分别生成原有 ocr、ocrGroup、match、capture 类型；配置面板中既有类型切换仍可用于编辑旧动作。画布积木标题显示各自名称。
- 使用完整应用 DOM 与真实 Blockly 的隔离浏览器夹具，原生 IPC 仅返回固定测试数据；逐一将四个积木拖入任务并确认对应的设置类型和控件。没有读写用户任务、调用真实 OCR 或目标软件。
- 新增真实 Blockly 序列化测试，确认四类模板的动作类型、标题、拼接及保存读取往返；原有旧脚本固定夹具也通过。npm test 91 项、core 12 项与 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings 与前端生产构建通过。

## 2026-10-26 积木外侧黄色注释

- 将已展开的注释显示为动作下方的黄色文字，注释行保留布局空间，避免遮挡后续动作；编辑时仍可在对应位置直接输入多行文字。此变化只影响 Blockly 显示，不改变 annotation、旧脚本结构或 Rust 执行。
- 使用独立真实 Blockly 浏览器夹具检查连续动作、长短积木、两行注释的编辑与即时保存；展开/隐藏备注后布局正常。另以条件、否则、结束和内部动作的备注验证多层结构及相邻动作显示；无真实用户任务操作。
- 完整 npm test 91 项、core 12 项及 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings 和前端生产构建均通过。
- node scripts/verify-blockly-native.mjs：全部旧动作验证和任务保存/读取通过；隔离安全脚本由 Rust 执行 15 步完成，未发送原生输入。
- 最终 Tauri release --no-bundle --ci 构建通过（1分17秒），已更新 target/release/moligod.exe；当前客户端未重启，未做真实桌面 OCR 验收。

## 2026-10-26 限制注释高度并调整输入颜色

- 注释显示压为一行，长文本以省略号表示并保留完整 tooltip；编辑框固定 32 逻辑像素高，采用深色背景，长文本与多行内容在框内滚动。完整 annotation 仍按原格式保存。
- 独立 Blockly 浏览器夹具中，0.9 倍缩放的输入框实际高 28.8px，四行文本仍为固定高度（clientHeight 30，scrollHeight 89）；关闭并重新打开保留全部四行，背景 rgb(32,40,51)，无控制台错误。未改动用户任务。
- npm test 91 项、core 12 项及 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings、前端构建均通过；未进行实际桌面客户端验收。
- Tauri release --no-bundle --ci 构建通过（1分16秒），已更新 target/release/moligod.exe；未重启当前客户端。

## 2026-10-26 去除注释输入框外边框

- 注释编辑区使用透明背景，无边框、圆角或焦点阴影，保留之前的单行高度与多行滚动。浏览器隔离 Blockly 夹具中，聚焦状态的 border 为 0、背景透明、无阴影；输入两行，收起并重新打开后内容完整。未修改用户任务。
- npm test 91 项、core 12 项及 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings、前端构建均通过。实际桌面客户端尚未验收。

## 2026-10-26 注释上下空隙

- 去除注释输入边框和底色，Zelos 派生渲染器仅对注释行压缩高度与相邻非语句行间距；保留语句连接处的必要距离。注释文本框为 22 逻辑像素、无内边距，单行显示和多行滚动编辑保持不变。
- 同一 0.9 倍 Blockly 浏览器隔离夹具中，带编辑注释的等待积木外框高度从 88.2px 降至 68.4px，输入框高度为 19.8px。验证条件、否则和结束注释显示及多行编辑导出；将新等待积木拖到已有注释动作后，正确连接并导出三步。未读写用户任务或运行原生输入。
- npm test 91 项、core 12 项及 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings 和前端构建通过；实际桌面客户端尚未验收。
- 最终 Tauri release --no-bundle --ci 构建通过（1分17秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 独立动作注解与识别类型固定

- 识别设置窗移除类型下拉，标题直接使用读取屏幕文字、识别两处文字（A / B）、图像匹配或保存截图。基础操作新增“动作注解”模板，复用已有 comment 动作与 Rust 无输入执行语义。
- 移除各动作的注释按钮、附属注释行、上下文注释入口、展开/隐藏按钮及专用行间距渲染器。新增紧凑多行注解字段，并保留运行只读和撤销/重做。旧 annotation 在空闲加载时转换为独立注解积木，不直接写磁盘；原动作参数、旧延时和注解完整文字保留，重复转换不重复生成，运行期间延迟到停止后转换。
- 使用实际应用 DOM/Blockly、原生 IPC 测试桩：从基础操作拖入注解，输入两行后保存确认 comment.text 完整，再从末尾拖到第一步并保存，确认顺序与其他三步一致；读取文字设置窗已无类型下拉。独立条件分支夹具验证五处旧注解转换、重复输入、运行时全部 textarea.readOnly，以及运行中加载旧脚本保持原索引、停止后完成转换。两个测试页无控制台错误或警告，未操作真实用户任务或发送原生输入。
- 新增转换位置、幂等、Unicode长文本拆分、数量上限保留源数据测试；修改 Blockly 测试覆盖独立注解移动、删除、编辑、撤销/重做及附属控件移除。npm test 94 项、core 12 项与 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings 和前端构建均通过。
- node scripts/verify-blockly-native.mjs 在 target/blockly-native-qmoIz1 验证全部旧动作与迁移后注解的 Rust 校验、保存/读取；包含独立注解的安全脚本执行16步完成，total=3、branch=elseIf、error=null，未发送原生输入。真实桌面客户端交互及OCR不属于本轮验收。
- 最终 Tauri release --no-bundle --ci 构建通过（1分19秒），已更新 target/release/moligod.exe；应用224.1/245KiB，懒加载Blockly与媒体743.1/770KiB。未重启当前客户端。

## 2026-10-26 去除注解标题与单动作拖动

- 画布注解去掉文字标题，保留拖动手柄和注解内容；基础操作分类中的模板名称不变。所有动作使用单动作拖动策略，容器保留内部动作，后续同级动作自动接回原序列。
- 独立浏览器夹具实测：拖出首个注解后，其后两个等待仍连接在任务开始，注解自身不带子动作；拖出夹在两个等待之间的分组后，前后等待自动相连，分组内的等待、循环、注解和循环内等待均完整。将分组接到链尾后导出顺序正确，原11ms前延迟、5ms随机延迟保留；连续两次撤销恢复原位置及完整脚本。浏览器无错误/警告，未操作用户任务或发送原生输入。
- 新增分组移走后同级链复原与内部连接完整的回归测试。npm test 95 项、core 12 项和 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings、前端构建通过。实际桌面客户端尚未验收。
- Tauri release --no-bundle --ci 构建通过（1分17秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 移除两处文字识别入口

- “识别截图”分类不再提供“识别两处文字”，保留读取屏幕文字、图像匹配、保存截图；旧脚本的 ocrGroup 数据、编辑及 Rust 执行兼容保持不变。
- 使用实际应用 DOM/Blockly 与原生 IPC 测试桩，打开识别分类确认仅显示上述三项；浏览器无错误或警告，未操作真实用户任务。
- npm test 95 项、core 12 项和 storage 9 项、依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings 及前端构建通过。
- Tauri release --no-bundle --ci 构建通过（1分11秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 完整删除双区域 OCR 实现

- 本节替代上一节仅移除入口、保留执行兼容的方案。删除 ocrGroup / setFromOcr 动作枚举与执行分支、双区域采集/识别函数、A/B 变量与缩放处理、前端配置与框选、辅助窗口配对模式、专用 OCR RPC 与宿主白名单/超时分支。生产代码中的旧类型字符串仅用于拒绝旧动作；原始固定夹具保留用于负向测试。
- 不支持的任务仍列出并标记“无法加载”，点击展示原因且不改变当前任务；不覆盖或转换原文件。新 Rust 回归验证两种旧动作嵌套在分组中时无法加载、运行或覆盖保存，文件字节保持不变。
- npm test 95 项、Rust 自动化 36 项（3 项硬件/独占快捷键测试仍按既有设置忽略）、core 12 项、storage 9 项、Tauri 选区校验 1 项通过；依赖边界、cargo fmt、全 workspace/all-targets Clippy -D warnings、前端构建通过。
- 原生 release 模块验证 target/blockly-native-9MRCAQ：旧动作 validate 与 ocr-test-group RPC 明确拒绝；其余固定动作夹具及注解迁移仍可校验、保存/读取；安全脚本完成16执行步，total=3、branch=elseIf、error=null。未发送原生输入或启动 OCR 推理。
- 使用真实应用 DOM/Blockly 与隔离 IPC 测试桩验证分类仅有三项，单区域 OCR 设置窗打开、预览与 ocr-test 请求/文字结果均正常，参数只有 region。另验证无法加载任务仍显示、操作禁用、点击报错后当前任务与画布不变。浏览器无控制台错误或警告，未操作真实用户任务；本轮未验收真实显卡 OCR 推理。
- Tauri release --no-bundle --ci 构建通过，桌面编译1分13秒；已更新 target/release/moligod.exe 及自动化模块（2.91 MiB）。应用217.0/245 KiB，懒加载Blockly与媒体743.2/770 KiB。当前客户端未重启。
- 最后清理未使用的 OCR 来源/取值字段标签后，npm test 95项再次通过，Tauri 最终构建通过（1分12秒）；当前客户端仍未重启。

## 2026-10-26 分类居中与轻量滚动条

- 分类按钮去除 Blockly 空图标占位，覆盖其单侧内联缩进，改用对称内边距和 flex 居中。分类栏固定宽度，并将其尺寸变化纳入现有 ResizeObserver，避免栏宽改变后积木面板留在旧位置；销毁时沿用 observer.disconnect。
- 分类列表使用4px淡色原生滚动条，透明轨道、无上下箭头；积木列表、画布横向/纵向 SVG 滚动条统一为4px可见滑块，透明度14%，悬停28%，保留9px轨道和拖动操作。
- 真实应用 DOM/Blockly 测量六个分类文字中心与按钮中心误差小于0.001px，分类栏与积木面板间隙小于0.001px。低高度隔离夹具中分类滚轮从0移动到72.8px；宽度变化至120px时面板仍紧贴。实际拖动三个SVG滑块，积木列表y=45、画布纵向y增加50、横向x=70；均保持正常，无浏览器错误或警告。测试未操作真实任务。
- npm test 95项、依赖边界、TypeScript/Vite构建与体积预算通过。效果截图：target/blockly-scrollbars-final.png（隔离测试任务）。
- 最终 Tauri release --no-bundle --ci 构建通过（1分20秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 合并流程控制分类

- 将原“条件判断”和“循环跳转”合并为“流程控制”，包含 If、断言、循环、跳出循环、下一轮、标签和跳转标签；ElseIf/Else 继续由 If 的添加分支操作管理。基础操作、脚本动作标识及 Rust 执行语义保持不变。
- 真实应用 DOM/Blockly 隔离页确认左栏显示五个分类，流程控制展开后上述七种模板均在同一列表；无控制台错误或警告，未操作真实用户任务。
- npm test 95项、依赖边界与前端构建/体积预算通过。
- Tauri release --no-bundle --ci 构建通过（1分15秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 动作名称中文化与简化

- 条件动作显示统一为“如果”“否则如果”“否则”；“动作分组”“动作注解”分别简化为“分组”“注解”，注解输入提示与无障碍名称同步更新。内部动作标识及执行格式不变，画布注解继续仅展示内容和拖动手柄。
- 实际应用 DOM/Blockly 隔离夹具验证：基础操作模板为分组/注解，流程控制模板为如果，已加载条件的三个分支分别显示如果/否则如果/否则；无控制台错误或警告，未操作真实任务。
- npm test 95项、依赖边界、TypeScript/Vite构建与体积预算通过。
- Tauri release --no-bundle --ci 构建通过（1分18秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 切换窗口积木语句

- 窗口切换模板和画布动作统一显示“切换到 [窗口下拉框] 窗口”，去掉中间的“目标窗口”标签；悬浮摘要同步为切换到窗口语句，内部 focus/target 数据不变。
- 真实应用 DOM/Blockly 隔离页确认模板为“切换到 [选择软件窗口] 窗口”，已配置动作为“切换到 [测试窗口] 窗口”，无控制台错误/警告。未操作真实用户任务或激活原生窗口。
- npm test 95项、依赖边界及 TypeScript/Vite 构建通过。
- Tauri release --no-bundle --ci 构建通过（1分22秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 输入动作移除目标窗口

- 按键和输入文本移除 Blockly 下拉与旧表单中的目标窗口字段；新动作直接向当前前台窗口输入。旧目标在空闲加载时拆成可见 focus 动作，原等待/随机等待位于切换前，输入内容/按键/注解/额外数据保留，不直接改写磁盘；运行中延迟到停止后转换。
- 新增嵌套条件位置、等待迁移、注解组合、幂等、当前前台不变、无效目标与超过1000动作时源数据保持的测试。npm test 97项、依赖边界、TypeScript/Vite构建与体积预算通过。
- 真实应用 DOM/Blockly 与隔离 IPC 夹具确认两项动作无目标字段，旧按键目标呈现为前置“切换到 [测试窗口] 窗口”；点击保存后请求为 focus(delay=25/random=9) + key(delay=0/random=0) + text，两项输入均无 target，保存后未重复生成切换。无控制台错误/警告，未操作用户真实任务。
- node scripts/verify-blockly-native.mjs 在 target/blockly-native-2v7rU8 验证转换后脚本经 Rust 校验及保存/加载，原有安全执行脚本完成16步、total=3、error=null；未发送原生输入。本轮不包含真实窗口激活或文本输入验收。
- Tauri release --no-bundle --ci 构建通过（1分20秒），已更新 target/release/moligod.exe；当前客户端未重启。

## 2026-10-26 OCR 预览测试画面一致性

- “切换到”积木末尾的“窗口”文字已移除，提示摘要同步。
- 排查：原生 WGC 非零区域捕获与整帧裁剪逐像素相同（cargo run -p moligod-automation --example native_smoke --locked -- --capture-region）；150%缩放、1280×480原图缩为640×240预览时，框选发出的物理区域正确。
- 复现实际前端调用链：隔离IPC提供预览帧与随后变化的实时帧；圈选 SELECTED TEXT，原实现发送无snapshot的ocr-test，显示 moligod。修复后重跑同一拖动与测试，携带 fixture-frame 标识和相同区域(485,212,528,91)，显示 SELECTED TEXT；无额外preview/window-metrics请求、无浏览器错误/警告。该用例模拟用户截取自身窗口后布局变化，未改动真实用户任务。
- 新增预览帧缓存裁剪/刷新失效/越界测试，以及前端预览基准从150%切换至300%仍使用同一帧物理区域的测试。npm test 98项；自动化Rust 37项通过，3项既有硬件/独占快捷键测试忽略；core12、storage9、边界、fmt、全workspace/all-targets Clippy -D warnings及前端构建通过。
- 真实原生OCR验证：cargo run -p moligod-automation --example native_smoke --locked -- --module-ocr-snapshot --release-module。先预览自建测试窗口 MOLIGOD 12345，再把测试窗口内容改为 CHANGED 98765；缓存OCR仍输出 MOLIGOD 12345，实时OCR输出 CHANGED 98765，刷新后缓存OCR输出 CHANGED 98765；旧标识拒绝。使用隔离数据目录和自建窗口，未向用户程序发送输入。真实跨显示器拖动仍未实测，缩放证据为坐标测试及150%浏览器场景。
- 最终 Tauri release --no-bundle --ci 构建通过（1分16秒），已更新 target/release/moligod.exe 与自动化模块；当前客户端未重启。

## 2026-10-26 终止执行条件命名

- 将用户界面中的“断言”统一改为“终止执行条件”，积木字段明确标注“条件（不满足则终止）”与“终止提示”，帮助说明满足时继续。运行报错同步改成“条件不满足，已终止执行”，内部 assert 标识与原有真假语义不变。
- 真实应用 DOM/Blockly 隔离页确认流程控制模板的名称及字段提示正确，无控制台错误/警告。npm test 98项、自动化Rust 37项（3项既有忽略）、边界、fmt及全workspace/all-targets Clippy -D warnings通过。
- 前端构建/体积预算及 Tauri release --no-bundle --ci 构建通过（桌面编译1分10秒），已更新 target/release/moligod.exe 和自动化模块；当前客户端未重启。

## 2026-10-27 开发截图引擎版本不同步

- 原因：开发清单仍指向 engine-9adc5b7f0043d821.exe，发布清单已更新为 engine-89b9ebdcfbb0fba7.exe。开发宿主读取 bundled-modules/dev，前端热更新或发布构建不会更新该目录。未发现本地安装清单覆盖，也没有运行中的 moligod/engine 进程。
- 红灯复现：cargo run -p moligod-automation --example native_smoke --locked -- --module-ocr-snapshot 退出1，错误 Missing preview snapshot；相同命令追加 --release-module 通过，排除当前发布引擎实现故障。
- 修复：npm run modules:dev 成功，开发清单更新为 engine-2ebbcef792cb5c56.exe。重新运行上述开发版原生测试通过：缓存帧识别 MOLIGOD 12345、实时画面识别 CHANGED 98765、刷新后缓存识别 CHANGED 98765，旧标识拒绝。仅使用隔离目录及自建测试窗口，未修改用户任务或配置。
- 本次仅修复开发产物同步并补充分发验证说明，没有业务代码修改；未重复构建未改变的发布客户端。用户界面尚未现场复测。

## 2026-10-27 变量积木通俗语序及双版本模块同步

- 设置变量改为“将 [值] 保存为 [名称] 变量”，计算变量改为“将 [算式] 的计算结果保存为 [名称] 变量”；内容放在保存目标之前，提示摘要与帮助说明同步。真实 Blockly 字段读取确认语序，原 Step[] 序列化前后完全相同。
- 增加 modules:sync，Tauri beforeBuildCommand 依次构建开发/发布模块再构建前端，避免发布成功但开发引擎未更新。npm test 98项、边界、fmt、TypeScript/Vite与体积预算通过。
- Tauri release --no-bundle --ci 通过（桌面编译1分08秒），开发/发布模块同步成功，target/release/moligod.exe 已更新。开发及发布模块的 native_smoke --module-ocr-snapshot 均通过，测试只操作自建测试窗口与隔离配置目录。
- cargo build -p moligod --locked 尝试刷新开发宿主时，target/debug/moligod.exe 因正在运行被 Windows 拒绝替换；未强制结束用户客户端。本次没有宿主业务代码或 IPC 修改，开发前端源文件及模块已更新，开发宿主 EXE 的再次替换待退出客户端后进行。未现场验证用户正在编辑的任务。

## 2026-10-27 正向停止条件、暂停与屏幕顶部状态栏

- 新积木显示“如果 [条件] 则停止任务并提示 [内容]”，成立时停止；旧 assert 无 stopWhenTrue 字段仍保留不成立时失败的行为，Blockly 显示等价否定条件，编辑后才切换新语义。新增前端旧脚本读写/修改往返与 Rust 新旧真假四种执行用例，确认停止后不执行后续动作。
- 加入 Ctrl+Alt+F9 暂停/继续；紧急停止保持用户原设置。等待可暂停，原生输入在安全动作边界暂停；暂停时间不占运行时限。新增暂停等待/同一步继续/轮次、暂停时取消唤醒测试。单独执行 Windows 原生热键测试通过：两个任务的暂停/继续通知均生效，停止与释放/冲突检测保持正常；测试通过定向 WM_HOTKEY 消息验证，不向用户软件发送组合键。
- 99项 npm 测试、自动化39项（3项既有默认忽略，其中热键测试随后单独运行通过）、core13项、storage9项、边界、fmt、workspace/all-targets Clippy -D warnings 通过。前端221.3KiB/245KiB，Blockly744.1KiB/770KiB。
- 新增 src-tauri/examples/automation_bar_smoke.rs 隔离 WebView 验证。例程需链接 Tauri 生成的 resource.lib（cargo rustc -p moligod --example automation_bar_smoke --locked -- -C link-arg=<target/debug/build/moligod-*/out/resource.lib>），因为 Tauri 默认只给主二进制链接 Common Controls v6 资源；第一次直接 cargo run 缺该资源，报 STATUS_ENTRYPOINT_NOT_FOUND。测试独立 identifier，不加载用户任务。
- 原生实测125%/2560×1440显示器：初测发现隐藏边框使居中偏9px，改为 outer_size 计算后位置(646,5)、外框1268×75；置顶、不聚焦、顶部居中检查通过。旧隐藏 revision 不能隐藏运行中的新状态；结束提示经真实 WebView IPC 在8秒后自动隐藏。例程退出时 WebView2 打印 Chrome_WidgetWin_0 注销警告，但断言及进程退出成功；真实多显示器切换、独占全屏应用和用户现场任务未验证。
- Tauri release --no-bundle --ci 成功（桌面编译58.95秒）；开发宿主由现有 tauri dev 监听更新（本轮宿主源最新04:11:40，开发EXE04:11:46），没有手工结束用户进程。最终 modules:sync 同步开发 engine-d6f4b6f18835208b.exe / 发布 engine-26ad6954bcfa6b21.exe。两套实际模块的预览帧OCR测试及 Blockly→Rust 原生脚本往返/16步安全执行通过。

## 2026-10-27 按用户回复仅保留紧急停止

- 用户明确选择“只显示现有紧急停止快捷键”，覆盖上一节的临时暂停设计。删除暂停/继续文案、F9注册与保留限制、执行器暂停等待、Cancellation暂停状态及对应测试；顶部状态栏仍显示当前步骤、轮次、模型和用户配置的紧急停止键。停止条件与旧脚本兼容不变。
- npm99项、自动化38项（3项默认忽略）、core12项、storage9项、边界、fmt及workspace/all-targets Clippy -D warnings通过。原生紧急停止测试单独通过；新增允许Ctrl+Alt+F9被用户选作紧急停止键的验证，确认不再被暂停功能保留。
- modules:sync 已同步开发 engine-5db5c9ebcf85752c.exe / 发布 engine-cf3dad67a8ec00f4.exe；两套原生截图/OCR同帧测试通过，Blockly→Rust兼容和16步安全执行通过（target/blockly-native-PTSYyc），没有执行用户任务。开发宿主由现有开发监听在本次源文件修改后更新，未手工关闭用户客户端。
- 最终 Tauri release --no-bundle --ci 构建通过（桌面编译1分05秒），已更新发布主程序。新增F9自定义紧急停止键的定向测试通过。

## 2026-10-27 动作文案精简

- 逐项核对20种当前动作：变量改为“保存 [值] 到 [名称]”“计算 [算式] 保存到 [名称]”；按键改为“按 [键] 持续 [毫秒] 毫秒”；循环改为“重复 [次数] 次（0=一直）”。鼠标/识别/截图在画布只显示一次操作摘要，删除标题与摘要重复，保留窗口、位置及保存结果；工具箱仍保留各动作短名称。
- 简化动作帮助及识别设置中的术语：保存到变量、相似度（0～1）、选择图片、测试识别、画面没变时沿用结果。没有改变动作类型、字段、默认值、执行逻辑、旧脚本兼容或停止语义。
- 实际Blockly字段生成检查20种动作的文字顺序；已有识别模板显示断言同步新摘要。npm99项、依赖边界、TypeScript/Vite及体积预算通过。应用220.5KiB/245KiB，Blockly744.1KiB/770KiB。
- Tauri release --no-bundle --ci 构建通过（桌面编译1分15秒）；开发/发布模块经 modules:sync 同步构建，前端开发源码与发布资源均已更新，发布EXE已重建。

## 2026-10-27 按键标题

- 按用户要求将积木“按 [键]”改成“按键 [键]”，工具箱与画布共用标题；仅文字修改，按住时长和执行参数不变。
- modules:sync、TypeScript/Vite与体积预算及 Tauri release --no-bundle --ci 均通过（桌面编译1分09秒）；开发源码、两套引擎及发布程序已同步更新。

## 2026-10-27 计算默认算式

- 新增“计算”动作及工具箱模板的默认算式由 result > 0 改为 1+1；已保存动作、条件判断和停止条件的表达式不变。动作草稿与Blockly相关测试通过，TypeScript/Vite与预算检查通过。
- 26项相关测试通过；modules:sync 已同步开发/发布引擎，Tauri release --no-bundle --ci 构建通过（桌面编译1分16秒），开发源码与发布程序均已更新。

## 2026-10-27 流程控制分组与颜色

- 保留左侧“流程控制”入口，在积木库内部按“条件判断、循环、跳转”分段并显示标题。条件族（金色）、循环族（蓝色）、跳转族（紫色）统一在积木库和画布使用相同配色；if/否则分支与条件停止归条件族，重复/退出循环/下一轮归循环族，标签/跳到归跳转族。没有增加层级点击或改变动作字段/执行行为。
- flowGroups 同时定义标题、成员与配色，未知新动作保留显示而非被分组筛选丢弃。已有工具箱容器测试适配标题节点；npm99项、边界、TypeScript/Vite与预算检查通过。
- 隔离浏览器加载实际Blockly编辑器，展开“流程控制”后确认三个标题与全部7种模板可见，主画布里的如果/循环/标签分别使用对应颜色，无控制台警告或错误。截图 target/blockly-flow-groups.png，未读取或改动用户任务。
- modules:sync 已同步两套引擎；Tauri release --no-bundle --ci 构建通过（桌面编译1分14秒），开发源码与发布程序均已更新。

## 2026-10-27 流程分组标题分隔线

- 在三个分组标题右侧添加低对比度1px横线，按当前积木栏宽度延伸；不占鼠标命中区域。切换分类和尺寸变化时通过一次动画帧更新，销毁时取消排队帧。
- 浏览器验证三个标题均各有一条线，右边距约14px；切换到基础操作再返回后仍各一条，无叠加及控制台错误。截图 target/blockly-flow-lines.png。npm99项、边界及TypeScript/Vite和预算检查通过。
- modules:sync 与 Tauri release --no-bundle --ci 成功（桌面编译1分13秒），开发版和发布版同步更新。

## 2026-10-27 独立提示动作

- 条件停止移除“并提示”与输入框，新动作空消息；历史非空消息保留保存/执行兼容。基础操作新增“提示 [内容]”，使用 notify/text 持久化并由 Rust Plan 直接执行，支持变量展开，写日志与状态栏后继续，不发送键盘/鼠标输入。
- 新增提示非空/长度约束、变量展开、后续动作继续、日志最多80条和旧停止内容兼容验证；新增Blockly提示编辑/序列化、停止块不再包含消息字段验证。npm100项、自动化39项（3项默认忽略）、core12、storage9、边界、fmt、workspace/all-targets Clippy -D warnings通过。
- 隔离浏览器实际Blockly确认基础操作包含提示，画布停止动作只显示“如果 [条件] 则停止任务”，无控制台警告或错误，截图 target/blockly-notify.png。原生状态栏例程通过新提示行高度检查、置顶/不抢焦点/居中及终态自动隐藏检查；退出时仍有此前记录的WebView2窗口类注销警告。
- scripts/verify-blockly-native.mjs 增加提示动作并在真实发布模块完成17步，notice和日志均为“已完成 3.0 次”（沿用计算结果的浮点文本格式），后续等待/条件执行成功；旧脚本读写/迁移仍通过。结果 target/blockly-native-VWhBtS。开发/发布两套实际模块的OCR同帧测试均通过，未执行用户任务。
- 最终 modules:sync 与 Tauri release --no-bundle --ci 通过（桌面编译1分07秒），开发/发布模块与界面均同步更新，开发宿主由现有监听在宿主修改后更新。应用221.3KiB/245KiB，Blockly745.6KiB/770KiB。

## 2026-10-27 图片位置变量与新增动作

- 实现图片中心位置输出、现有点击读取位置变量、带超时与重复检查的等待条件容器、持续按住/松开按键、同步调用已保存任务。新找图默认保存位置，旧脚本省略 savePosition 仍返回真假；未找到、错误目标/缩放不会发送点击。记录运行时点位缩放并验证临时驱动基准恢复。
- npm 102 项通过；Rust automation 45 项通过（3 项原有环境测试默认忽略），core 13、storage 9 通过；边界、fmt、workspace/all-targets Clippy -D warnings、TypeScript/Vite及预算通过。新增测试覆盖容器与全部新字段往返、轮询成功/超时/取消/嵌套截止、模拟原生阻塞取消、点位无效拒绝、按键所有权/释放及部分发送失败清理、子任务共享变量/单次调用/标签隔离/循环拒绝/坐标基准转换。
- 独立浏览器使用实际编辑器和模拟原生边界：验证位置模式切换隐藏固定坐标，结果模式开关写回积木，任务下拉打开时刷新且不提供当前任务；新增积木内联参数正常，无控制台警告/错误。截图 target/automation-actions-qa.png、target/automation-actions-flow.png。修正位置来源 input/change 双事件导致重复加载截图的问题。
- native_smoke --module-position 在开发及发布实际模块均通过：使用测试窗口自己的截图模板，带 (10,3) 区域偏移找到中心 (50,22)，等待条件退出，变量点击发送到测试窗口的后台鼠标消息也为 (50,22)。此验收不发送前台键盘输入。最初尝试按键实机验收时，Windows 未把焦点交给测试窗口，断言在发送按键前拒绝；按键释放采用可注入发送器测试，真实前台按住/松开和跨显示器 DPI 切换仍待人工验收。
- scripts/verify-blockly-native.mjs 对开发、发布模块均验证固定历史脚本读写/迁移、原有17步执行与新的调用等待流程：子任务计数3次后返回父任务，notice=调用完成 3.0，父进度4/5。结果分别 target/blockly-native-GdWNgL、target/blockly-native-qcjJX5。最初并行运行两个独立模块碰到全局停止热键冲突，改为串行后通过；这些验收不应并行。
- 最终 modules:sync 与 Tauri release --no-bundle --ci 通过（最终桌面编译1分16秒）。开发模块 engine-cceede22c723141d.exe，发布模块 engine-6c5a5742fc385806.exe；发布宿主 target/release/moligod.exe 已更新，开发宿主由现有监听更新。应用225.1KiB/245KiB、Blockly746.5KiB/770KiB。
- 核对当前开发版仍持有旧引擎后，通过原生界面确认两项任务均空闲，关闭并重新打开自动化助手标签，确认原两项任务保留且自动选择首项；进程路径已切换到 engine-cceede22c723141d.exe，原生积木库显示按住/松开。未运行、保存或删除用户任务。截图 target/automation-actions-native.png。

## 2026-10-27 左侧点击拿起、右侧放置

- 阻止左侧鼠标单击直接复制积木；点击保持拿起状态，移入右侧后再次点击放下，按住拖放仍可用。仅在右侧有效区域放置后记录 BlockCreate；左侧移动/放回、Esc、失焦、切页及只读切换取消，不写任务、不增加垃圾桶条目或空撤销记录。
- 新增3项事件生命周期测试，npm共105项通过；TypeScript、依赖边界、Vite与体积预算通过。Rust执行及协议未改动。
- 真实Blockly隔离浏览器验证：单击左侧后右侧仍只有原1个等待，无未连接警告；右侧放置并吸附后恰为2个等待；传统拖动成功新增；左侧范围内拖动不添加；Esc取消保持原脚本；撤销/重做分别恢复1/2个等待。取消已开始的拖放后，一次撤销直接撤销上次有效添加，没有空记录。无控制台警告或错误，截图 target/blockly-pickup-only.png 与 target/blockly-pickup-placed.png。未修改或运行用户任务。
- modules:sync 与最终 Tauri release --no-bundle --ci 构建通过（桌面编译1分33秒）。开发界面由现有Vite更新，发布程序 target/release/moligod.exe 已更新；两套引擎同步核对为 cceede22c723141d / 6c5a5742fc385806（本次执行器未变）。应用225.1KiB/245KiB，Blockly749.0KiB/770KiB。

## 2026-10-27 最近30次删除回收站

- 删除复位视图与旧垃圾桶按钮，替换为回收站；记录最新30次删除，完整恢复分组与参数，保留快捷键撤销/重做。历史仅存在当前编辑器生命周期内，界面明确提示；不修改用户任务格式或Rust执行器。
- npm108项、TypeScript、依赖边界、Vite和体积预算通过。新增测试覆盖35次删除裁剪、相同内容独立计数、原快照隔离、完整ID集合撤销清理及恢复时只重置Blockly ID、不修改动作内部字段。应用225.6KiB/245KiB，Blockly750.6KiB/770KiB。
- 隔离浏览器实际Blockly验证：Delete删除分组及内部等待后一次恢复完整分组；连续删除35次只保留35至6共30条；恢复35秒等待后计数29、Ctrl+Z变30且积木删除、Ctrl+Shift+Z变29且恢复。控制台无警告或错误。截图target/blockly-recycle.png。未操作用户任务。
- modules:sync与Tauri release --no-bundle --ci通过（桌面编译1分22秒）。开发源码由现有Vite更新，发布程序target/release/moligod.exe已重建；开发/发布引擎同步核对为cceede22c723141d / 6c5a5742fc385806（本次执行器未变）。

## 2026-10-27 固定积木面板和等待条件两行布局

- “等待条件”时限和检查间隔移至第二行，原参数及执行语义保持不变。积木库默认选中首类并常驻展开，保留分类切换、原有点击拿起和拖入右侧添加行为。
- npm108项、TypeScript、依赖边界、Vite和体积预算通过；应用225.6KiB/245KiB，Blockly750.9KiB/770KiB。首次TypeScript检查发现IFlyout接口未暴露setAutoClose，收窄到实际Blockly.Flyout后通过，未绕过类型检查。
- 实际Blockly隔离浏览器确认库及画布中等待条件均为两行；重复点击分类、点击画布及拖入动作后面板保持展开；新积木连接后正确输出waitUntil/endWaitUntil及原毫秒参数。单击拿起后Esc取消未增加动作。无控制台警告或错误，截图target/blockly-pinned-palette.png。未操作用户任务。
- modules:sync与Tauri release --no-bundle --ci通过（桌面编译1分23秒）。开发界面由现有Vite更新，发布程序target/release/moligod.exe已重建；两套引擎同步为cceede22c723141d / 6c5a5742fc385806，本次Rust执行器未变。

## 2026-10-28 左侧模块布局与全高画布

- 任务管理/模型设置/运行日志/快捷键设置改名任务/模型/日志/快捷键，四个面板移到左侧上方，动作分类与积木库在左侧下方，右侧画布使用完整高度。任务列表窄栏重排，原控件ID和操作逻辑保持。Blockly真实flyout高度/滚动条和工具箱位置同步调整，模板放到控制面板范围会取消。
- npm109项、TypeScript、依赖边界、Vite和预算通过。新增面板范围放置取消测试；旧拾取测试DOM替身补齐closest接口。应用226.7KiB/245KiB，Blockly752.1KiB/770KiB。
- 隔离浏览器使用实际HTML面板、实际Blockly和模拟任务列表，验证四标签切换、任务按钮换行、左右区域对齐、900×600与默认1280×720布局、分类切换、积木拖入右侧吸附和持续展开。控制台无警告/错误。截图target/blockly-left-dock.png。未运行、保存、删除用户任务；测试页面任务数据为临时样例。
- modules:sync与Tauri release --no-bundle --ci通过（桌面编译1分40秒）。开发源码由现有Vite更新，发布程序target/release/moligod.exe已重建；两套自动化引擎同步为cceede22c723141d / 6c5a5742fc385806（Rust执行器未变）。

## 2026-10-28 分隔线和循环次数

- 左侧分隔线支持拖动和方向键调整，调整时Blockly原生工具箱与积木库同步移动；任务操作固定第二行。循环由开关改为数字，0无限、1一次、其他值执行指定轮数，旧任务按原loop语义读取。增量保存repeatCount并保留旧loop以兼容已有任务导入。
- npm109项、Rust自动化45项通过（3项原有环境测试忽略）、依赖边界、格式和workspace/all-targets Clippy通过。Rust真实任务管理器测试保存并运行3轮、旧单轮及无限循环，前端测试验证导出3轮。浏览器隔离夹具验证实际拖动使上方高度267→380px，积木库高度相应缩短且底边不变，循环输入显示与按钮均在第二行；无控制台警告/错误。截图target/blockly-splitter.png。没有运行或保存用户任务。
- 最终modules:sync与Tauri release --no-bundle --ci通过（桌面编译1分19秒），开发引擎a00c604e3ae8976c、发布引擎8fbee7fabc92456b，发布主程序已重建。现有开发客户端仍运行旧引擎cceede22c723141d，未打断未知运行状态；重新打开自动化助手后加载新引擎。核心13项、存储9项通过。

## 2026-10-28 未选中任务行输入框

- 每个任务行均显示名称、间隔和循环次数；未选中任务可独立编辑、保存或导出，编辑按钮切换画布。其他行元数据按任务保留临时草稿，读取原脚本后合并，避免改变当前画布和覆盖其他动作；运行使用已保存任务。
- npm109项、TypeScript、边界检查通过。任务控制器测试编辑未选中任务并验证导出次数、保存名称/间隔/次数和原脚本完整性，同时确认当前画布未被切换。
- 隔离浏览器加载真实任务控制器和模拟两个任务，未切换画布将第二行改名、改间隔和次数后保存，重读显示新值；未操作用户真实任务，无控制台警告或错误。截图target/task-row-inputs.png。
- modules:sync与Tauri release --no-bundle --ci通过（桌面编译2分35秒），开发界面与发布程序更新；自动化引擎未改动，版本a00c604e3ae8976c / 8fbee7fabc92456b。现有运行中的开发客户端仍持旧引擎，未打断任务；停止后重新打开自动化助手加载新引擎。应用231.0KiB/245KiB，Blockly752.1KiB/770KiB。

## 2026-10-28 任务行两行布局及直接编辑

- 未选中任务原有“编辑”按钮导致操作行换行，扩大操作行宽度并收紧间距，固定在第二行；根据后续要求删除编辑按钮，点击输入框或任务行直接切换任务。极窄宽度保留横向滚动，所有按钮仍可达。
- 任务控制器针对切换的现有测试更新为直接点击任务行。隔离浏览器验证点击未选中名称后切换到对应任务且输入焦点保留；两条任务操作均在同一行，无控制台警告或错误。未触碰用户任务。截图target/task-actions-direct.png。
- npm109项、TypeScript、依赖边界通过；最终modules:sync及Tauri release --no-bundle --ci构建通过（桌面编译1分28秒），开发界面与发布程序同步更新，Rust引擎未变。应用231.0KiB/245KiB、Blockly752.1KiB/770KiB。

## 2026-10-28 修复新任务缺少手柄和桌面拖动排序

- 回归命令node --test tests/automation-task-actions.test.mjs在修复前明确失败：unsaved task must have a reorder handle。去掉仅已保存行创建手柄的限制，草稿参与本地排序、保存后继承位置。Windows桌面原拖放配置未关闭原生file-drag，本地Tauri schema说明HTML5 DnD需要禁用该配置；改用Pointer Events绕开拦截，不改变全局窗口拖放设置。
- npm112项通过；新增测试覆盖未保存行手柄、上下移动/刷新保位、无HTML拖放事件时指针排序、取消/界外放下、边缘静止连续滚动和帧清理。TypeScript、边界、Vite与预算通过，应用232.2KiB/245KiB，Blockly752.1KiB/770KiB。
- 隔离页面实际任务控制器+Blockly验证已保存任务[a,b]拖成[b,a]；新草稿拖到第二位[b,"",a]，保存后为[b,newID,a]。控制台无警告/错误，截图target/task-sort-fixed.png。原生桌面验证在拖动前被用户输入中断，停止操作，没有完成原生鼠标验收；没有改动用户任务或顺序。
- modules:sync与Tauri release --no-bundle --ci通过（桌面编译1分28秒），开发源码与发布主程序同步更新；开发/发布自动化引擎沿用a00c604e3ae8976c / 8fbee7fabc92456b，本次未修改原生执行器。

## 2026-10-28 任务开始拖动

- 根块此前setMovable(false)，Blockly把从根块开始的拖动转为画布平移；现允许根块移动，保留不可删除、无前后连接的约束。
- npm112项通过；隔离真实Blockly浏览器拖动根块从(695,45)到(840,200)，内部等待随根块移动，主画布transform始终为translate(203.4,0) scale(0.9)，没有画布平移。截图target/task-start-drag.png。
- modules:sync、TypeScript/Vite/预算、边界和Tauri release --no-bundle --ci通过，发布编译1分27秒；开发界面与发布主程序已同步更新，Rust执行器未改动。

## 2026-10-28 画布提示位置和白边

- 提示条左边距改用完整侧栏宽度auto-dock-width而非仅分类栏宽度，右边距改为12px；移除Blockly默认MainBackground浅色stroke，保留外层深色边框。
- 实际隔离Blockly页面生成未连接积木，验证侧栏右边404px、提示左边416.8px，文字完整位于右侧画布；背景stroke从rgb(198,198,198)变为none。截图target/canvas-warning-fixed.png。未改动用户任务。
- npm112项、TypeScript/Vite/预算、依赖边界通过；modules:sync与Tauri release --no-bundle --ci通过，发布编译1分26秒，开发界面及发布主程序已同步。Rust执行器未修改。

## 2026-10-29 任务列表底栏

- 删除“我的任务”和任务数量标题行，并移除任务数量更新代码。
- 新建任务、导入任务移到列表下方固定底栏；列表独立滚动，保留上下分隔线拖动。
- 实际 Blockly / 任务控制器隔离页面验证两条任务、底栏布局，截图：target/task-footer.png；未操作用户任务。
- npm test：112 项通过；依赖边界检查、TypeScript/Vite/体积预算通过。开发与发布原生模块同步完成。
- 最终样式再次完成桌面发布构建（1m26s），target/release/moligod.exe 已更新。

## 2026-10-29 新建导入任务卡片
- 按用户澄清，取消固定底栏，将新建/导入作为任务列表末尾的独立卡片，使用同样的边框、宽度和圆角；按钮增加加号和导入 SVG 图标。
- 卡片随列表滚动，不参与任务排序；重绘保留原按钮及事件绑定。更新任务列表测试夹具，112 项测试通过，边界检查通过。
- 浏览器实际控制器验证卡片位于最后并可滚动显示完整，截图 target/task-create-card.png。
- TypeScript/Vite/体积预算通过；开发与发布模块同步完成，桌面发布版构建通过（1m33s），target/release/moligod.exe 已更新。

## 2026-10-29 修复任务卡片重绘空元素异常
- 根因：任务列表 replaceChildren() 暂时将新建/导入卡片移出文档；紧接着 selection 回调里的 controls() 用 document.getElementById 查询导入按钮并设置 disabled，得到 null。
- 使用 replaceChildren(createCard) 保持卡片附着于文档，重绘完成再移到列表末尾。
- 测试按真实 DOM 层级把导入按钮放到卡片内，selection 回调执行实际的禁用状态更新；修复前复现 Cannot set properties of null (setting 'disabled')，修复后 npm test 全部 112 项通过。测试 DOM 的 replaceChildren 同步支持传入节点。
- 依赖边界、TypeScript/Vite/体积预算检查通过；原生模块开发/发布同步完成。
- 桌面发布构建通过（1m13s），target/release/moligod.exe 已同步修复。

## 2026-10-29 空任务入口可见性
- 删除任务列表内的大块“暂无任务”占位提示，空列表只保留新建/导入卡片，避免入口被挤出视口。右侧提示方向从上方改为左侧。
- 更新空列表回归断言，112 项测试、依赖边界、TypeScript/Vite/预算检查通过。
- 隔离页面使用实际任务控制器、空后端列表验证入口直接可见，并点击新建成功展示任务和 Blockly 编辑器。截图 target/task-empty-fixed.png。未操作用户任务数据。
- 开发/发布模块同步完成；桌面发布构建通过（1m11s），target/release/moligod.exe 已更新。

## 2026-10-29 固定侧栏工作台（所选草图1）
- 顶部当前任务设置/操作，完整任务列表按需展开；固定积木库，底部可折叠日志，右侧模型/快捷键面板，右下画布工具。
- 拖放禁区使用面板实际矩形；新增全宽工具栏下方可放置积木的回归测试。任务操作测试覆盖顶部容器和旧夹具两条路径。
- npm test：114项通过；npm run test:core：core 13、storage 9通过；npm run check:boundaries、npm run build、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings均通过。
- 前端本体235.5KiB / 245KiB；懒加载Blockly及媒体751.4KiB / 770KiB，无预算放宽。
- IAB真实浏览器检查1602×892及820×720，页面与工具栏无横向溢出。新建、导入、模型/快捷键面板、日志折叠/切换、积木拖入与连接、游离积木校验、适应画布通过；console warn/error为空。
- 证据：artifacts/layout-option1/workbench-wide.jpg、workbench-narrow.jpg；布局验收：design-qa.md。测试脚本只导入浏览器草稿，不操作用户任务文件、不执行输入/OCR。
- npm run tauri -- build --no-bundle通过，模块开发/发布同步通过；release构建1m17s，target/release/moligod.exe已更新。
- 未完成：真实桌面多DPI布局、真实游戏运行；本次不宣称完成原生运行或性能验收。

## 2026-10-29 底部工具栏、浮动日志与任务列表整理
- 回收站/放大/缩小/适应画布移动到积木库正下方，与右侧日志入口同一固定行；未打开任务时不显示活动画布工具。
- 日志默认收起，展开时绝对定位向上覆盖画布；点击外部或按Esc收起。浏览器测得展开前后编辑区均为 x=102、y=197、width=1468.4、height=641，位置/尺寸完全不变。
- 任务列表统一显示名称、执行摘要、状态；参数在顶部编辑。未选中任务保留运行/停止，导出/保存/删除收入同样的深色“更多”菜单。删除使用警示文字色；菜单不再使用浏览器默认灰色按钮。
- 修复点击行内details菜单误触发行选择；回归测试保持其他任务操作不覆盖当前草稿。隔离页面实测保存“价格识别”只向其ID发送task-save，顶部仍选中“等待任务”。
- npm test：114项通过；依赖边界、TypeScript/Vite/预算通过。本体240.5KiB/245KiB，Blockly及媒体751.5KiB/770KiB。
- IAB检查1602×892及820×720，无文档横向溢出；日志浮层、Esc、任务选择、多个任务菜单、对应任务保存通过，console warn/error为空。证据：artifacts/layout-refinement/workbench.jpg、floating-log.jpg、task-list.jpg、task-menu.jpg。
- 测试只使用浏览器草稿和内存后端，不操作用户任务，不执行真实鼠标键盘/OCR。真实游戏/多DPI运行仍待用户验收。
- npm run tauri -- build --no-bundle：通过，模块开发/发布同步通过；release构建1m05s，target/release/moligod.exe已更新。

## 2026-10-29 当前任务导出/删除直接按钮
- 按用户要求撤下当前任务顶部的“更多”菜单，将导出、保存、删除、运行/停止直接并排显示；删除保留警示文字色和原禁用条件。
- 沿用原事件与任务ID，未修改导出格式、归档删除或执行逻辑。其他任务列表的行内菜单保持原状。
- npm test：114项通过；依赖边界、TypeScript/Vite/预算通过，本体240.2KiB/245KiB，Blockly及媒体751.5KiB/770KiB。
- 浏览器确认顶部直接显示五个按钮，当前窄视口无横向溢出。截图：artifacts/layout-refinement/direct-buttons.jpg。未实际删除用户任务。
- npm run tauri -- build --no-bundle通过，release构建59.18s；target/release/moligod.exe已更新。

## 2026-10-29 画布工具移到分类栏下方
- 按用户标注，将回收站、放大、缩小、适应画布及日志按钮收进左侧分类栏底部；分类列表预留空间，必要时独立滚动。
- 日志仍浮动展开，浏览器测得展开前后编辑区位置与尺寸不变；未改变脚本或任务文件。
- npm test 114项通过，依赖边界、TypeScript/Vite及预算通过（本体241.4KiB/245KiB，Blockly751.5KiB/770KiB）。
- 浏览器实际切换流程控制，检查放大、缩小、适应画布、回收站及日志开关；console warn/error为空。截图：artifacts/layout-refinement/tools-under-categories.jpg。
- 桌面版 npm run tauri -- build --no-bundle 通过，release 构建 1m16s，target/release/moligod.exe 已更新。

## 2026-10-29 回收站与日志改为分类面板
- 移除“适应画布”；放大、缩小置于回收站上方。回收站、日志入口按左侧分类样式显示，内容占用原积木库区域。
- 浏览器验证：拖出等待积木、删除、打开回收站并恢复；日志/回收站/动作分类切换及键盘 Enter 返回动作分类通过。回收站恢复后积木放在画布，按原规则需要连接才能保存。
- npm test 114项通过；依赖边界、TypeScript/Vite和预算检查通过（前端244.1KiB/245KiB，Blockly资源751.7KiB/770KiB）。实际游戏运行未验收。
- 截图：artifacts/layout-refinement/log-category.jpg；验证使用浏览器草稿，没有操作本机任务数据。
- npm run tauri -- build --no-bundle 通过，release 构建1m17s；target/release/moligod.exe已更新。

## 2026-10-29 回收站精简与日志标签布局
- 回收站仅保留单行数量标题，移除关闭按钮、说明和空状态文字；删除记录及恢复操作保留。
- 日志的识别日志、执行日志标签平分面板宽度，减少顶部留白，日志内容保留内边距。
- npm test 114项通过；依赖边界和前端构建通过（本体244.4KiB/245KiB，Blockly资源751.4KiB/770KiB）。
- 浏览器预览验证回收站空状态、删除后数量更新与恢复，以及两个日志标签切换；截图：artifacts/layout-refinement/log-tabs-full-width.png。使用预览草稿，未操作本机任务数据。
- npm run tauri -- build --no-bundle 通过，release 构建 1m15s；target/release/moligod.exe 已更新。

## 2026-10-30 分类与嵌套积木交互设计稿
- 草稿位于 artifacts/design-drafts/automation-nesting.html，沿用现有五类动作及左下角工具；分类增加图标，演示条件、文字和数值三种参数嵌套。
- 浏览器验证分类切换、条件与数值积木拆出和重新嵌入、文字积木嵌入提示、拆出后直接输入值回显、类型不匹配不吸附、恢复示例和 820px 窗口布局；控制台未见 warn/error。
- 草稿只在浏览器内存中演示 Blockly，未接任务存储或原生执行引擎；未改变正式编辑器与用户任务。截图为 artifacts/design-drafts/automation-nesting.png。

## 2026-10-30 等待条件拆分交互草稿
- 在独立设计稿中增加“等待直到”及可拆出的“变量不为空”条件；示例保留内部动作、最长等待和检查间隔，并展示先执行内部动作再检查条件的现有语义。
- 浏览器验证可将条件从等待中拆出并放入如果中，两个示例可切换；检查 820px 窗口及控制台，未见警告或错误。截图：artifacts/design-drafts/automation-wait-condition.png。
- 草稿未接入原生执行引擎、正式编辑器或任务存储；没有修改或运行用户任务。

## 2026-10-30 借鉴动作、条件和取值的组合用法
- 更新独立交互草稿：保留原五类动作，增加“条件与取值”；空值判断内可嵌入和拆出变量值，比较和与/或/非条件可组合；输入参数保留直接填写方式。
- 分离没有内部动作的“保持等待直到”和带动作容器的“重复执行直到”。提供重复直到、等待条件、条件嵌套三个可切换示例；查询式找图条件每次重新识别的语义仅为设计，尚未接入原生执行。
- node --check通过；浏览器实际验证两层拆装、数值不能连接到条件、条件嵌入逻辑组合、直接输入数字、示例切换及820px窗口。控制台未见warn/error。
- 截图：artifacts/design-drafts/automation-block-usage.png；交互规则及后续接入边界：artifacts/design-drafts/automation-block-usage.md。正式编辑器、任务格式与执行器未改动，用户任务未操作。

## 2026-10-30 开发服务断开后的积木模块加载恢复
- 用户报动态加载 automation-blockly-workspace.ts 失败。排查时1420无监听，localhost与127.0.0.1对模块请求均连接被拒绝；没有活跃桌面开发宿主。仅凭截图无法确认服务此前退出的历史原因。
- 通过标准 npm run tauri -- dev 恢复完整桌面启动链路；开发模块同步成功，target/debug/moligod.exe 已启动，未另启独立预览服务抢占1420。
- 原模块路径现返回HTTP200、text/javascript；浏览器从工具箱进入自动化助手并新建内存草稿，实际积木库与画布加载正常，控制台warn/error为空。未操作本机任务。截图：artifacts/diagnostics/automation-module-restored.png。
- 此次为开发运行环境恢复，未改动业务代码或任务数据；HTTP请求检查作为故障复现与恢复验证，无新增单元测试。

## 2026-10-31 正式动作编辑器接入嵌套条件与取值

- 范围仅动作积木、编解码和原生执行；没有接入草稿的导航、任务栏或其他样式，也没有修改全局 CSS、HTML 或新增依赖。增加条件与取值分类；数字/文字/条件可嵌套，普通动作保持序列连接；保持等待和重复执行直到具有不同的原生语义。
- 固定版本2夹具 tests/fixtures/automation-values-v2.json 经真实 Blockly 序列化后原样还原。旧版本1固定夹具仍保持逐字段不变；移出取值恢复 shadow、类型不匹配、孤立积木、未知输入版本、动作组和分支变更均已覆盖。
- npm test：118通过；npm run test:core：22通过；cargo test -p moligod-automation --locked：46个库测试及6个新集成测试通过，原有3个需独立快捷键/真实OCR环境的测试继续忽略。新测试覆盖实时查询每次重评估、逻辑短路、无隐藏变量赋值、父取消/本地超时、重复等待、跳过分支、错误类型、子任务版本/坐标缩放和未来输入文件覆盖保护。
- npm run check:boundaries、npm run build、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings 均通过。前端资源244.9 KiB/245 KiB，懒加载 Blockly及媒体760.4 KiB/770 KiB，预算未提高。
- npm run tauri -- build --no-bundle 完成，target/release/moligod.exe 已重建；开发和发布自动化模块均同步，分别为 engine-8dbb0f22d6b5964d.exe、engine-41b2b50754ebb97f.exe。
- 实际模块协议验收串行通过开发和发布模块：target/blockly-native-aOkWGQ/result.json、target/blockly-native-bYDCNB/result.json。新嵌套夹具任务保存/重载/执行均成功，total最终为9，文字中的 ${这是文字} 保持字面内容，没有发送原生鼠标/键盘输入。首次并行运行两套验收竞争全局停止快捷键，发布验收失败；改为串行后两套通过，非产品失败。
- 浏览器在正式 / 界面实际拖入等待及计算，比较条件嵌入保持等待，未连接警告随正确吸附清除；实际导出确认 schemaVersion 2 和完整输入树，控制台 warn/error 为空。另实际验证实时查询弹窗隐藏结果变量/保存位置，关闭后普通识别动作恢复这些原有选项。截图 artifacts/verification/automation-values-integrated.png。验证草稿在浏览器，与本机任务隔离；未运行、覆盖或删除用户任务。
- 边界：新查询的调度/类型/取消由模拟 Driver 验证，未把实际游戏画面OCR或找图效果标为本次验收通过。现有桌面开发进程仍驻留旧自动化引擎，关闭后重开助手标签会在无运行任务时释放旧引擎并加载新清单；未强制中断该进程或任务。

## 2026-10-31 条件积木半宽吸附

- 原问题已用实际 Blockly 策略/连接检查器复现：node --test tests/automation-blockly-snap.test.mjs，半宽偏移时原规则返回 false，测试失败；原逻辑仅按连接点固定半径判断。
- 取值积木的横向搜索范围增加自身一半宽度；纵向保持原范围，远距离仅接受空位或默认 shadow。保留类型、循环引用、安全检查及普通动作连接规则，键盘无限距离遍历不受影响。没有修改全局样式、任务格式、IPC、Rust 执行器或用户数据。
- 新增4项回归覆盖左右半宽接入、不同宽度/缩放、越界与相邻行、类型不匹配、真实取值防误替换、键盘和普通动作规则；npm test 122项通过。npm run check、npm run check:boundaries 通过。
- 正式浏览器 / 中，从积木库将宽约318px的比较条件放到目标左端约160px右侧，松手直接替换默认表达式，仍只有一个连接栈，无孤立积木警告；撤销一次恢复原表达式，重做恢复嵌套。控制台 warn/error 为空。截图：artifacts/verification/automation-half-width-snap.png。验证使用隔离浏览器草稿，没有修改或执行本机任务。
- npm run tauri -- build --no-bundle 成功，target/release/moligod.exe 已重建；开发/发布原生模块同步完成，执行器内容未变。资源预算244.9 KiB/245 KiB，懒加载Blockly和媒体760.9 KiB/770 KiB，未提高预算。

## 2026-10-31 积木库内拾取后跟随鼠标

- 将库内 pointermove 交给已有 Blockly 手势，并停止画布外边缘自动滚动；保留二次点击放置、Esc 和库内取消，以及临时拖拽取消时的撤销保护。
- 正式浏览器隔离草稿中验证等待和计算积木：点击后鼠标仍在积木库内移动时，积木即跟随；继续移动后可进入画布、吸附任务并通过二次点击放置；Esc 后临时积木消失。截图 artifacts/verification/automation-palette-follow.png，控制台 warn/error 为空。
- npm test 123项通过，包含库内移动、取消、画布放置、拖出和只读行为；npm run check、npm run check:boundaries 通过。npm run tauri -- build --no-bundle 重建桌面版，开发和发布模块同步；未修改原生执行器或真实任务数据。

## 2026-10-31 改为按住拖动并消除边界画布位移

- 按用户最新要求取消“单击后拾取”。单击松开后移动鼠标不创建积木；只有左键按住才跟随，松手在画布内放置、在积木库内取消。相关回归测试更新，npm test 123项通过；npm run check 和 npm run check:boundaries 通过。
- 复现并修复两处画布位移：新卡片跨积木库边界时触发边缘自动滚动，以及创建临时副本时内容范围重算造成首次约28.8px横向、25px纵向跳动。临时拖拽禁用边缘滚动，创建时恢复原视口并补偿拖动偏移。
- 正式浏览器草稿中记录主画布变换：拖动前、按住运行任务卡片并在边界525/550/530/555/535px往返、松手取消后均保持 translate(273.8000000000002, -25) scale(0.9)。单击后鼠标移动仍为1个块堆；按住拖入等待并松手可正常吸附，控制台warn/error为空。
- 截图 artifacts/verification/automation-held-drag-stable.png；验证未保存或运行本机任务。桌面版通过 npm run tauri -- build --no-bundle 重建；原生执行器和任务格式没有变化。

## 2026-10-31 表达式独立为条件与取值积木

- 新计算、保持等待、重复直到、如果/分支及停止判断不再内置表达式卡片，只显示类型插槽；条件与取值分类提供独立的布尔与数值表达式。移除后保持空位并阻止保存/运行，不自动补回旧值。
- 旧脚本表达式加载为真实可拆积木，保留未编辑的旧字段及断言语义；固定版本1/2夹具往返测试继续通过。新增空位、独立条件连接、数值表达式连接与旧字段往返、拆出不恢复默认值的回归覆盖；半宽吸附夹具改为空插槽，保留不远距离替换真实值的保护。
- npm test 126项通过；npm run check:boundaries、npm run build通过。正式浏览器隔离草稿中实际拖入保持等待，确认空位警告；从条件与取值拖入比较条件后正常连接并清除警告。变量分类中的计算显示空插槽；控制台warn/error为空。截图 artifacts/verification/automation-expression-sockets.png、automation-expression-connected.png。未修改或运行本机任务。
- npm run tauri -- build --no-bundle成功，release编译59.52s，target/release/moligod.exe已更新。开发及发布模块同步完成；未修改原生执行器、IPC、持久化格式或其他界面样式。资源预算244.9 KiB/245 KiB，懒加载Blockly和媒体761.8 KiB/770 KiB，未提高预算。

## 2026-10-31 统一保存变量并移入基础操作

- 移除独立计算动作模板；统一“将【值】保存为【变量名】变量”，归入基础操作，取消变量处理分类。旧计算动作使用同一文案显示，仍保存原类型、表达式及输入树；没有迁移或覆盖用户文件。流程控制原分类颜色保留。
- npm test 126项通过，统一保存动作接入独立数值表达式、版本2输入往返、旧计算卡片显示及原字段往返均通过；既有固定版本1/2夹具继续通过。npm run check:boundaries、npm run build通过。
- 正式浏览器隔离草稿中确认五个分类及基础操作唯一的保存动作；将“1+1”取值实际拖入后吸附为嵌套参数，无未连接提示，控制台warn/error为空。截图 artifacts/verification/automation-save-basic.png；未操作本机任务。
- npm run tauri -- build --no-bundle成功，release编译1m16s，target/release/moligod.exe已更新；开发和发布模块同步完成，原生执行器未改。资源244.8 KiB/245 KiB，懒加载Blockly和媒体761.9 KiB/770 KiB，预算未提高。

## 2026-10-31 移除两种等待动作模板

- 动作库移除保持等待直到、重复执行直到及其结束标记，取消保持等待的额外模板注入；新流程复用普通循环、如果、退出循环及等待。旧等待积木仍可加载、编辑和保存，未修改其原生执行或超时语义，未自动迁移用户文件。
- npm test 127项通过：新增动作库只提供通用条件/循环的覆盖，同时验证两种旧等待、内部动作、条件、超时和间隔原样往返。原固定版本1/2夹具继续通过。npm run check:boundaries及npm run build通过；资源244.8 KiB/245 KiB，懒加载Blockly和媒体761.9 KiB/770 KiB。
- 正式浏览器隔离草稿中实际打开流程控制，确认条件判断直接显示如果/停止判断，后面为循环、退出循环、下一轮和跳转；没有两种等待模板。控制台warn/error为空，截图 artifacts/verification/automation-flow-simplified.png。未操作本机任务。
- npm run tauri -- build --no-bundle成功，release编译1m04s，target/release/moligod.exe已更新；开发及发布模块同步完成，原生执行器内容未变。

## 2026-10-31 缩短基础动作与独立停止任务

- 窗口卡片为切换窗口【选择窗口】，分组卡片为新建分组【分组名】；变量卡片参考迷你世界官方动作赋值说明缩成设置【result】为【值】，参数、变量名及嵌套计算仍可编辑。新动作库不再提供注解；旧注解继续保存，不转成运行提示。
- 条件停止模板改成无插槽的停止任务卡片，支持放入如果内；通过既有常真正向assert原生语义执行，无新增动作协议。旧条件停止、注解、计算及版本1/2固定夹具继续原样往返。
- npm test 129项通过；新增短文案、无注解模板、可编辑变量目的地、停止块无条件插槽及如果内嵌套保存/重载覆盖。npm run check:boundaries、npm run build通过；资源244.9 KiB/245 KiB，懒加载Blockly和媒体762.1 KiB/770 KiB，预算未提高。
- scripts/verify-blockly-native.mjs新增无限循环中的条件停止验收，串行验证开发与发布模块均通过：target/blockly-native-JrYlLY/result.json、target/blockly-native-3eUl2z/result.json。计数到2即返回phase=stopped、running=false、round=1，后续after变量不存在，整轮repeats=0也没有继续；包括既有保存、重载、嵌套取值及子任务验收，没有发送原生输入。
- 正式浏览器隔离草稿中核对四项外观改动，拖入独立停止块正常连接任务开始，没有条件输入或孤立积木提示，控制台warn/error为空。截图 artifacts/verification/automation-compact-actions.png。未修改、运行或删除本机用户任务。
- npm run tauri -- build --no-bundle成功，release编译1m10s，target/release/moligod.exe已更新；开发与发布原生模块同步完成，执行器内容未改。

## 2026-10-31 三角洲行动前台鼠标测试排查

- 用户的三角洲行动前台左键动作（客户区 140,183，按住30ms）在“测试动作”中复现“第 1 步：移动鼠标失败”。未发送左键，未运行完整任务。
- 临时诊断通过独立原生 Driver 重现：ClientToScreen 成功，SetCursorPos 返回0；在同一环境仅对当前鼠标位置调用 SetCursorPos，先清除线程错误码后仍返回0，GetLastError 为0，无法据此判断具体原因。诊断代码和临时示例已移除；最初未清除错误码得到的2不作为根因。
- 尚未证明是否由游戏、安全软件、桌面权限或其他环境因素导致；未实现绕过或宣布修复。正常窗口对照、运行环境差异以及真实目标窗口成功点击仍待验证。
- 后续对照：用户反馈相同功能对 QQ 界面可用。独立诊断进程在 Explorer 前台时，读取并设置鼠标当前位置成功；三角洲行动前台时，相同调用返回0且清零后错误码仍为0。该对照不发送鼠标按键，说明差异与前台状态相关，但不足以确定拦截方或证明任何替代输入方式有效。临时诊断示例已清理。
- 用户指出管理员启动问题；只读检查当前进程令牌，三角洲行动、重启后的 moligod 及其自动化模块均处于提升权限。此前失败进程的令牌未留样；本次没有重放游戏点击，因此权限不一致是否为此前失败的唯一原因以及提升后的点击结果以用户实测为准。

## 2026-10-31 模态弹窗打开时拖动窗口

- 主窗口模态弹窗的遮罩命中标题栏时，左键按下使用已授权的 Tauri startDragging；弹窗自身区域不触发，未改变遮罩外其他区域和弹窗取消逻辑。关闭弹窗后原标题栏继续沿用既有拖动区域。清理了同一选择器后续全局规则覆盖的重复 CSS 声明，前端预算没有提高。
- 新增事件测试覆盖标题栏遮罩、弹窗本体、非模态、右键和标题栏外位置；最终针对性测试通过。npm test 130 项、npm run test:core 22 项、npm run check:boundaries、npm run build、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings 通过。资源 250835 字节 / 250880 字节，Blockly及媒体 762.1 KiB / 770 KiB。
- 隔离浏览器打开实际模态弹窗，测得标题栏遮罩命中 DIALOG 且 :modal 为真；此验证不含 Tauri 拖动。npm run tauri -- build --no-bundle 通过并生成 target/release/moligod.exe；当前管理员权限桌面进程未中断，原生拖动仍需在桌面实测。

## 2026-10-31 按键积木录入 Esc

- 修复按键字段将 Esc 委托给 Blockly 取消编辑的问题；现在按下 Esc 作为键值27写入，按键、按住按键、松开按键共用此录入，Tab 保持原导航行为。其他控件和弹窗的 Esc 处理未改。
- 修复前针对性回归测试显示字段仍为“空格”，修复后通过，三个动作序列化均为 [27]。隔离浏览器实际将按键积木放入工作区，点击字段后按 Esc，显示 Esc，离开编辑后保留；未执行本机任务或向游戏发送 Esc。
- npm test 131 项、npm run test:core 22 项、npm run check:boundaries、npm run build、cargo fmt --all -- --check 和 cargo clippy --workspace --all-targets --locked -- -D warnings 均通过。npm run tauri -- build --no-bundle 完成，target/release/moligod.exe 已更新。真实游戏中的 Esc 输入尚未实测。

## 2026-10-31 动作积木范围与独立多选

- 左键单选，Shift 单击同一块堆内另一动作选中之间的动作，按动作树顺序包含条件容器及其可见内部动作；Ctrl 单击切换单项。不同块堆间 Shift 从新动作重新开始。选择只存在于画布，运行、载入、删除和拖动时清理，任务格式不变。输入字段、齿轮按钮和 Blockly 单块拖动保持原行为。
- 为避免多选时 Blockly 只删除焦点上的单块，在工作区多选时拦截 Delete/Backspace；尚未提供多选批量删除或移动。空白点击清除选择。
- 新增选区模型测试覆盖正反范围、嵌套顺序、切换、跨块堆及清理；隔离 Blockly 页面实际验证首尾 Shift 选中6块含条件内2块、Ctrl 只选首尾及逐项取消、Delete 后6块仍在、字段修改可用，普通拖动清除多选且仍可拖动。没有读取或修改用户任务。
- npm test 132 项、npm run test:core 22 项、npm run check:boundaries、npm run build、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings 均通过；npm run tauri -- build --no-bundle 完成并更新 target/release/moligod.exe。资源预算应用245.0/245 KiB、Blockly及媒体764.7/770 KiB；未中断正在运行的桌面程序，原生实机多选尚未复验。

## 2026-10-31 多选动作一起拖动

- 多选时可按住任一选中动作拖动；连续或不连续的动作按原树顺序合并，选中容器时保留其内部动作并避免重复抽取子项。拖动预览按连接偏移计算，使抓住后面的不连续动作也贴住鼠标；绿色标记显示吸附点。松手后仍保持选中，可再次整组拖动。任务数据只在有效放置时更改；Esc、失焦、指针取消或画布外松开不改变任务。
- 每次移动的连接调整归入一个 Blockly 撤销组；注入目标连接失败测试验证原动作树恢复，撤销不破坏任务。自动测试覆盖不连续跨层移动、条件容器与选中子项、插入分支及原内容保留、撤销重做和失败回滚。
- 隔离真实 Blockly 画布验证：不连续动作一起拖出并再次接回、连续动作吸附到末尾、从末尾拖入条件分支、条件及内部动作同时移动、一次撤销/重做、Ctrl 保持按下拖动、Esc 和画布外取消。14个动作的长选区从最后一个拖动时，预览显示被抓住的动作和前12个，其余用数字提示；取消后14个动作及选区保留。控制台无错误或警告；没有读写或执行用户任务。
- npm test 137 项、npm run test:core 22 项、npm run check:boundaries、npm run build、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings 通过。npm run tauri -- build --no-bundle 完成，target/release/moligod.exe 已更新；当前桌面进程未中断，原生拖动尚待实机验收。多选拖动不提供边缘自动滚动；选区的批量删除未实现。
- 按 ADR-028 将按需加载的 Blockly 及离线资源预算由770提高至771 KiB，实测770.7 KiB；主应用预算245 KiB不变。任务格式、IPC和原生执行未改。

## 2026-11-01 识别文字参与数字比较

- OCR（包括仅保留数字）继续保存文字；数字类型的变量或表达式取值按既有表达式规则解析有效的有限数字文字，不修改保存值，空文字、无效数字和非有限值仍报类型不匹配。
- 修复前以模拟 OCR 返回文字 `785` 的执行器测试复现“变量或查询结果与取值积木类型不匹配”；修复后验证 `785 < 785` 为假、`784 < 785` 为真，原变量仍为文字，并覆盖无效值。
- `cargo test -p moligod-automation --locked` 通过（53 项通过、3 项忽略）；`npm test` 137 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check` 和 `cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过。发布模块通过 `node scripts/verify-blockly-native.mjs` 独立任务验证文字 `784` 的数字比较及原变量保留，记录 `target/blockly-native-JLD4Ho/result.json`；未发送鼠标键盘输入。
- `npm run tauri -- build --no-bundle` 完成，开发和发布模块已同步，桌面程序已重建。未运行用户游戏任务或实测游戏画面的 OCR；已有进程需重新启动以加载更新后的自动化模块。

## 2026-11-01 数字比较再次报错与识别状态排查

- 用户再次反馈类型不匹配。只读核对进程，当前加载的开发模块 `engine-0680b748869d92ae.exe` 是上次修复后的版本；无法从截图判断本次执行时的 OCR 结果。管理员窗口高于界面检查工具权限，未能读取识别日志；游戏任务没有重放。
- 使用快速返回空字符串的模拟 OCR 复现：条件随后失败时，状态回调仍停留在 OCR 前，识别日志可能遗漏结果。OCR 动作完成后立即发布状态；数字文字为空或无法解析时分别提示。回归测试修复前失败、修复后通过，未把无效值转换为零。
- `cargo test -p moligod-automation --locked` 通过（54 项通过、3 项忽略）；`npm test` 137 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check` 和 `cargo clippy --workspace --all-targets --locked -- -D warnings` 通过。尚需用户提供此次的实际识别值，确认本次报错的原因。
- `npm run tauri -- build --no-bundle` 完成，开发和发布模块已同步；发布模块 `node scripts/verify-blockly-native.mjs` 独立验收通过，记录 `target/blockly-native-aA92lE/result.json`。现有管理员进程未中断，需重启才加载新模块。

## 2026-11-01 任务窗口捕获会话复用与快捷键排查

- 任务原生驱动按窗口按需复用 WGC 会话，任务结束、切换目标或失败后释放；无请求时不复制像素。根据 WGC 帧的系统时间排除请求之前的帧；250ms 无新帧时在保留原会话的同时调用独立单帧捕获，避免静止窗口卡住或复用旧图。手动预览仍为单帧。
- 独立非激活窗口 WGC 测试通过：同一会话读取静止画面及更新后画面，内容发生变化，取消令牌阻止后续读取并释放会话。未触及用户游戏或任务；真实游戏窗口、黄色边框表现及释放仍需实机确认。
- 用户确认 Ctrl+3 刚启动时有效，约两分钟后失效时游戏在前台且任务仍运行；只读设置确认 Ctrl+3。独立的已有测试表明 Windows 热键消息送达后能取消所有任务，不能证明游戏前台按键消息一定送达。尚未复现真实失败，没有声称修复；原因及前台输入环境仍待现场定位。
- `npm test` 137 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 和 `cargo test -p moligod-automation --locked`（54 通过，5 忽略）通过。发布模块的隔离任务验收通过，见 `target/blockly-native-Ma56yY/result.json`。持续截图时发布版全进程树资源和游戏帧率尚未测量。
- 独立线程注册测试快捷键并运行 120 秒后，通过 `PostThreadMessageW` 发送模拟 `WM_HOTKEY`，取消令牌在两秒内触发，测试通过；该测试不代表真实键盘事件或持续 OCR 负载。`npm run tauri -- build --no-bundle` 完成，开发与发布模块已更新，当前进程未中断。

## 2026-11-01 本地动作组件库

- 左侧增加组件库，可将选择的一个或多个动作保存为命名分组；按动作树顺序组合，选择容器时保留内部动作并避免子项重复。副本通过现有 Blockly 拖放接入任务，组件名可用于辨识并可单独删除。动作参数与取值树由现有编解码器保存；跨已知缩放使用现有坐标换算，缺少有效缩放时拒绝放置。
- 浏览器隔离夹具中实际 Shift 多选三步，保存为“我的测试组件”，从组件库拖入画布并连接到任务开始；分组中的三步与原三步均保留。夹具使用内存后端，没有读取或改写用户任务。自动测试覆盖不连续选择、容器与子项去重、源任务不变和缩放副本转换。
- 模块组件数据使用版本1 JSON、本地原子替换；测试确认增加、读取、删除、重复 ID 拒绝，以及损坏和未来版本文件保持原字节。发布模块独立 RPC 验收了组件追加、读取、删除，见 `target/blockly-native-4qJSm6/result.json`，没有发送原生输入。
- `npm test` 139 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 和自动化 crate 测试通过。`npm run tauri -- build --no-bundle` 及最终 `npm run modules:sync` 完成；前端预算依据 ADR-029 调整。当前桌面进程未中断，真实桌面中的组件操作和发布版全进程树资源占用尚未实测。

## 2026-11-01 组件库右键保存及删除位置

- 移除库内“保存选中动作”按钮，顶部显示右键保存及 Shift/Ctrl 多选提示；动作原有右键菜单增加“保存成组件”，右键已选动作维持多选，右键未选动作只选中该动作。每个组件的删除按钮显示在名称行右侧，仍需确认，支持回车和空格；刷新后重新定位。组件持久化和脚本格式不变。
- 隔离 Blockly 页面实际验证单个动作直接右键、Shift 选择三步、Ctrl 选择首尾两步并通过右键保存，组件内部动作与范围一致。验证新增第二项后两条删除按钮仍在各自标题右侧，鼠标和回车删除隔离组件后显示空库；生产删除确认未关闭。未读写用户任务或组件。
- `npm test` 139 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 及 `npm run tauri -- build --no-bundle` 通过。按 ADR-029 后续决定调整按需资源预算；真实桌面操作待重启后复验。

## 2026-11-01 组件展开与空库提示

- 每个组件标题右侧增加独立“展开/收起”，默认收起；展开后可拖拽完整组件，删除仍在旁边。展开状态保留于当前编辑器，未写入组件文件。空库时居中显示两行操作提示，有组件后隐藏；删除最后一项恢复提示，切换分类隐藏提示。
- 使用隔离内存夹具验证空库水平及垂直居中、保存后提示消失、两项独立展开收起、展开后拖入画布、删除两项后提示恢复；25 项列表滚动后展开第18项，列表位置保持。回车展开及空格收起后焦点仍在按钮上。没有读写用户组件或任务。
- `npm test` 139 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 及 `npm run tauri -- build --no-bundle` 通过；依据 ADR-029 后续决定调整按需资源预算。真实桌面需重启后复验。

## 2026-11-01 组件名称与排序

- 在隔离内存 Blockly 夹具中点击标题修改名称，验证标题与展开后的分组名称同步；将组件向上、向下跨多个标题拖动，验证顺序调整。测试没有读写用户的组件和任务。原生单元测试验证名称及顺序落盘重读、组件动作保留、非法名称/目标拒绝及损坏或未来版本文件保持原字节。
- `npm test` 139 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings`、自动化组件单元测试通过。开发版和发布版模块分别在独立临时数据目录通过重命名、排序及读取 RPC 测试；并行运行时快捷键冲突，串行重试通过。前端构建实测主程序246.3 KiB、按需编辑器及离线资源782.5 KiB。
- `npm run tauri -- build --no-bundle` 已完成，输出 `target/release/moligod.exe`；桌面版需要关闭并重新启动后复验实际交互。真实用户组件未用于测试。

## 2026-11-02 设置变量分类调整

- 将“设置”变量动作从基础操作移到条件与取值分类顶部，使用相同的动作格式和编辑方式；已有任务及旧计算动作保持兼容。
- 隔离 Blockly 页面实际从新分类拖入设置动作，并将 `1 + 1` 放入取值插槽。Node 自动测试覆盖基础分类不再展示、目标分类只有一个设置动作、设置动作保存重读及旧计算动作往返；没有读取或修改用户任务。
- `npm test` 139 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过；`npm run tauri -- build --no-bundle` 已构建桌面版并同步开发版和发布版模块。桌面应用需要重启后验证实际界面。

## 2026-11-02 合并按键动作

- 隔离 Blockly 页面验证鼠标键盘分类只有一个按键模板，拖入任务后可选点击、按住、松开，点击显示持续时间而按住不显示。自动测试覆盖旧按键动作及窗口字段、按键值与持续时间原样往返，三种模式转换、撤销重做、Esc 录入和保存重读。没有读取或执行用户任务。
- `npm test` 141 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过。开发版和发布版模块独立验证三种动作的原生解析，不发送按键输入。`npm run tauri -- build --no-bundle` 已构建桌面版；实际桌面和游戏内输入仍需重启后复验。

## 2026-11-02 按键留白及输入文字文案

- 隔离 Blockly 页面对照确认按键下拉框贴近积木左侧；从分类拖入任务并连接至等待动作后，下拉菜单仍可打开，输入文字积木在同一分类显示完整名称和输入槽。未访问用户任务。
- `npm test` 141 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 通过；`npm run tauri -- build --no-bundle` 已构建桌面版并同步模块。实际桌面效果需重启后复验。

## 2026-11-02 按键下拉框位置

- 为按键积木的第一行增加顶部间距，避免下拉框遮住上方连接缺口；积木自身高度随之调整。隔离 Blockly 页面检查了分类预览、拖入任务后的连接与下拉菜单，没有访问用户任务。
- `npm test` 141 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check` 和 `cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过；`npm run tauri -- build --no-bundle` 已完成。桌面应用需重启后复验。

## 2026-11-02 运行状态栏提示与自适应尺寸

- 提示放在状态信息之后；短内容收紧窗口，长内容达到显示器宽度才换行。隔离浏览器页面验证短提示单行（666×52 逻辑像素）、800 像素上限的长提示和 320 像素窄屏三任务布局，没有读取或执行用户任务。
- 独立原生 WebView 窗口验证居中、置顶、不抢焦点、短提示保持单行、长提示换行、迟到尺寸请求和隐藏请求被拒绝、结束后自动收起。初测发现 Windows 无边框外框导致居中偏移，按实际外框修正后通过；退出时仍有既有 WebView2 窗口类注销警告。未在真实游戏窗口上验证。
- `npm test` 141 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 和 `npm run tauri -- build --no-bundle` 均通过。

## 2026-11-02 合并数字、文字与变量取值

- 隔离 Blockly 页面验证在分类中切换为变量后直接拖入“提示”，以及将变量连接到等待和数字比较；没有访问用户任务。自动测试覆盖三种模式、旧积木往返、保存重读、撤销重做、删除后的插槽默认值、非法数据和未来版本拒绝。
- `npm test` 144 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check` 和 `cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过。自动化模块测试通过 48 个单元测试、11 个集成测试（另有 5 个忽略）。开发版和发布版原生模块均在隔离数据目录验证新积木保存、读取和执行，包括数字变量提示及数字文字比较。主程序资源 247.0 KiB，按需编辑器及离线资源 785.8 KiB。
- `npm run tauri -- build --no-bundle` 已完成，输出 `target/release/moligod.exe` 并同步开发版、发布版模块。未在实际游戏和 OCR 窗口验证；桌面程序需重新启动后复验。新积木任务使用新的输入格式，旧程序不能打开该格式。

## 2026-11-03 按键操作下拉框位置

- 按键积木调整为“按键 [按键值] [点击/按住/松开]”，原来的动作类型和序列化不变。隔离 Blockly 页面验证动作库及画布的位置，下拉框可以切换为按住，持续时间相应隐藏；没有读取或运行用户任务。
- `npm test` 144 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 及 `npm run tauri -- build --no-bundle` 通过，桌面应用重启后还需实际查看。

## 2026-11-03 自动变量及比较规则

- 隔离 Blockly 页面确认新比较模板中的变量不再要求选择数字或文字。自动测试验证模板编辑及输入版本 3 保存重读，旧格式原样往返；数值文字参与算术及大小比较，无效或空文字报错。原值比较覆盖文字 `001` 与数字 `1`、不同文字、相同文字、数值相等，旧类型变量及旧版自动变量相等规则不变。真实用户任务未用于测试。
- `npm test` 144 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过；自动化模块 48 项单元测试、12 项集成测试通过，另有 5 项忽略。开发版及发布版模块在临时数据目录验证新比较保存、重读和执行，未发送原生输入。
- `npm run tauri -- build --no-bundle` 已完成，输出 `target/release/moligod.exe`。新比较格式需要更新后的程序；真实桌面和游戏需重启后复验。

## 2026-11-03 OCR 数字结果

- 新配置仅保留数字保存数值，空识别保存空值；测试 0、前导零、负数、小数、无数字、无效数字和超出安全范围。旧动作仍返回原文字；确认旧动作设置才启用新格式。动作、实时查询及脚本调用覆盖版本保护、存取与运行；未读写用户任务。
- 隔离浏览器页面实际勾选“仅保留数字”。离线 CPU OCR 使用仓库图片与空白图，经 small/tiny 模型识别后检查数字和空值；未在游戏窗口验证。开发版和发布版模块在临时目录验证含 numericResult 的任务解析、保存及读取，未发送游戏输入。
- `npm test` 146 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 和 `npm run tauri -- build --no-bundle` 通过；自动化模块 50 项单元测试、13 项集成测试通过，另有 5 项默认忽略；模块预览测试 1 项及单独运行的离线 OCR 测试通过。桌面程序已输出 `target/release/moligod.exe`；新格式任务需要更新后的程序。

## 2026-11-03 图片匹配保存选点

- 在浏览器隔离任务验证查找图片两行布局。选点夹具验证点击、方向键微调、确认、重新打开及取消，取消保留已确认的点。自动测试覆盖缩放预览映射、边缘像素、模板点与搜索区域的不同 DPI 处理、保存重读与旧动作保留。
- 原生合成图片匹配验证默认中心及自定义角点，越界选点明确失败。开发版及发布版模块在临时目录验证模板导入、读取、无效标识拒绝、版本4任务保存和读取，未发送游戏输入。
- `npm test` 149 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 通过；自动化模块 51 项单元测试及13项集成测试通过，5项默认忽略。真实游戏中的模板与点击需重启后复验。
- 标准桌面构建因正在运行的 `target/release/modules/automation/engine.exe` 被 Windows 锁定而失败（os error 32）。本次改用独立 Cargo 输出目录 `target/template-point-desktop`，复用已同步的模块资源构建，避免关闭用户当前编辑器。
- 独立桌面构建完成，使用 `CARGO_TARGET_DIR=target/template-point-desktop`，命令为 `npm run tauri -- build --no-bundle --config '{"build":{"beforeBuildCommand":"npm run build"}}'`，输出 `target/template-point-desktop/release/moligod.exe`。打包的自动化模块 SHA-256 与清单一致（`803398169257e24814ae8284ecb5d67a516f57403607e85cb109564bffd33f88`）。未启动新版或关闭用户当前进程。

## 2026-11-03 精简条件与取值入口

- 从“条件与取值”的新建模板移除“不满足”“找到图片”和“读取文字”；识别截图分类提供独立识别动作，结果通过变量参与判断或运算。旧任务中的取反与实时查询继续使用既有编解码及执行器。
- 自动测试验证工具栏移除三类模板、普通识别动作仍可创建，以及旧取反、图片查询和数字 OCR 查询加载、保存后的数据一致。`npm test` 149 项、`npm run test:core` 22 项、边界检查、前端构建、Rust 格式检查及 Clippy 均通过。前端实测主程序253.2 KiB、按需资源786.1 KiB。
- 桌面版构建完成，输出 `target/template-point-desktop/release/moligod.exe`。使用独立 Cargo 目录与已完成的前端构建，`beforeBuildCommand` 设为 null，复用已同步并再次校验清单的发布模块。当前运行的程序位于 `target/release`，新版界面待重启后验收。

## 2026-11-03 条件与取值整理

- 常用区显示五个模板，通用比较取代两个比较预设；取值下拉框包含数字、文字、变量、真/假及空值。新建且/或提供带提示的空条件槽，接入后隐藏提示并重算积木布局。高级区域默认收起，展开后显示条件表达式与计算表达式，正则位于条件表达式中。
- 隔离浏览器页面实际检查展开、收起及键盘回车连续切换，按钮焦点保留；从库内切换真假模式后拖入赋值，再切换为空值，连接有效；逻辑积木接入左右条件后提示与留白收起，缺少条件时显示补全提示。比较模板直接切换运算符及右侧模式，得到 `result ≠ 空值`。截图位于 `target/condition-values-optimized-20261103`。实际桌面界面待用户重启验收。
- `npm test` 152 项、`npm run test:core` 22 项、边界检查、Rust 格式检查及 Clippy 通过。前端构建主程序253.2 KiB，按需资源787.8 KiB，通过按架构记录调整后的788 KiB上限。
- 开发版与发布版自动化模块分别在 `target/blockly-native-F2a1LZ`、`target/blockly-native-vtNSTb` 通过任务保存、读取及执行验收，确认空值、假和其组合判断结果。使用隔离数据目录与纯变量动作。
- 最终桌面构建通过，输出 `target/template-point-desktop/release/moligod.exe`，打包模块与 SHA-256 清单一致。构建使用独立 Cargo 输出目录并读取已验证的前端产物及模块包，用户当前运行的编辑器保持打开。

## 2026-11-03 比较积木取值切换卡住修复

- 修复前通过 `node --test --test-name-pattern 'editing comparison operands in the palette' tests/automation-blockly.test.mjs` 稳定复现左侧切换文字后脱离父比较积木，断言实际父项为空。浏览器在积木库中重复同样操作，复现子取值重叠及默认0恢复的画面。
- 比较输入改为允许各类取值编辑，消除模式切换和运算符切换触发的自动脱离。回归测试覆盖左右文字与真假切换、运算符切换及序列化克隆保留值。浏览器两侧选择文字、填入 `test`、选择相等后从外壳整块拖出，两个输入与运算符保留。截图位于 `target/comparison-mode-fix-20261103`。
- `npm test` 153 项、`npm run test:core` 22 项、边界检查、前端构建、Rust 格式检查及 Clippy 通过。前端主程序253.2 KiB、按需资源787.8 KiB，通过现有预算。验证数据来自隔离测试目录和内存页面。
- 开发版及发布版模块分别在 `target/blockly-native-nSP4S0`、`target/blockly-native-BEEI6z` 完成保存、读取、文字比较及嵌套取值执行验证。
- 桌面构建完成，输出 `target/release/moligod.exe`，模块与清单 SHA-256 校验一致。同时更新 `target/template-point-desktop/release/moligod.exe` 并核对主程序副本一致，两个发布入口均包含本次修复。运行中的开发版需重新打开分类或重启后复验。

## 2026-11-09 动作序列完整性与优化检查

- 本轮检查当前源码及既有验收记录，没有修改功能代码、重放用户任务或重新构建桌面程序。`npm test` 153 项通过；`cargo test -p moligod-automation --locked` 51 项单元测试、13 项集成测试通过，5 项默认忽略；依赖边界及前端构建通过。主程序资源253.2 KiB，按需编辑器及离线资源787.8 KiB。
- 使用临时的纯引擎测试夹具复现两项问题，驱动在任何原生输入请求时直接失败，测试后已删除夹具源码：`maxRunSeconds=1`、`repeats=2`、`intervalMs=2000`、单步等待0毫秒时，约2001毫秒才报告最长运行时间，轮次间隔没有按总截止时间截断；先赋值 `price=123`、第二步计算 `1 / 0` 时，最后上报状态仍为第一步且变量为空。后者结合原生错误处理复用最后上报状态、停止后清除积木高亮的实现，会影响失败定位。这两项尚未修复。
- 源码检查确认：任务运行入口按ID加载已保存任务，没有同步当前编辑草稿，也没有为已保存任务的未保存修改提供专门标记；导出仅输出脚本JSON，没有附带找图模板或被调用子任务，导入时任务轮次间隔恢复为1000毫秒。这些行为应在后续补充保存/运行语义及可迁移任务包时处理。
- 编辑能力待补充：多选删除、批量复制、长选区拖动的边缘滚动、变量名称补全与运行前引用检查。暂停/继续、单步和断点属于新增执行能力，实施前需明确按住键释放及恢复、运行时限和识别结果过期规则。
- 性能优化候选：任务状态推送目前调用整份任务列表重绘；积木更改会全量序列化和校验。建议先用长序列及多任务负载测量，再按实际热点合并刷新或局部更新。本轮没有测量真实游戏帧率、持续OCR的发布版全进程树占用，不能据此断言存在可感知卡顿。
- 真实游戏前台紧急停止的既有问题仍缺现场复现和闭环验收；本轮没有执行默认忽略的热键耐久、OCR硬件或WGC窗口测试。实机多DPI、窗口失效、长时间运行及退出资源回收仍需专项验收。

## 2026-11-10 OCR 整数显示与旧比较分支类型兼容

- 修复前执行 `cargo test -p moligod-automation --locked integer_ocr_results_display_and_compare -- --nocapture`，稳定得到提示实际为 `587.0`、预期为 `587` 的断言失败。只读检查已保存任务后，使用纯引擎夹具重现数字比较后的旧文字空字符串分支，`cargo test -p moligod-automation --locked legacy_text_branch_after_numeric_ocr -- --nocapture` 稳定返回变量或查询结果与取值积木类型不匹配。
- 整数 OCR 保存为 JSON 整数，旧文字取值读取数字时进行文字转换。回归测试覆盖 0、前导零、负整数、安全整数边界、真实小数、旧指定数字类型及自动变量的六种比较运算，并验证数字比较后的旧文字分支正常结束。识别空值及无效数字继续由现有专项测试检查。
- `npm test` 153 项、`npm run test:core` 22 项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 均通过。`cargo test -p moligod-automation -p moligod-automation-module --locked` 通过 52 项引擎单元测试、15 项集成测试及 1 项模块预览测试，另有 5 项默认忽略。
- 开发版和发布版分别通过 `node scripts/verify-blockly-native.mjs --dev` 和 `node scripts/verify-blockly-native.mjs`，使用隔离目录 `target/blockly-native-XSiAGy` 和 `target/blockly-native-vnTmT9` 中的纯变量任务验证保存、加载及原生模块执行，包含旧文字变量读取数字后与空字符串比较。
- `npm run tauri -- build --no-bundle` 完成，输出 `target/release/moligod.exe`，开发版、发布版、打包目录及桌面资源中的模块均通过 SHA-256 清单校验。发布自动化模块 SHA-256 为 `afe29a30dcbc397a67d44a5f0fc4d9eb2f8be5860ec217e07d108d0fd5d3a4b4`。真实游戏 OCR 和当前编辑器加载新模块待重启后复验。

## 2026-11-10 组件名称原位编辑

- 点击组件名称后直接在标题行显示输入框，并全选当前名称。回车或失焦保存，Esc 取消；空白、控制字符和超过60个字符的名称提示错误并保留编辑状态。进入运行状态、刷新组件或关闭编辑器时取消当前编辑。
- `node --test tests/automation-component-name.test.mjs` 4项通过，覆盖原位尺寸、名称保存、键盘焦点恢复、失焦单次提交、取消、名称校验、中文输入法候选确认、运行锁定、编辑器释放及保存失败。
- 在开发服务器的 `tests/fixtures/automation-components.html` 隔离内存页面实测点击原位编辑、回车保存、Esc 取消、点击画布失焦保存、无效名称校验、中文候选确认、展开后的分组名称同步及标题拖动排序。25项列表滚动到第18项后编辑，以及窗口调整到900×700后再次编辑，输入框与标题位置一致。检查并匹配原名称字体，截图位于 `target/component-name-inline.png`。
- `npm test` 157项、`npm run test:core` 22项、`npm run check:boundaries`、`npm run build`、`cargo fmt --all -- --check` 和 `cargo clippy --workspace --all-targets --locked -- -D warnings` 通过。前端主程序实测252.0 KiB，按需编辑器及离线资源789.0 KiB，分别通过254 KiB及本轮调整后的790 KiB上限。
- 本轮验证使用开发服务器与浏览器隔离夹具。实际客户端中的组件库交互待重新打开后复验。

## 2026-11-10 主导航与资料管理页精简

- 设置迁至右上角搜索与窗口控制之间；工具箱、收起侧栏依次固定在左侧底部。删除全部工具、通用工具、三角洲行动三个侧栏入口及资料管理页面、渲染逻辑和返回路由。发现页保留导入导出与折叠草稿入口，详情页保留编辑和删除，未删除本机资料。
- `npm test` 153 项通过，`npm run test:core`、`npm run check:boundaries`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings` 通过。
- `npm run build` 的 TypeScript 检查与 Vite 打包完成，最后体积预算检查失败：主资源251.9 KiB / 254 KiB，未在本次修改的按需 Blockly 编辑器及离线资源789.0 KiB / 788 KiB。未放宽预算。日志见 target/sidebar-tests.log、target/sidebar-core.log、target/sidebar-clippy.log。
- 本次仅修改前端，未重新构建或启动桌面 EXE；实际窗口中的标题栏位置、收起/展开、草稿与导入导出交互尚待界面验收。

## 2026-11-11 单窗口工具列表

- 启动改为窄工具列表；选择准星、自动化或设置后同窗口展开，左侧继续显示工具列表，返回列表恢复窄窗口。发现游戏不再初始化。没有新增工具窗口、网络请求或后台轮询。
- 增加main窗口专用布局IPC：工作区内展开/恢复、顶部鼠标离开延迟收缩、移入恢复及托盘恢复。贴边判定单元测试覆盖负坐标屏幕、DPI容差及远离边界。
- `npm test` 157项、`npm run test:core`、`cargo test -p moligod --lib --locked` 2项、`npm run check:boundaries`、`cargo fmt --all -- --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings`通过。前端构建主资源约211.1 KiB / 254 KiB，按需资源789.0 KiB / 790 KiB，通过预算。
- 浏览器独立1422预览验证左列表→准星、返回列表→自动化，同页显示正确。1420已有开发服务曾出现按需导入失败，独立服务加载成功。浏览器验证不证明Windows原生窗口尺寸或贴边行为。
- 当前开发版进程保留，未强制重启。Windows实机贴边收缩、恢复、多屏DPI及发布版全进程树测量待新版启动后验收。未执行用户自动化任务或开启准星。
- 最终 `npm run tauri -- build --no-bundle` 成功（release编译54.16秒），输出 `target/release/moligod.exe`；包含最后的恢复最小尺寸修正，主资源211.2 KiB，按需资源789.0 KiB。构建日志 `target/toolbox-desktop-build.log`。

## 2026-11-11 顶部滑入隐藏修正

- 用户截图显示Windows顶部Snap布局，指出期望QQ式保持尺寸向上滑入。上一版未实机验证且使用缩高实现，已按新要求替换。
- 先提取原折叠几何实际调用点并运行 `cargo test -p moligod --lib --locked hiding_moves_whole_window -- --nocapture`，回归失败：实际425×3、预期425×900。修正后通过：尺寸不变，负坐标显示器上隐藏位置为top-height+strip。
- `npm test` 160项通过（包含紧凑标题栏阻断原生拖动、松手无需mouseleave、展开模式/按钮不拦截、捕获丢失和动画期间mouseenter抑制），宿主3项测试、边界检查、Rust格式与Clippy通过；前端构建主资源211.6 KiB / 254 KiB、按需资源789.0 KiB / 790 KiB。
- 自动测试验证计算与事件调用链，不能证明真实Windows拖拽时的Snap抑制及动画观感；当前会话未提供原生桌面UI控制，实机交互仍须明确标为待验收。没有声称观察过QQ客户端的实际动画；实现依据用户截图与明确描述。查阅Microsoft窗口位置文档和Snap说明，未修改系统全局设置。
- 最终 `npm run tauri -- build --no-bundle` 成功（release 57.16秒），输出 `target/release/moligod.exe`。`npm run test:core`通过。
- 启动时确认没有其他moligod进程，已启动新版release并保留运行。全进程树采样5.21秒、7进程集合稳定，CPU单核口径0%，private 176.42 MiB、working set 397.13 MiB（共享页可能重复计数）。证据`target/top-slide-process.json`；这是短时空闲采样，不代表拖动动画或长时间运行负载。

## 2026-11-11 顶部悬停自动唤出

- 用户反馈需点击且滑出动画不明显。修正隐藏期间仅依赖WebView mouseenter的路径：原生每32ms检测顶部光标，未引用点击或焦点状态，触碰触发270ms平滑滑出。松手光标仍在边缘时必须先离开再进入。检测线程只存在于隐藏状态，恢复/不可见/最小化/窗口失效时退出。
- 160项前端测试、5项宿主测试（新增无点击顶部带命中及动画中间帧/终点）、边界、Rust格式、Clippy和前端构建通过。主资源211.6 KiB，按需789.0 KiB，预算内。
- 用户当前release进程保持运行；原EXE同目录重命名为`target/release/moligod.before-hover.exe`后构建新文件，避免强制退出用户窗口。新版须彻底退出旧进程后启动，单实例机制不会自动替换运行中代码。
- 原生桌面交互控制不可用，测试未覆盖真实悬停观感、WebView焦点边界和隐藏态进程树负载，未将单元测试当作这些项目的验收证据。
- 新版 `npm run tauri -- build --no-bundle` 成功（release 1m06s），产物`target/release/moligod.exe`。当前旧进程未退出，新功能尚未在用户运行窗口中生效。

## 2026-11-11 顶部唤出区域光标

- 针对用户反馈触顶前出现输入形状光标：窄列表非编辑表面显式cursor:default且不可文本选择；搜索框仍cursor:text。隐藏期间关闭原生resizable，避免露出的底边命中缩放手柄，滑出、DOM恢复及托盘恢复均重新开启。
- 5项宿主测试、Clippy和前端构建通过；主资源211.9KiB、按需789.0KiB，均在预算内。未新增镜像实现的测试。
- 用户进程保留；正在使用的EXE同目录重命名为moligod.before-cursor.exe，构建新moligod.exe。真实Windows触顶光标尚待新版验收。
- 桌面构建完成（release59.06秒），输出target/release/moligod.exe；当前运行的旧进程未重启。

## 2026-11-12 独立工具窗口

- main保持窄工具列表和顶部隐藏；点击工具打开固定独立窗口，去除侧栏、标签栏，保留原功能界面。重复点击唤回同一实例；关闭先隐藏保留编辑内容和任务，退出客户端统一回收。
- 160项既有前端测试及新增1项导航回归通过；7项宿主测试（包含窗口label范围和旧配置快照合并）、core/storage、边界检查、Rust格式与Clippy通过。前端构建主资源213.0KiB，按需789.0KiB，预算内。
- 首次桌面打包遇到用户运行中的target/release/modules下两项engine.exe锁定。保留进程，将旧宿主与两个旧engine.exe同目录改名为*.before-tool-windows.exe备份后重建；未停止或重放用户任务。
- 原生窗口打开、重复打开、隐藏恢复、选区结果回传及多窗口运行负载仍待新版实机验收，未声称单元测试覆盖这些真实交互。
- 最终桌面构建成功（release1m01s），输出target/release/moligod.exe；两项已打包模块均与manifest SHA-256一致。当前旧宿主及工具进程继续运行，新窗口行为需退出旧客户端后启动新版生效。

## 2026-11-12 窄面板视觉设计与网站导航

- 重排340×720面板：本地工具使用两张紧凑卡片，我的网站展示攻略站、博客及宝藏导航。删除设置齿轮/独立设置页与tool-settings能力，原托盘偏好开关移至底部，原值保留。
- 浏览器340×720实际截图确认全部入口和底部开关完整可见，截图target/launcher-design.png。浏览器预览中托盘开关禁用符合原生限制。网页href核对为三个目标HTTPS域名，原生open_website仅接受固定ID；未声称三个外站在线可用（网页抓取部分失败）。
- 161项前端测试、8项宿主测试、core/storage测试、边界检查、格式及Clippy通过。前端主资源217.0KiB、按需789.0KiB，预算内。
- 桌面打包首次遇到正在使用的模块engine.exe锁定，保留进程，将旧宿主/模块EXE同目录备份为*.before-launcher-design.exe后重建。真实原生浏览器唤起、当前窗口重启后样式及多窗口全进程树未实机复验。
- 最终桌面构建成功（release1m06s），产物target/release/moligod.exe。当前用户旧进程保持运行，需退出后启动新版。

## 2026-11-12 网站区域下移

- 删除底部“贴近顶部自动隐藏 · 鼠标触顶唤出”文字；网站组使用侧栏剩余空间下靠，位于托盘开关上方，并保留最小24px上间距。低窗口高度时继续使用已有侧栏滚动。
- 本次仅HTML/CSS轻量修改，TypeScript/Vite构建及体积预算通过（主资源216.9KiB，按需789.0KiB），未新增或重复执行无关测试。桌面重建日志target/websites-bottom-build.log。
- 运行中的旧进程保留，旧宿主及模块EXE同目录重命名为*.before-websites-bottom.exe以避免构建文件锁。新版需退出旧程序后启动；当前修改未重新实机截图验收。
- 桌面构建成功（release1m01s），产物target/release/moligod.exe。

## 2026-11-12 面板标题精简与网站图标

- 删除工具标题/数量/搜索框及其输入监听和无结果占位；删除网站组标题及“浏览器打开”说明。保留导航ARIA标签。顶部标题改为moligod工具箱，独立工具窗口仍使用各自标题。
- 网站符号替换为三张本地SVG：攻略战术三角、博客笔记页、导航宝石；统一40px尺寸与圆角，保留绿/蓝/金配色。未引入远程图标加载、生成图片依赖或新框架。
- TypeScript/Vite及体积预算通过（主资源217.8KiB、按需789.0KiB）；4项工具面板拖动与窗口导航定向回归通过。浏览器340×720截图检查标题、工具列表、三个图标和底部开关完整，截图target/panel-icons-preview.png。
- 本轮仅前端修改，未重复Rust检查；为提供可运行版本重新打包桌面，日志target/panel-icons-build.log。运行中的旧程序保留，宿主和模块旧EXE同目录备份为*.before-panel-icons.exe，需退出旧进程后打开新版。
- 桌面release构建成功，产物target/release/moligod.exe；旧进程保持运行，未声称已更新当前窗口。

## 2026-11-15 组件库导入导出与固定托盘行为

- 组件分类顶部提供整库JSON导入、导出，导入追加且重号重新分配ID，保持原组件、名称、动作树与缩放。前端用编解码器和无界面Blockly验证积木内容，失败后释放工作区并恢复全局撤销记录/分组，原生一次校验后原子保存。固定旧schema 1夹具覆盖缺少缩放及125%缩放，未知版本、未知库字段、损坏数据、重复ID、超100项与1MiB限制均有针对性回归。
- 删除主列表的托盘开关及相关样式/监听。关闭main固定隐藏，旧closeToTray字段仅保留格式兼容，托盘顺序为关闭准星、停止自动化、打开工具箱、退出工具箱。
- npm test通过164项，包含导入追加、导出版本和数据、超限/失败/运行态/销毁、损坏积木与全局撤销状态恢复。cargo test -p moligod-automation -p moligod --locked通过宿主8项、自动化54项及集成15项，5项既有依赖真实环境的测试保持ignored。npm run test:core通过core 13项、storage 9项。npm run check:boundaries、cargo fmt --all -- --check、cargo clippy --workspace --all-targets --locked -- -D warnings通过。
- npm run build通过，主资源216.8KiB，按需Blockly和离线资源790.8KiB。按需预算由790调整为791KiB，已记录架构原因。
- 浏览器隔离内存夹具实际选择本地旧版JSON，保留原有两组件并增加两组件，展开125%缩放组件成功。实际点击导出并解析下载文件，schemaVersion为1、包含4组件且缩放保留。截图target/component-library-preview.jpg。主面板浏览器检查确认托盘开关已移除。
- release自动化模块实际协议验收通过component-list/component-import，重复导入后的ID唯一、原动作树保留、未来版本及损坏本地文件拒绝覆盖，并成功导入浏览器实际下载的文件。结果target/component-transfer-protocol-result.json，所有操作使用target下隔离数据目录。
- npm run tauri -- build --no-bundle最终桌面release构建成功（1m04s），产物target/release/moligod.exe，日志target/component-transfer-desktop-build.log。release自动化模块与manifest SHA-256一致。用户原debug宿主保持运行。新版托盘原生交互、窗口关闭/唤回及release完整进程树负载仍待重启后实机复验，当前浏览器夹具和模块协议验收未覆盖这些项目。JSON仅包含模板ID引用，跨电脑所需图片资源需另外准备。

## 2026-11-15 单组件动作代码分享与按钮样式

- 根据补充要求，组件行提供导出、展开/收起、删除，导出立即复制该组件的紧凑schema 1 JSON到剪贴板。顶部导入按钮使用绿色描边和深色底，打开原生dialog，粘贴代码后复用原子追加。错误保留输入并行内反馈，取消/Esc关闭，导入成功后重绘列表并恢复导入按钮焦点。
- npm test通过165项，覆盖逐组件复制内容、鼠标与键盘、剪贴板拒绝、代码字节限额、错误可修改、取消/运行态/销毁关闭弹窗、导入提交去重和成功后的焦点。npm run check:boundaries及TypeScript/Vite构建通过，主资源218.1KiB、按需Blockly及离线资源790.8KiB，使用既有254/791KiB预算。
- 浏览器隔离内存夹具实际点击首项导出，通知复制成功。测试夹具通过用户点击读取真实navigator剪贴板，并在可见文本框中确认schema 1、只有该项组件、名称和100%缩放。将读取的完整代码粘贴到导入弹窗，先验证错误代码保留输入并显示错误，再修正为复制代码导入，列表从2项变为3项。取消后再次打开内容清空，Esc关闭并回到导入按钮。截图target/component-code-library-preview.jpg与target/component-code-import-dialog.jpg。
- 浏览器工具的虚拟剪贴板与页面Async Clipboard分离，验证采用测试夹具中明确点击的读取按钮，读取结果来自本轮生成的动作代码。release模块实际导入该剪贴板代码通过，结果target/component-code-protocol-result.json，数据目录位于target下。
- 最终桌面release构建通过（1m02s），产物target/release/moligod.exe，日志target/component-code-desktop-build.log。导入刷新后的键盘焦点恢复已通过定向断言及全部165项测试。桌面WebView中的实际系统剪贴板交互待新版实机复验。带图片识别的动作代码沿用模板ID引用，接收方需准备对应模板图片。

## 2026-11-15 删除组件深色确认框

- 组件删除使用原生dialog及现有深色弹窗样式，标题为删除组件，正文以textContent显示组件名。红色删除按钮与灰色取消按钮，取消默认聚焦，原生Esc关闭。确认才调用原删除接口，保存时提交去重，失败保留弹窗和错误供重试。任务运行和编辑器销毁关闭确认框。
- npm test通过167项，新增回归覆盖确认前与取消后组件保留、确认删除目标项、默认取消焦点、组件名HTML字符安全显示、失败重试、重复提交去重及运行/销毁关闭。npm run check:boundaries通过。
- 浏览器隔离内存夹具实际点击两项组件的删除按钮，确认框使用深色样式并显示对应名称，默认焦点在取消。回车执行默认取消、Esc关闭后均保留两项组件，焦点回到对应删除按钮。截图target/component-delete-dialog.jpg。
- TypeScript/Vite及体积检查通过，主资源218.5KiB、按需Blockly及离线资源791.9KiB。记录架构原因后按需预算从791调整为792KiB。npm run tauri -- build --no-bundle成功（release 1m06s），产物target/release/moligod.exe，日志target/component-delete-desktop-build.log。用户原debug宿主运行中，桌面WebView弹窗观感待实机复验。

## 2026-11-15 警告气泡延迟收起与导入按钮居中

- 点击参数警告图标显示气泡，鼠标位于气泡外开始3秒单次计时，移入取消，移出重新计时。每个气泡独立管理，使用Blockly的BubbleOpen、WarningIcon.getBubble及setBubbleVisible接口。关闭、积木删除和工作区销毁清理计时及监听，气泡脱离DOM时结束处理。
- 组件库导入按钮按flyout实际左右边界经SVG逆变换计算中心，适应空库及已有组件时的面板宽度。截图target/component-import-centered.jpg。
- npm test通过171项，新增4项气泡回归覆盖2999/3000毫秒边界、初始悬停、移入取消及移出重计时、多气泡独立与重开、手动关闭/删除/脱离DOM/释放。组件入口回归补充按钮中心点断言。npm run check:boundaries通过。
- 浏览器隔离夹具渲染3个真实缺少窗口的点击动作。点击警告后鼠标在外，等待3.1秒后气泡关闭。移入气泡并停留3.3秒仍显示，移出2秒后返回并停留1.5秒仍显示，再移出3.1秒关闭。按钮在有组件和空库两种面板实测中心均一致，分别约286.7及207.5像素。
- TypeScript/Vite及体积预算通过，主资源218.5KiB、按需792.9KiB，架构记录解释按需预算由792调整到793KiB。npm run tauri -- build --no-bundle成功（release 1m09s），输出target/release/moligod.exe，日志target/warning-dismissal-desktop-build.log。桌面WebView实际效果待新版实机复验。

## 2026-11-15 Ctrl滚轮缩放积木画布

- 启用Blockly现有zoom.wheel，结合已有move.wheel，由原滚轮入口处理Ctrl缩放与普通滚动。滚轮向上放大、向下缩小，范围使用既有30%–150%，鼠标位置交给Blockly进行定位。
- npm test通过171项，npm run check:boundaries及TypeScript/Vite体积检查通过，主资源218.5KiB、按需792.9KiB，使用254/793KiB预算。
- 浏览器实际Ctrl滚轮使主画布scale从0.9变为1.089，反向恢复0.9。普通滚轮使translateY从19变为-25且scale为0.9。左侧积木库上的Ctrl滚轮测试主画布仍为0.9，文档宽度为1280像素。截图target/ctrl-wheel-zoom-preview.jpg。
- npm run tauri -- build --no-bundle成功（release 1m04s），产物target/release/moligod.exe，日志target/ctrl-wheel-desktop-build.log。桌面WebView实际手感待新版实机确认。

## 2026-11-15 固定组件面板与独立横向滚动

- 左侧加减与Ctrl滚轮继续调整主画布，DockedFlyout固定组件及分类积木为90%。组件库宽度上限按编辑区总宽度1/4计算，各展开组件底部使用独立原生横向滚动条，平移flyout副本查看超长内容。标题根据可用宽度省略，保留完整名称与重命名入口。
- npm test通过174项，新增3项覆盖固定缩放与四分之一宽度上限、两个组件独立滚动和收起/销毁监听清理。组件管理9项回归覆盖标题和按钮，npm run check:boundaries通过。TypeScript/Vite及体积检查通过，主资源218.9KiB、按需796KiB，架构记录后按需预算从793调整为796KiB。
- 浏览器隔离内存夹具验证两次加号使主画布scale从0.9到1.089，而flyout维持0.9。1280px编辑区内组件面板宽320px。鼠标实际拖动两个滚动条得到387.2和291.2的独立位置，先前组件位置保持。两侧比例不同的情况下从库拖出完整分组及通知/等待子动作成功，原组件仍保留。截图target/component-preview-pan.png；拖出副本位于测试画布空白处，未连接提示符合原有保存约束。
- 本次仅修改前端，原生IPC、持久格式与Rust逻辑沿用现状。桌面WebView中的实际手感待新版实机确认。
- npm run tauri -- build --no-bundle成功（release 1m04s），产物target/release/moligod.exe，日志target/component-preview-desktop-build.log。

## 2026-11-16 重复开发启动报错排查

- 执行 `npm run tauri -- dev` 复现退出码1，Cargo报告无法删除 `target/debug/moligod.exe`，错误为 `Access is denied. (os error 5)`，Vite报告 `Port 1420 is already in use`。
- 进程及父进程核对确认原 `start-dev.bat` 启动链仍存活，debug客户端PID158452占用对应EXE，原Vite进程PID161604监听127.0.0.1:1420。EXE非只读，开发首页HTTP200且包含 `/src/main.ts` 入口。
- 源码确认主窗口关闭事件调用隐藏，托盘“退出工具箱”调用完整退出流程。重新编译启动前需退出客户端并结束旧开发启动窗口。
- 尝试通过已有单实例入口唤回客户端时，自动审批返回 `blocked by policy`，该操作未执行。原客户端和开发服务保持运行，唤回效果未验证。本轮仅排查并记录证据。

## 2026-11-16 TroveAuto 高级黑工具箱适配

- 读取参考项目当前 dark.css、Rare UI三个组件源码、RARE-UI.md、完整许可证、设计经过及toolbox-black.jpg。共享变量使用#101113炭黑底、深灰面板和银灰强调。36px标题栏、分组工具列表、准星预览/参数双栏、自动化顶部参数及底部日志均已适配，辅助窗口与任务状态条同步主题。Blockly编辑字段、默认值插槽及下拉菜单使用深色，分类选中改为银灰。
- GooeyNav采用原生CSS分段/圆角逻辑，140–180ms交互响应减少动态效果偏好。复用既有ARIA状态、事件和键盘流程。README、docs/rare-ui.md、源码头及public/licenses保留Rare UI署名、固定revision及完整许可。工具箱使用五个本地Lucide SVG及完整许可。
- npm test通过174项，npm run test:core通过13项核心及9项存储测试，npm run check:boundaries、cargo fmt --all -- --check及cargo clippy --workspace --all-targets --locked -- -D warnings均通过。共享CSS变量引用检查未发现未定义变量。
- TypeScript/Vite和既有体积预算通过，主资源约246.1KiB/254KiB，按需Blockly及离线资源约796KiB/796KiB。npm run tauri -- build --no-bundle完成，release构建1m12s，输出target/release/moligod.exe，日志target/graphite-desktop-build.log。
- 浏览器实际检查340×720工具箱及300×360最小窗口。300px宽下页面scrollWidth=300，侧栏内部scrollHeight433/clientHeight324，内容可在侧栏内滚动。工具入口实际打开对应独立浏览器预览，保留原生操作禁用反馈。
- 准星在1100×740及760×480检查，验证样式切换到图片及返回十字、生成准星码。760×480时内容区scrollWidth=clientWidth=750。自动化在1440×900及760×480检查，新建浏览器临时草稿、任务列表、模型、日志切换及分类交互通过。760×480时内容区scrollWidth=clientWidth=760，工具栏84px，日志下边界470px，操作与画布在窗口内。
- 沿用tests/fixtures/automation-components.html的隔离内存后端检查组件弹窗。导入弹窗使用#1b1c1f背景和#151619代码框，错误代码保留输入并显示错误，Esc关闭恢复入口焦点。删除确认默认聚焦取消，取消后组件保留。760×480下删除弹窗完整显示，836×528下导入错误弹窗完整显示。实际Blockly数字编辑框背景#151619、文字#dddde0。
- 截图保存于target/graphite-ui/launcher.jpg、crosshair-small.jpg、automation-small.jpg、import-small.jpg及delete-small.jpg。浏览器截图工具在大视口捕获时存在裁剪，已删除两张不完整的大窗口截图，默认窗口尺寸以DOM几何检查为证据。弹出的工具预览页记录了Electron sandbox_bundle初始化错误，来源为浏览器宿主，应用操作与页面检查完成；工具箱预览没有控制台错误。
- 本轮开发服务器已关闭，1420端口已释放。Windows原生WebView2、托盘、贴边隐藏、多屏DPI、原生选区/OCR及真实游戏执行未在本轮复测，需新版实机验收。

## 2026-11-16 选中及焦点白边调整

- 将共享表单焦点规则中的通用tabindex选择器排除Blockly内部节点，避免SVG分组和整块面板叠加矩形轮廓。Blockly工具箱及flyout外层取消轮廓，分类键盘焦点使用1px内收灰线，积木焦点复用原生轮廓描边并设置1.5px银灰色，强制颜色模式使用Highlight。
- 浏览器隔离组件库夹具验证鼠标选中、ArrowUp分类切换和Tab进入积木库。键盘聚焦分类时外层outline为none，内层细线向内偏移3px；Tab进入积木后实际焦点为blocklyPath，SVG轮廓及两块面板outline均为none。截图target/graphite-ui/focus-outline.jpg。
- npm test通过174项，npm run build及npm run check:boundaries通过。主资源约247.2KiB/254KiB，按需Blockly及离线资源约796KiB/796KiB。
- 构建时发现运行中的宿主及两个engine.exe锁定发布目录。将对应旧EXE在原目录改名为before-focus时间戳备份，继续生成新版程序。当前运行进程仍加载旧版界面，需退出托盘后重开新版进行原生WebView2验收。
- 单个积木选中描边实测为rgb(195,195,201)、1.5px，取消渲染器原有发光滤镜。存在校验错误的积木继续使用既有警示样式。
- 最终前端主资源约247.5KiB，沿用254KiB预算；桌面构建日志为target/focus-outline-desktop-build.log。已结束本轮Vite进程并释放1420端口。

## 2026-11-16 高级取值积木直接展示

- 删除“展开高级/收起高级”按钮及展开状态、回调注册，条件表达式和计算表达式直接追加在“条件与取值”的常用积木之后。
- 更新既有回归测试，验证默认7个积木、2个表达式、无展开按钮，继续验证正则切换及旧表达式重读。
- npm test通过174项，npm run build和npm run check:boundaries通过。主资源247.5KiB/254KiB，按需资源795.5KiB/796KiB。
- 浏览器隔离夹具检查首次选择“条件与取值”即展示两个表达式。截图target/graphite-ui/values-expanded.jpg。桌面构建日志target/advanced-values-desktop-build.log，新版WebView2效果需退出旧客户端后重开验收。
