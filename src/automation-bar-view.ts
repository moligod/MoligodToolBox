import type { AutomationBarSnapshot } from "./api.ts";

export function renderAutomationBar(host: HTMLElement, snapshot: AutomationBarSnapshot) {
  host.replaceChildren();
  for (const row of snapshot.rows.slice(0, 3)) {
    const item = document.createElement("div");
    item.className = "run";
    const title = document.createElement("strong");
    title.textContent = row.taskName || "任务";
    const progress = document.createElement("span");
    const phase = ({starting:"准备中", scheduled:"等待开始", running:"运行中", completed:"已完成", stopped:"已停止", failed:"已停止"} as Record<string,string>)[row.phase] || row.phase;
    progress.textContent = `${phase} · 第 ${row.round || 1} 轮 · 第 ${row.step + 1}/${row.totalSteps || "—"} 步`;
    const details = document.createElement("span");
    details.className = "details";
    details.textContent = `紧急停止：${row.stopHotkey || "—"}　模型：PP-OCRv6 ${row.ocrModel || "—"}（${({cpu:"CPU",amd:"显卡",nvidia:"N卡专用"} as Record<string,string>)[row.ocrDevice] || "—"}）`;
    item.append(title, document.createTextNode(" "), progress, document.createTextNode(" "), details);
    if (row.error) { item.classList.add("error"); details.textContent = row.error; }
    if (row.notice) {
      const notice = document.createElement("span");
      notice.className = "notice";
      notice.textContent = `提示：${row.notice}`;
      item.append(document.createTextNode(" "), notice);
    }
    host.append(item);
  }
  if (snapshot.rows.length > 3) host.lastElementChild?.append(`　另有 ${snapshot.rows.length - 3} 个任务`);
}

/** Measure actual text using the same CSS, bounded by the destination monitor. */
export function measureAutomationBar(host: HTMLElement, maxWidth: number) {
  const probe = host.cloneNode(true) as HTMLElement;
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {position:"fixed",left:"0",top:"0",visibility:"hidden",width:"max-content",maxWidth:`${Math.max(1, maxWidth - 2)}px`});
  document.body.append(probe);
  const bounds = probe.getBoundingClientRect();
  const result = {width:Math.ceil(bounds.width) + 2, height:Math.ceil(bounds.height) + 2};
  probe.remove();
  return result;
}
