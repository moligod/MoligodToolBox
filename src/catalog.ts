/** Local, explicitly submitted search; no polling or remote catalog requests. */
export function initCatalog() {
  const cards = [
    ...document.querySelectorAll<HTMLElement>("[data-tool-category]"),
  ];
  const input = document.querySelector<HTMLInputElement>("#search-input")!;
  let category = "all";
  let status = "all";
  let query = "";
  const showTools = () =>
    document.querySelector<HTMLButtonElement>('[data-page="tools"]')!.click();

  function render() {
    let count = 0;
    for (const card of cards) {
      const matches =
        (category === "all" || card.dataset.toolCategory === category) &&
        (status === "all" || card.dataset.toolStatus === status) &&
        (card.dataset.search ?? "").toLocaleLowerCase().includes(query);
      card.hidden = !matches;
      if (matches) count++;
    }
    document.querySelector("#result-count")!.textContent = `${count} 个工具`;
    document.querySelector<HTMLElement>("#empty-results")!.hidden = count > 0;
    document.querySelector("#catalog-title")!.textContent = query
      ? "搜索结果"
      : (
          {
            all: "全部工具",
            general: "通用工具",
          } as Record<string, string>
        )[category];
    document
      .querySelectorAll<HTMLElement>("button[data-category]")
      .forEach((button) => {
        const active = button.dataset.category === category;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    document
      .querySelectorAll<HTMLElement>("[data-status]")
      .forEach((button) => {
        const active = button.dataset.status === status;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }
  document
    .querySelectorAll<HTMLElement>("button[data-category]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        category = button.dataset.category!;
        showTools();
        render();
      });
    });
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.page === "tools") render();
      else
        document
          .querySelectorAll<HTMLElement>("button[data-category]")
          .forEach((item) => {
            item.classList.remove("active");
            item.setAttribute("aria-pressed", "false");
          });
    });
  });
  document.querySelectorAll<HTMLElement>("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      status = button.dataset.status!;
      render();
    });
  });
  document
    .querySelector("#tool-search")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      if (
        document.querySelector<HTMLElement>("#page-games")?.hidden === false ||
        document.querySelector<HTMLElement>("#page-game-detail")?.hidden ===
          false
      )
        return;
      query = input.value.trim().toLocaleLowerCase();
      showTools();
      render();
    });
  document.querySelector("#clear-filters")!.addEventListener("click", () => {
    category = "all";
    status = "all";
    query = "";
    input.value = "";
    render();
  });
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelector("#tool-results")!
        .classList.toggle("list-view", button.dataset.view === "list");
      document.querySelectorAll("[data-view]").forEach((item) => {
        item.classList.toggle("selected", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
    });
  });
}
