> 2026-09-27 更新：下文为初期参考审阅记录。当前已完成全新 Rust 准星及自动化独立模块，详见 modules.md、automation.md、crosshair.md；采用本项目格式，不实现旧项目配置或脚本导入。下文的“下一片段”“尚未迁移”不是当前状态。

# 旧项目盘点与迁移顺序

更新：用户已要求准星从头重写，旧项目仅供理解功能用途，不再追求旧结构、注册表或分享口令兼容。新的原生准星已实现，见 [原生准星](crosshair.md)。下文准星旧格式和迁移安排为初始盘点，不代表当前实现计划。

本次读取固定源码，未运行旧应用，以下为静态代码证据。参考目录不进入发行包。

| 项目             | 本次参考 commit                          |
| ---------------- | ---------------------------------------- |
| DF-AutomatedTool | 31897f2b5a91884bc8da5c0ca92a0b2f6ce5b835 |
| FPSDiyAim        | 100e4a0cde26d53870276d665f554b9044cf5de7 |

## DF-AutomatedTool

来源：https://github.com/moligod/DF-AutomatedTool

- WindowSpy/WindowSpy.csproj：net8.0-windows、WPF、OpenCvSharp；随包复制 Python OCR 资源。
- WindowSpy/ScriptStep.cs：窗口 A/B；点击、OCR、Condition、Save、Expression、LoopStart/End、BringFront、KeyPress、If/ElseIf/Else/EndIf、Break/Continue、Goto/Label、BreakBlock、Network、Comment。
- 步骤参数含区域、坐标、延迟/随机延迟、按压时长、随机坐标、OCR 数字过滤、ROI 复用、网络适配器。
- WindowSpy/MainWindow.xaml.cs：运行逻辑与 UI 仍有耦合；StepDto / SavedFileDto 支持脚本序列化，加载路径还包含旧数组格式。
- WindowSpy/Ocr/OnnxOcrHelper.cs：管理独立 Python 进程、SemaphoreSlim 串行请求、模型目录与超时；不能将 README 中的 ONNX 描述等同于纯 C# 推理。

迁移按窗口/输入 → 无识别基础脚本 → 控制流 → 图像匹配 → OCR 顺序。
网络适配器操作需单独设计，不能混入一般输入权限。
每一步先建立可记录输入/输出的行为样例，保留旧文件，显式导入；不得宣称当前新客户端已经支持旧脚本。

## FPSDiyAim

来源：https://github.com/moligod/FPSDiyAim

- main.py：Tkinter UI，Pillow 图片处理、pystray、keyboard/pynput 监听、Win32 窗口属性。
- CrosshairOverlay：透明/穿透/工具窗口/不激活样式，存在定时置顶检查及延迟图片绘制。
- ControlPanel：颜色、形状、坐标、大小、自定义图片、预设、快捷键、自启、管理员模式。
- 配置存在 HKCU/Software/MoligodCrosshair 的 Config 值。
- 新客户端仅实现四个准星参数与自己的 v1 预设，不兼容旧注册表格式及分享口令。

下一片段：真实原生十字覆盖层，先完成创建/销毁、鼠标穿透、无焦点、主屏居中及进程资源测量。
随后多屏/DPI、坐标、其他形状、图片、快捷键，最后显式导入旧配置。

## 当前验收边界

UI 准星图形是参数预览，不是游戏覆盖层。
两个旧工具尚未整体迁移；没有把旧 Python/.NET 运行环境打入新客户端。
