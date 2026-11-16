export function workspaceTabs() {
  let opened: string[] = [];
  let active = "tools";
  return {
    current: () => active,
    opened: () => [...opened],
    select(page: string) {
      const fresh = !opened.includes(page);
      if (["crosshair", "automation"].includes(page) && fresh)
        opened.push(page);
      active = page;
      return fresh;
    },
    close(page: string) {
      const index = opened.indexOf(page);
      if (index === -1) return false;
      opened.splice(index, 1);
      if (active === page)
        active = opened[Math.min(index, opened.length - 1)] ?? "tools";
      return true;
    },
  };
}
