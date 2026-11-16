# WebTrade参考与截图修复 · 2026-09-28

通过本地只读 WebTrade 参考副本核对截图和输入的生命周期设计。

## 已核对的设计

- backend/wgc_capture.py：按HWND创建WGC会话，只有消费者请求时复制下一帧；frame_ready_event与时间戳区分新帧/缓存帧。
- backend/main.py 的 get_capture_frame_for_source：交互OCR使用require_fresh_frame，超时重试/重建会话，失败返回空而非旧帧。
- backend/interaction.py：前台真实输入使用全局锁，后台消息按HWND分锁；后台点击独立使用PostMessage，不以移除前台校验冒充后台输入。
- main.py flatten_actions与frontend/js/modules/interaction-editor.js：递归动作组与编辑器组结构，执行前展开；这是后续动作组织的参考，当前未迁移分组UI。
- backend/ocr_service.py：独立ONNX模型配置/推理与ROI处理；不是当前Windows OCR接口的直接替换。
- tests/test_monitoring_lifecycle.py、test_ocr_round_pause_finalize.py：监控代次/结果保护、停止回收、暂停轮次汇总，避免已停止任务的迟到结果继续改状态。

## 本轮采用

此前moligod的capture先调用focus，再从桌面BitBlt，所以只读截图也受前台输入激活限制，且会受遮挡影响。改为crates/automation/src/window_capture.rs内独立WGC适配器，通过windows-capture 2.0.1取得窗口帧。不调用focus，不截取桌面覆盖内容。截图会话按需建立，拿一帧即停止并回收，不复用旧会话缓存；等待新帧5秒超时或取消报错，不退回桌面旧图。客户区坐标与WGC整窗边界通过DWM/ClientToScreen校准；目标尺寸变化不猜缩放，要求重新截图。最小化窗口明确提示还原。

新依赖仅在自动化模块，平台主EXE仍不链接截图引擎。库原始用法见 https://github.com/NiiightmareXD/windows-capture 。一次一会话优先保证当前手动框选正确性；高频监控后续可参考WebTrade做按任务复用，必须保留新帧语义和停止回收。

截图、OCR测试、脚本OCR及模板匹配共用新截图路径。前台点击/键盘仍保留激活检查；本轮没有承诺所有游戏支持后台输入。WebTrade的完整动作分组、监控UI、ONNX模型尚未搬入，后续应按需求分开实现。

## 验证

native_smoke默认现在验证截图：创建自有目标EDIT窗口和覆盖窗口，在目标处于后台且被覆盖时截图，OCR读出目标12345，前台句柄保持不变；通过WM_SETTEXT改为67890，再截图读到新文字；区域越界拒绝。截图坐标往返测试通过。

旧输入烟测因测试进程不能激活目标，在本轮尝试中未通过。保留为显式 --with-input 模式，不将截图修复声称为解决前台输入限制。实际用户游戏窗口及多屏DPI仍需复核。
