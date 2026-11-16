# QQ 式工具列表改造进度

## 网站入口底部对齐（2026-11-16）

- 用户要求三个网站入口放在窗口最下方，并保留“关闭窗口后仍在系统托盘运行”提示。正常模式。
- 紧凑侧栏使用已有 flex 纵向布局，网站组通过 margin-block-start:auto 吸收剩余空间，底部提示采用固定组间距。
- 174 项前端测试、依赖边界与前端构建通过。Edge 无头预览的340×720截图确认网站组位于提示上方，顶部工具和底部网站之间保留弹性空白。截图位于target/launcher-bottom-preview.png。
- 原生WebView2窗口及小窗口滚动交互待新版实机复验。

## 独立组件面板与横向预览（2026-11-15）

- 用户要求左侧加减只缩放右侧画布，每个展开组件支持独立左右拖动查看，组件面板最大宽度按编辑区总宽度1/4处理。
- 正常模式。DockedFlyout复用getFlyoutScale固定0.9，getWidth限制组件分类宽度。展开预览底部使用独立原生横向滚动条，移动flyout内副本查看，复用既有积木拖出入口。
- 已实现固定缩放、宽度上限、窄标题适配与横向控制。3项预览定向测试、9项组件管理回归及TypeScript通过。
- 浏览器验证主画布0.9到1.089而组件库保持0.9；1280px编辑区内组件面板320px。两个组件分别滚动至387.2与291.2，互不改变，并在两侧缩放不同的情况下成功拖出完整组件。截图target/component-preview-pan.png。
- 完整174项前端测试、边界及前端构建通过。最终按需796KiB（815104字节），记录架构证据后预算调为796KiB。桌面release重建成功（1m04s），产物target/release/moligod.exe，日志target/component-preview-desktop-build.log。桌面WebView实际手感待新版实机确认。

## Ctrl加滚轮画布缩放（2026-11-15）

- 目标为右侧积木画布按住Ctrl滚轮缩放，普通滚轮继续滚动。
- 快速模式，启用Blockly现有zoom.wheel配置，复用其鼠标中心缩放及既有30%–150%范围。
- 已通过171项现有前端测试、边界及前端构建。浏览器验证Ctrl上滚0.9到1.089、下滚回0.9，普通滚轮平移，以及积木库滚轮范围。截图target/ctrl-wheel-zoom-preview.jpg。
- 桌面release重建成功（1m04s），产物target/release/moligod.exe，日志target/ctrl-wheel-desktop-build.log，verification已更新。桌面WebView实际手感待新版实机确认。

## 警告提示延迟收起和导入居中（2026-11-15）

- 目标为点击参数警告图标打开气泡后，鼠标连续位于气泡外3秒收起，以及组件库顶部导入按钮水平居中。
- 正常模式，按需监听BubbleOpen/删除事件和气泡pointerenter/leave，清理单次计时与监听，复用原生关闭接口。
- 13项定向回归通过，覆盖3秒边界、移入取消/移出重计时、多气泡及重新打开、关闭/删除/销毁清理、导入按钮中心点。前端构建按需792.9KiB，已记录架构证据，将预算调至793KiB。
- 完整171项前端测试、边界和前端构建通过。浏览器验证移入3.3秒保持、移出2秒返回取消计时、再次移出3.1秒关闭；有组件/空库按钮中心点均一致。截图target/component-import-centered.jpg。
- 桌面release重建成功（1m09s），产物target/release/moligod.exe，日志target/warning-dismissal-desktop-build.log，verification已更新。桌面WebView实际效果待新版实机复验。

## 删除组件弹窗（2026-11-15）

- 目标为将组件删除的浏览器默认确认框统一成现有深色界面，正常模式。
- 已实现原生dialog、默认取消焦点、红色删除按钮、组件名安全显示、保存去重与错误重试，以及运行态/销毁关闭。
- 167项前端测试及边界检查通过。首次前端构建显示主资源218.5KiB、按需791.9KiB，已记录架构决策并将按需预算由791调整为792KiB。
- 浏览器已验证深色样式、对应组件名称、默认取消及Esc，取消后两项组件保留。截图target/component-delete-dialog.jpg。桌面release重建成功（1m06s），产物target/release/moligod.exe，日志target/component-delete-desktop-build.log，verification已更新。桌面WebView弹窗观感待新版实机复验。

## 当前目标为组件动作代码分享（2026-11-15）

- 用户补充为单组件旁导出复制动作代码、顶部美化导入按钮、弹窗粘贴代码导入。
- 正常模式，修改组件库前端入口、布局、样式与对应测试，复用原生导入接口和schema 1。
- 已实现组件标题行的导出/展开/删除及统一深色按钮，原生dialog提供多行输入、错误保留、取消和Esc，复制成功/失败有通知。
- 165项前端测试、边界与前端构建通过。浏览器真实复制并通过测试夹具按钮读取剪贴板确认只有1项组件，原样粘贴导入成功，非法代码错误和Esc均已验证。截图target/component-code-library-preview.jpg及target/component-code-import-dialog.jpg。
- release模块实际导入浏览器复制的动作代码通过，结果target/component-code-protocol-result.json。最终桌面release重建通过（1m02s），产物target/release/moligod.exe，日志target/component-code-desktop-build.log。导入刷新后的焦点恢复已通过定向断言及全部165项测试。桌面WebView实际剪贴板交互待新版实机复验，带图片识别的组件需配套模板图片。

## 组件库和托盘调整（2026-11-15）

