import { automationBarState, onAutomationBarState, dismissAutomationBar, resizeAutomationBar, type AutomationBarSnapshot } from "./api";
import { measureAutomationBar, renderAutomationBar } from "./automation-bar-view.ts";
import "./automation-bar.css";
let revision = -1;
let timer: ReturnType<typeof setTimeout> | undefined;
const host = document.getElementById("status")!;
let maxWidth = 1000, inFlight = false, queued = false, lastSize = "";
function queueLayout() {
  if (!host.children.length) return;
  if (inFlight) { queued = true; return; }
  const current = revision, size = measureAutomationBar(host, maxWidth), key = `${size.width}:${size.height}:${maxWidth}`;
  if (key === lastSize) return;
  inFlight = true;
  void resizeAutomationBar(current, size.width, size.height).then(applied => { if (applied) lastSize = key; })
    .catch(error => console.error("状态栏调整失败", error))
    .finally(() => { inFlight = false; if (queued || current !== revision) { queued = false; queueLayout(); } });
}
function render(snapshot: AutomationBarSnapshot) {
  if (snapshot.revision < revision) return;
  revision = snapshot.revision;
  clearTimeout(timer);
  maxWidth = snapshot.maxWidth > 0 ? snapshot.maxWidth : 1000;
  renderAutomationBar(host, snapshot);
  queueLayout();
  if (snapshot.rows.every(row => !row.running)) timer = setTimeout(() => void dismissAutomationBar(snapshot.revision), 8000);
}
async function start() {
  const stop = await onAutomationBarState(render);
  window.addEventListener("pagehide", () => { stop(); clearTimeout(timer); }, {once:true});
  render(await automationBarState());
}
void start().catch(error => { host.textContent = `任务状态暂不可用：${String(error)}`; });
