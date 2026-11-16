import { desktop, loadGameLibrary, saveGameLibrary } from "./api";
import { initGameEditor } from "./game-editor";
import {
  decodeLibrary,
  emptyLibrary,
  MAX_LIBRARY_ENCODED_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  type Game,
  type GameLibrary,
} from "./game-library-model";
import { mergeGameLibraries } from "./game-library-merge";
import { showPage } from "./navigation";
import "./game-library.css";

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}
function button(text: string, className: string, action: () => void) {
  const element = node("button", className, text);
  element.type = "button";
  element.onclick = action;
  return element;
}
function picture(source: string, alt: string, className: string) {
  if (!source) return node("div", className + " game-no-art", "暂无封面");
  const image = node("img", className);
  image.src = source;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  return image;
}
function chips(values: string[]) {
  const group = node("div", "game-chips");
  group.append(...values.map((value) => node("span", "", value)));
  return group;
}
function formattedDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function initGameLibrary(
  notify: (message: string, error?: boolean) => void,
) {
  const discover = document.getElementById("page-games")!;
  const detail = document.getElementById("page-game-detail")!;
  let library = emptyLibrary();
  let loaded = false;
  let busy = false;
  let error = "";
  let query = "";
  let selectedTag = "全部";
  let selectedPlatform = "全部平台";
  let sort = "recent";
  let currentId = "";
  const editor = initGameEditor({
    notify,
    save: async (game) => {
      const games = library.games.some((item) => item.id === game.id)
        ? library.games.map((item) => (item.id === game.id ? game : item))
        : [...library.games, game];
      await commit({ schemaVersion: 1, games });
    },
  });

  function edit(game?: Game) {
    if (loaded && !busy && !error) editor.open(game);
  }
  async function commit(next: GameLibrary) {
    if (busy || !loaded || error)
      throw new Error("资料库暂不可写入，请稍后重试。");
    busy = true;
    render();
    try {
      library = await saveGameLibrary(decodeLibrary(next));
    } finally {
      busy = false;
      render();
    }
  }
  function failure(reason: unknown) {
    notify(reason instanceof Error ? reason.message : String(reason), true);
  }
  function matches(game: Game) {
    return [
      game.title,
      game.subtitle,
      game.developer,
      game.publisher,
      ...game.tags,
      ...game.platforms,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase());
  }
  function openGame(game: Game) {
    currentId = game.id;
    renderDetail();
    showPage("game-detail");
  }
  function newButton() {
    const result = button("＋ 上传游戏资料", "primary game-upload", () =>
      edit(),
    );
    result.disabled = !loaded || busy || !!error;
    return result;
  }
  function heading(title: string, subtitle: string, action?: HTMLElement) {
    const header = node("div", "game-heading");
    const text = node("div");
    text.append(
      node("p", "game-overline", "MOLIGOD / GAMES"),
      node("h1", "", title),
      node("p", "muted", subtitle),
    );
    header.append(text);
    if (action) header.append(action);
    return header;
  }
  function loadingOrError(container: HTMLElement) {
    if (loaded && !error) return false;
    const state = node("div", "game-empty");
    state.setAttribute("role", error ? "alert" : "status");
    state.append(
      node("h2", "", error ? "暂时无法读取资料库" : "正在读取游戏资料…"),
    );
    if (error) {
      state.append(
        node("p", "muted", error),
        button("重新读取", "secondary", () => void load()),
      );
    }
    container.append(state);
    return true;
  }
  function footer(container: HTMLElement) {
    const text = desktop
      ? "资料与图片保存在这台电脑，可随时导出备份。"
      : "浏览器资料独立保存，可通过导入导出转移到桌面客户端。";
    const actions = node("div", "game-actions");
    const importButton = button("导入资料", "secondary", () => importFile.click());
    const exportButton = button("导出资料库", "secondary", exportLibrary);
    importButton.disabled = busy;
    exportButton.disabled = busy || !library.games.length;
    actions.append(importButton, exportButton);
    container.append(actions);
    const drafts = library.games.filter((game) => game.status === "draft");
    if (drafts.length) {
      const draftList = node("details", "game-drafts");
      draftList.append(node("summary", "", `草稿（${drafts.length}）`));
      for (const game of drafts)
        draftList.append(button(game.title, "game-text-button", () => openGame(game)));
      container.append(draftList);
    }
    container.append(node("p", "game-storage-note", "本机资料库 · " + text));
  }
  function noResults(container: HTMLElement) {
    const empty = node("div", "game-empty");
    empty.append(
      node("h2", "", "没有找到匹配的游戏"),
      node("p", "muted", "试试其他关键词，或清除筛选查看所有游戏。"),
      button("清除筛选", "secondary", () => {
        query = "";
        selectedTag = "全部";
        selectedPlatform = "全部平台";
        document.querySelector<HTMLInputElement>("#search-input")!.value = "";
        render();
      }),
    );
    container.append(empty);
  }
  function renderDiscover() {
    discover.replaceChildren(
      heading(
        "发现下一场冒险",
        "把喜欢的游戏收进来，让每一份资料都有自己的主场。",
        newButton(),
      ),
    );
    if (loadingOrError(discover)) return;
    const published = library.games.filter(
      (game) => game.status === "published",
    );
    if (!published.length && !query) {
      const welcome = node("div", "game-welcome");
      const copy = node("div", "game-welcome-copy");
      copy.append(
        node("span", "game-overline", "YOUR GAMES. YOUR SPACE."),
        node("h2", "", "好游戏，\n值得好好收藏。"),
        node(
          "p",
          "",
          "上传封面与截图，写下游戏介绍。\n从第一款游戏开始，建立你的专属游戏资料库。",
        ),
        newButton(),
      );
      const visual = node("div", "game-welcome-art");
      visual.setAttribute("aria-hidden", "true");
      const disc = node("div", "game-disc");
      disc.append(node("span", "", "M"));
      visual.append(
        disc,
        node("span", "game-art-caption", "THE NEXT ADVENTURE IS YOURS"),
      );
      welcome.append(copy, visual);
      discover.append(welcome);
      const steps = node("div", "game-steps");
      for (const [number, title, text] of [
        ["01", "录入游戏资料", "名称、平台、标签和介绍，整理在一起。"],
        ["02", "添加游戏画面", "上传封面、主视觉和截图，展示游戏风格。"],
        ["03", "展示与分享资料", "展示到发现页，导出文件在电脑间转移。"],
      ]) {
        const step = node("div");
        step.append(
          node("span", "", number),
          node("h3", "", title),
          node("p", "muted", text),
        );
        steps.append(step);
      }
      discover.append(steps);
      footer(discover);
      return;
    }
    const featured = [...published]
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
      .slice(0, 3);
    if (
      !query &&
      selectedTag === "全部" &&
      selectedPlatform === "全部平台" &&
      featured.length
    ) {
      const featureRow = node("div", "game-feature-row");
      for (const [index, game] of featured.entries()) {
        const card = button(
          "",
          "game-feature" + (index === 0 ? " game-feature-main" : ""),
          () => openGame(game),
        );
        card.setAttribute("aria-label", "查看 " + game.title);
        card.append(picture(game.hero || game.cover, "", "game-feature-image"));
        const copy = node("div", "game-feature-copy");
        copy.append(
          node(
            "span",
            "game-feature-label",
            game.featured ? "精选游戏" : "最近更新",
          ),
          node("h2", "", game.title),
          node("p", "", game.subtitle),
          chips(game.platforms),
          node("span", "game-feature-link", "探索游戏  ↗"),
        );
        card.append(copy);
        featureRow.append(card);
      }
      discover.append(featureRow);
    }
    const filters = node("div", "game-filters");
    const tags = ["全部", ...new Set(published.flatMap((game) => game.tags))];
    for (const tag of tags) {
      const control = button(
        tag,
        "game-filter" + (tag === selectedTag ? " selected" : ""),
        () => {
          selectedTag = tag;
          renderDiscover();
        },
      );
      control.setAttribute("aria-pressed", String(tag === selectedTag));
      filters.append(control);
    }
    discover.append(filters);
    const bar = node("div", "game-section-heading");
    const filtered = published
      .filter(
        (game) =>
          matches(game) &&
          (selectedTag === "全部" || game.tags.includes(selectedTag)) &&
          (selectedPlatform === "全部平台" ||
            game.platforms.includes(selectedPlatform)),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title, "zh-CN")
          : b.updatedAt.localeCompare(a.updatedAt),
      );
    bar.append(
      node("h2", "", query ? `“${query}” 的搜索结果` : "游戏资料库"),
      node("span", "muted", `${filtered.length} 款游戏`),
    );
    const controls = node("div", "game-sort-controls");
    for (const [label, choices, value, change] of [
      [
        "游戏平台",
        ["全部平台", ...new Set(published.flatMap((game) => game.platforms))],
        selectedPlatform,
        (value: string) => {
          selectedPlatform = value;
        },
      ],
      [
        "游戏排序",
        ["recent", "title"],
        sort,
        (value: string) => {
          sort = value;
        },
      ],
    ] as const) {
      const select = node("select");
      select.setAttribute("aria-label", label);
      for (const choice of choices) {
        const option = node(
          "option",
          "",
          choice === "recent"
            ? "最近更新"
            : choice === "title"
              ? "名称排序"
              : choice,
        );
        option.value = choice;
        select.append(option);
      }
      select.value = value;
      select.onchange = () => {
        change(select.value);
        renderDiscover();
      };
      controls.append(select);
    }
    bar.append(controls);
    discover.append(bar);
    const grid = node("div", "game-grid");
    for (const game of filtered) {
      const card = button("", "game-card", () => openGame(game));
      card.setAttribute("aria-label", "查看 " + game.title);
      card.append(picture(game.cover, "", "game-card-art"));
      const body = node("div", "game-card-body");
      body.append(
        node("h3", "", game.title),
        node("p", "muted", game.subtitle),
        chips(game.tags.slice(0, 3)),
        node("span", "game-card-platform", game.platforms.join(" / ")),
      );
      card.append(body);
      grid.append(card);
    }
    discover.append(grid);
    if (!filtered.length) noResults(discover);
    footer(discover);
  }

  function renderDetail() {
    const game = library.games.find((item) => item.id === currentId);
    detail.replaceChildren();
    if (!game) {
      detail.append(
        button("← 返回游戏资料库", "game-text-button", () =>
          showPage("games"),
        ),
        node("p", "muted", "这份游戏资料已不存在。"),
      );
      return;
    }
    const bar = node("div", "game-detail-top");
    bar.append(
      button(
        "← 返回发现游戏",
        "game-text-button",
        () => showPage("games"),
      ),
      button("编辑资料", "secondary", () => edit(game)),
      button("删除资料", "game-text-button game-danger", () => confirmDelete(game)),
    );
    detail.append(bar);
    const hero = node("div", "game-detail-hero");
    hero.append(picture(game.hero || game.cover, "", "game-detail-background"));
    const summary = node("div", "game-detail-summary");
    summary.append(
      picture(game.cover, game.title + "封面", "game-detail-cover"),
    );
    const copy = node("div");
    copy.append(
      node(
        "span",
        "game-feature-label",
        game.status === "draft"
          ? "草稿预览 · 尚未展示"
          : game.featured
            ? "精选游戏"
            : "游戏资料",
      ),
      node("h1", "", game.title),
      node("p", "", game.subtitle || "尚未填写简短介绍"),
      chips(game.tags),
    );
    summary.append(copy);
    hero.append(summary);
    detail.append(hero);
    const columns = node("div", "game-detail-columns");
    const content = node("div", "game-detail-content");
    content.append(
      node("h2", "", "关于这款游戏"),
      node("p", "game-description", game.description || "尚未填写详细介绍。"),
    );
    if (game.screenshots.length) {
      content.append(node("h2", "", "游戏画面"));
      const gallery = node("div", "game-gallery");
      for (const [index, source] of game.screenshots.entries()) {
        const item = button("", "game-screenshot", () =>
          showImage(source, game.title, index),
        );
        item.setAttribute("aria-label", `查看${game.title}截图 ${index + 1}`);
        item.append(picture(source, `${game.title}截图 ${index + 1}`, ""));
        gallery.append(item);
      }
      content.append(gallery);
    }
    const metadata = node("aside", "game-metadata");
    metadata.append(node("h2", "", "游戏信息"));
    const definition = node("dl");
    for (const [key, value] of [
      ["游戏平台", game.platforms.join(" / ")],
      ["开发商", game.developer],
      ["发行商", game.publisher],
      ["发行日期", game.releaseDate],
      ["资料更新", formattedDate(game.updatedAt)],
    ]) {
      definition.append(
        node("dt", "", key),
        node("dd", "", value || "暂未填写"),
      );
    }
    metadata.append(definition);
    columns.append(content, metadata);
    detail.append(columns);
    footer(detail);
  }
  function showImage(source: string, title: string, index: number) {
    const dialog = node("dialog", "game-image-dialog");
    dialog.setAttribute("aria-label", title + "截图 " + (index + 1));
    dialog.append(
      button("关闭 ×", "secondary", () => dialog.close()),
      picture(source, title + "截图", ""),
    );
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
  }
  function confirmAction(
    title: string,
    description: string,
    label: string,
    action: () => Promise<void>,
    extra?: HTMLElement,
  ) {
    const dialog = node("dialog", "game-confirm");
    const titleElement = node("h2", "", title);
    titleElement.id = "game-confirm-title";
    dialog.setAttribute("aria-labelledby", titleElement.id);
    dialog.append(titleElement, node("p", "muted", description));
    if (extra) dialog.append(extra);
    const actions = node("div", "game-actions");
    const cancel = button("取消", "secondary", () => dialog.close());
    let pending = false;
    const confirm = button(label, "primary", () => {
      if (pending) return;
      pending = true;
      dialog
        .querySelectorAll<HTMLInputElement | HTMLButtonElement>("button,input")
        .forEach((control) => {
          control.disabled = true;
        });
      void action()
        .then(() => dialog.close())
        .catch((reason) => {
          failure(reason);
          pending = false;
          dialog
            .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
              "button,input",
            )
            .forEach((control) => {
              control.disabled = false;
            });
        });
    });
    actions.append(cancel, confirm);
    dialog.append(actions);
    dialog.oncancel = (event) => {
      if (pending) event.preventDefault();
    };
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
    cancel.focus();
  }
  function confirmDelete(game: Game) {
    confirmAction(
      `删除“${game.title}”？`,
      "这会从本机资料库移除该游戏及其图片。建议先导出备份；其他游戏资料不受影响。",
      "删除资料",
      async () => {
        await commit({
          ...library,
          games: library.games.filter((item) => item.id !== game.id),
        });
        notify("游戏资料已删除。");
      },
    );
  }
  const importFile = node("input");
  importFile.type = "file";
  importFile.accept = ".json,application/json";
  importFile.hidden = true;
  document.body.append(importFile);
  importFile.onchange = () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (!file || busy || !loaded || error) return;
    void (async () => {
      if (file.size > MAX_LIBRARY_ENCODED_BYTES)
        throw new Error("资料文件不能超过 24 MiB。");
      const incoming = decodeLibrary(JSON.parse(await file.text()));
      if (!incoming.games.length) throw new Error("导入文件中没有游戏资料。");
      // JSON validates format/size; decode each unique image before accepting it.
      // Sequential decoding bounds temporary pixel buffers for multi-image imports.
      const images = new Set(
        incoming.games
          .flatMap((game) => [game.cover, game.hero, ...game.screenshots])
          .filter(Boolean),
      );
      for (const source of images) {
        const image = new Image();
        image.src = source;
        try {
          await image.decode();
          if (
            image.naturalWidth > MAX_IMAGE_DIMENSION ||
            image.naturalHeight > MAX_IMAGE_DIMENSION ||
            image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS
          )
            throw new Error("图片尺寸过大");
        } catch {
          throw new Error(
            "资料中有无法解码或尺寸过大的图片，请修复图片后重新导入。",
          );
        } finally {
          image.src = "";
        }
      }
      const conflicts = incoming.games.filter((game) =>
        library.games.some((item) => item.id === game.id),
      ).length;
      const checkbox = node("input");
      checkbox.type = "checkbox";
      const label = node("label", "game-import-choice");
      label.append(
        checkbox,
        document.createTextNode("替换本机同 ID 的资料（未勾选时保留本机版本）"),
      );
      confirmAction(
        "导入游戏资料",
        `共 ${incoming.games.length} 款游戏：新增 ${incoming.games.length - conflicts} 款，同 ID ${conflicts} 款。图片与草稿状态会一起导入。`,
        "确认导入",
        async () => {
          await commit(mergeGameLibraries(library, incoming, checkbox.checked));
          notify("导入完成，资料已保存在本机。");
        },
        conflicts ? label : undefined,
      );
    })().catch(failure);
  };
  function exportLibrary() {
    try {
      const json = JSON.stringify(decodeLibrary(library));
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const link = node("a");
      link.href = url;
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      link.download = `moligod-games-${date}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) {
      failure(reason);
    }
  }
  function render() {
    renderDiscover();
    renderDetail();
  }
  async function load() {
    loaded = false;
    error = "";
    render();
    try {
      library = await loadGameLibrary();
      loaded = true;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
    render();
  }
  document
    .getElementById("tool-search")!
    .addEventListener("submit", (event) => {
      if (discover.hidden && detail.hidden) return;
      event.preventDefault();
      query = document
        .querySelector<HTMLInputElement>("#search-input")!
        .value.trim();
      if (!detail.hidden) showPage("games");
      render();
    });
  void load();
}
