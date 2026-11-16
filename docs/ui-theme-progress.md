# 高级黑工具箱适配进度

## 目标与约束

- 参考本地 TroveAuto 副本中的 launcher/src/dark.css、Rare UI 适配及 docs/screenshots/toolbox-black.jpg。
- 正常模式，沿用 TypeScript、原生 DOM、独立工具窗口及现有业务入口。
- 背景 #101113，深灰面板、细边框、银灰强调。控件、弹窗、Blockly 外围及辅助窗口使用同一主题。
- 参考项目只读。第三方组件保留来源、固定 revision、版权和完整许可。

## 决策

- 共享 CSS 颜色变量用于所有 HTML 入口，调整现有布局与颜色声明。
- 将 Rare UI GooeyNav 的相邻分段和选中分离样式适配为 CSS，接入现有 aria-expanded / aria-selected 状态。使用短过渡及减少动态效果偏好。
- 原生表单沿用现有事件与校验，按工具功能复用合适组件。

## 完成

- 已检查当前参考截图、高级黑样式、GooeyNav / PasswordInput / AnimatedCounter 源码及许可证。
- 已读取当前窗口、导航、准星、自动化与 Blockly 的样式及入口。
- 共享颜色变量、36px标题栏、紧凑分组列表、单色Lucide入口、准星参数双栏及自动化底部日志已实现。
- Rare UI GooeyNav已接入既有标签，完整许可随静态资源分发，README已署名。
- npm test 174项、核心/存储22项、边界检查、Rust格式及Clippy通过。
- TypeScript/Vite及体积预算检查通过，桌面release构建完成。
- 浏览器检查340×720及300×360工具箱、1100×740准星、1440×900自动化和760×480小工具窗口。主工具窗口无横向溢出。
- 组件导入错误提示、Esc关闭、删除确认默认取消及取消后保留组件已通过隔离内存夹具验证。截图位于target/graphite-ui。
- 已结束本轮开发服务，释放1420端口。

## 验证边界

- Windows原生WebView2、系统托盘、贴边隐藏、多屏DPI及游戏内工具执行需实机验收。辅助窗口已接入共享主题，原生选区与OCR交互未在本轮复测。