- 目标为组件库整库导入导出、删除托盘开关、关闭主窗口默认留在托盘、调整菜单顺序与名称。
- 正常模式，涉及本地文件导入和原生窗口关闭，执行前端、原生回归和桌面构建。
- 已完成前后端入口。导入一次校验后原子追加，重号分配新ID，同名保留。沿用schema 1和100项/1MiB限制，JSON保留模板ID引用。
- 验证通过164项前端、8项宿主、54项自动化和15项集成、22项core/storage，5项既有环境测试ignored，边界、格式、Clippy均通过。浏览器实际导入/导出及release模块协议验收通过，截图target/component-library-preview.jpg。
- 最终前端按需资源790.8KiB，已记录架构决策并将790KiB预算调整为791KiB。导入额外检查积木可读性，异常后恢复Blockly全局撤销状态。
- 最终桌面release重建成功（1m04s），产物target/release/moligod.exe，日志target/component-transfer-desktop-build.log。release自动化模块清单哈希核对通过。用户原debug宿主保持运行，托盘原生交互和release进程树测量待重启后实机验收。

- 目标：窄列表 → 点击后同窗口展开为左列表、右工具界面 → 返回窄列表；顶部自动收缩。
- 模式：稳定（原生窗口布局与IPC）。
- 最终决策：用户取消新窗口，保留唯一main窗口。复用原工具页面和生命周期，不接网站，不初始化发现游戏，原有游戏资料文件不删除。
- 完成：工具列表及搜索、工具/设置导航、返回列表、原生展开收回与屏幕工作区约束、事件驱动贴顶收缩、移入恢复及托盘恢复。
- 验证：157项前端测试、core/storage测试、2项宿主测试、依赖边界、TypeScript/Vite体积预算、Rust格式和Clippy通过。独立浏览器预览验证准星与自动化页面、返回列表；已有1420服务按需模块加载失败，改用1422独立服务验证成功。
- 构建：第一次release桌面构建成功；最终恢复最小尺寸修正正重新构建，日志target/toolbox-desktop-build.log。
- 待验收：当前开发版仍在运行；未强制关闭，因此新版Windows实机贴顶、鼠标移入展开、多屏与发布版全进程树测量尚未进行。
- 最终构建已完成：`npm run tauri -- build --no-bundle`成功，产物`target/release/moligod.exe`。上述重新构建待办已完成；原生交互及进程树测量待验收。

## 当前修正：顶部整窗滑动隐藏

- 原因：旧实现缩高且用了系统拖动，用户截图出现Snap布局。
- 完成：保持尺寸的180ms滑动隐藏/显示、窄列表pointer capture拖动、原生光标位置跟随、松手隐藏、取消释放、托盘恢复。
- 验证：先红后绿的宿主几何测试；160项前端测试、3项宿主测试、构建预算、Clippy及边界检查通过。
- 进行中：桌面release构建，日志target/top-slide-build.log。
- 待验收：原生Windows拖拽Snap抑制与动画观感（当前工具没有原生桌面交互控制）。
- 桌面构建完成且新版已启动；5.21秒全进程树空闲采样完成（7进程，private176.42MiB，working set397.13MiB）。构建与测量待办完成，原生交互观感待验收。

## 悬停唤出修正

- 原生隐藏态检测替代仅网页mouseenter的假设；32ms检查、不需点击/焦点；滑出改270ms smoothstep。
- 窗口切换和托盘恢复改后台任务，UI线程不等待动画锁。
- 160项前端、5项宿主及构建/静态检查通过。
- 保留当前用户窗口，旧EXE已同目录改名moligod.before-hover.exe；新版构建日志target/top-hover-build.log。
- 原生悬停与动画实机观感、隐藏态进程树采样仍待验收。必须退出旧进程再运行新版。
- 新版release构建已成功，目标完成到可交付EXE；旧进程保留，切换新版及实机验收未完成。

## 顶部光标修正

- 非编辑列表表面固定箭头；搜索框保留输入光标。
- 隐藏时禁用原生缩放边框，三条恢复路径重新开启。
- 宿主测试、Clippy、前端预算通过；桌面构建进行中，日志target/top-cursor-build.log。旧进程保留，须重启新版。
- 本次桌面构建成功，最终产物target/release/moligod.exe；实机光标验证待退出旧进程再启动新版。

## 当前目标：独立功能窗口（2026-11-12）

- 用户最新选择：窄列表保持，点击工具独立弹窗，不再同窗口展开。
- 完成：固定窗口label及权限、按工具初始化、无侧栏的原界面、重复唤回、关闭隐藏、自动化选区owner/回传更新、字段级配置合并。
- 验证：既有160项前端+新增导航1项、宿主7项、core/storage、Clippy/边界/格式/前端构建通过。
- release重建中；当前宿主及两项模块进程保留，旧运行文件同目录改名备份。日志target/tool-windows-build.log。
- 待实机：打开/隐藏恢复、选区回传、多窗口进程树测量；需退出旧客户端再启动新版。
- 桌面release已构建成功，模块清单哈希检查通过。可交付EXE完成，旧进程保留，实机验收未完成。

## 当前目标：工具面板视觉与网站（2026-11-12）

- 完成：工具卡片、三个网站入口、指定宝藏导航副标题、删除设置页与齿轮、托盘开关移底部、固定URL原生浏览器打开。
- 验证：340×720浏览器视觉截图target/launcher-design.png；161前端/8宿主/core存储测试、边界/Clippy/格式/前端构建通过。
- 桌面构建中，日志target/launcher-design-build.log。旧进程保留，用户须彻底退出后启动新版；原生外链唤起及实机样式待验收。
- 桌面构建已成功，可交付产物target/release/moligod.exe；当前旧进程未重启。

## 面板标题和图标精简

- 已移除两行分组说明和工具搜索；顶部moligod工具箱；网站三图标换本地SVG。
- 定向4项回归、前端构建预算、340×720截图检查通过。截图target/panel-icons-preview.png。
- 桌面重建日志target/panel-icons-build.log；旧程序保留，需重启新版。
