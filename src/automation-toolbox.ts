/** Tool panels are independent of the editor and never replace its contents. */
export function initAutomationToolbox(root: HTMLElement) {
  const toolbox = root.querySelector<HTMLElement>('.auto-toolbox')!;
  const buttons = ['auto-tasks-tab', 'auto-model-tab', 'auto-hotkeys-tab']
    .map(id => root.querySelector<HTMLButtonElement>(`#${id}`)!);
  const logs = root.querySelector<HTMLElement>('#auto-logs-panel')!;
  const logButton = root.querySelector<HTMLButtonElement>('#auto-logs-tab')!;
  const layout = root.querySelector<HTMLElement>('.automation-layout')!;
  const sidePanel = root.querySelector<HTMLElement>('.auto-side-panel')!;
  sidePanel.append(logs);
  function select(id?: string) {
    for (const button of buttons) {
      const open = button.id === id;
      button.setAttribute('aria-expanded', String(open));
      root.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`)!.hidden = !open;
    }
  }
  for (const button of buttons) {
    button.addEventListener('click', () => {
      select(button.getAttribute('aria-expanded') === 'true' ? undefined : button.id);
    });
  }
  toolbox.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = toolbox.querySelector<HTMLDetailsElement>('.auto-task-more[open]');
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
      event.preventDefault();
      return;
    }
    const open = buttons.find(button => button.getAttribute('aria-expanded') === 'true');
    if (!open) return;
    event.preventDefault();
    select();
    open.focus();
  });
  const dismiss = (event: PointerEvent) => {
    if (!toolbox.contains(event.target as Node)) select();
    if ((event.target as Element).closest('.blocklyToolboxCategory')) showPanel();
    const activeMenu = (event.target as Element).closest('.auto-task-more');
    toolbox.querySelectorAll<HTMLDetailsElement>('.auto-task-more[open]').forEach(menu => {
      if (menu !== activeMenu) menu.open = false;
    });
  };
  root.querySelector('#auto-task-list')!.addEventListener('scroll', () => {
    toolbox.querySelectorAll<HTMLDetailsElement>('.auto-task-row .auto-task-more[open]').forEach(menu => menu.open = false);
  });
  root.querySelector('#auto-task-new')!.addEventListener('click', () => select());
  document.addEventListener('pointerdown', dismiss);
  window.addEventListener('pagehide', () => document.removeEventListener('pointerdown', dismiss), { once: true });
  function showPanel(which?: string) {
    const recycle = sidePanel.querySelector<HTMLElement>('.auto-recycle-dialog');
    logs.hidden = which !== 'logs';
    if (recycle) recycle.hidden = which !== 'recycle';
    sidePanel.hidden = !which;
    layout.dataset.autoPanel = which ?? '';
    logButton.setAttribute('aria-expanded', String(which === 'logs'));
    root.querySelector<HTMLButtonElement>('.auto-recycle-button')?.setAttribute('aria-expanded', String(which === 'recycle'));
  }
  logButton.addEventListener('click', () => showPanel(layout.dataset.autoPanel === 'logs' ? undefined : 'logs'));
  root.addEventListener('auto-panel', event => {
    const which = (event as CustomEvent<string>).detail;
    showPanel(which && layout.dataset.autoPanel !== which ? which : undefined);
  });
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.closest('.blocklyToolboxCategoryContainer')) {
      showPanel();
      return;
    }
    if (event.key !== 'Escape') return;
    if (!layout.dataset.autoPanel) return;
    event.preventDefault();
    const previous = layout.dataset.autoPanel;
    showPanel();
    (previous === 'logs' ? logButton : root.querySelector<HTMLButtonElement>('.auto-recycle-button'))?.focus();
  }, true);
  showPanel();
  return { select };
}
