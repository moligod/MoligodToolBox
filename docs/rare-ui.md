# UI 组件来源与适配

## 当前分段按钮

GPL-3.0 版本使用 `src/components/segmented-controls.css`。按钮使用固定间距、独立圆角和基于 ARIA 状态的边框下划线，原生按钮及既有控制器负责点击、键盘操作和面板状态。选中时布局尺寸稳定，键盘焦点可见，减少动态效果偏好可关闭颜色过渡。

## Rare UI 历史记录

以下为早期适配的来源及版权记录，当前运行样式见上节。

界面使用 [Rare UI](https://rareui.com)，作者 Swami Malode。

- 上游仓库 https://github.com/swamimalode07/rare-ui
- 固定 revision `21554cba3ac751c1f9c06869eadb9d44a0af7225`
- 参考来源为 TroveAuto 的 `launcher/src/components/rare-ui/gooey-nav.tsx` 和 `launcher/RARE-UI.md`。
- 完整许可随应用静态资源分发，位于 `public/licenses/Rare-UI-LICENSE.txt`，包含 MIT、Commons Clause 和 Attribution 条款。
- `src/components/rare-ui/gooey-nav.css` 将 GooeyNav 的相邻分段、选中项两侧间隔和圆角逻辑适配为 CSS，接入原生按钮及既有 ARIA 状态。180ms 过渡代替 React/Motion 弹簧与 SVG 连接颈，响应减少动态效果偏好。
- 用于工具状态筛选、自动化模型/快捷键和识别/执行日志标签。本项目的按钮事件、键盘导航及面板生命周期由原功能模块管理。

当前功能没有账号密码表单，数值编辑使用现有原生输入框和即时读数。此次选用的组件为 GooeyNav。

## Lucide

工具箱使用 [Lucide](https://lucide.dev) 的 crosshair、workflow、book-open、notebook-pen、compass 五个静态 SVG，获取于2026-11-16。

源文件来自 https://github.com/lucide-icons/lucide/tree/main/icons ，保存在 `public/icons/lucide/`。完整 ISC 及继承的 MIT 许可位于 `public/licenses/Lucide-LICENSE.txt`。图标按需作为本地图片加载。

## 主题与技术栈

共享颜色来自 TroveAuto 当前高级黑主题及 `docs/screenshots/toolbox-black.jpg`，按 moligod 的工具窗口、准星参数及自动化工作台重新组织。

主题变量位于 `src/theme.css`，三种窗口入口均声明深色浏览器控件。主字体使用现有 Windows 系统中文字体，兼容离线使用。紧凑样式使用原生 CSS，短动效使用 CSS transition。
