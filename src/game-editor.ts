import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_SCREENSHOTS,
  type Game,
  validateGame,
} from "./game-library-model.ts";
import "./game-editor.css";

export interface GameEditorOptions {
  save: (game: Game) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}

export interface GameEditor {
  open(game?: Game): void;
}

type ImageSlot = "cover" | "hero";

interface SingleImageControls {
  image: HTMLImageElement;
  empty: HTMLElement;
  remove: HTMLButtonElement;
  file: HTMLInputElement;
}

const supportedImageTypes = ["image/png", "image/jpeg", "image/webp"];

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function copyGame(game: Game): Game {
  return {
    ...game,
    platforms: [...game.platforms],
    tags: [...game.tags],
    screenshots: [...game.screenshots],
  };
}

function newGameId(): string {
  if (globalThis.crypto?.randomUUID)
    return "game-" + globalThis.crypto.randomUUID();
  return (
    "game-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 12)
  );
}

function blankGame(): Game {
  const now = new Date().toISOString();
  return {
    id: newGameId(),
    title: "",
    subtitle: "",
    description: "",
    developer: "",
    publisher: "",
    releaseDate: "",
    platforms: [],
    tags: [],
    cover: "",
    hero: "",
    screenshots: [],
    status: "draft",
    featured: false,
    createdAt: now,
    updatedAt: now,
  };
}

function detectImageType(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return undefined;
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let text = "";
  for (let start = 0; start < bytes.length; start += 0x8000)
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return "data:" + mime + ";base64," + btoa(text);
}

async function confirmDecodableImage(
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const blob = new Blob([copied.buffer], { type: mime });
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    if (
      bitmap.width > MAX_IMAGE_DIMENSION ||
      bitmap.height > MAX_IMAGE_DIMENSION ||
      bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
    ) {
      bitmap.close();
      throw new Error("图片尺寸不能超过 8192 像素边长或 1600 万像素");
    }
    bitmap.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (
          image.naturalWidth > MAX_IMAGE_DIMENSION ||
          image.naturalHeight > MAX_IMAGE_DIMENSION ||
          image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS
        ) {
          reject(new Error("图片尺寸不能超过 8192 像素边长或 1600 万像素"));
          return;
        }
        resolve();
      };
      image.onerror = () => reject(new Error("图片无法解码"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  if (file.size === 0) throw new Error("图片文件为空");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("单张图片不能超过 1.5 MiB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageType(bytes);
  if (!mime || !supportedImageTypes.includes(mime))
    throw new Error("仅支持实际内容为 PNG、JPEG 或 WebP 的图片");
  await confirmDecodableImage(bytes, mime);
  return toDataUrl(bytes, mime);
}

function splitList(value: string): string[] {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inputField(
  labelText: string,
  id: string,
  input: HTMLInputElement | HTMLTextAreaElement,
): HTMLLabelElement {
  const label = create("label", "game-editor-field");
  const text = create("span", "game-editor-label");
  text.textContent = labelText;
  input.id = id;
  label.htmlFor = id;
  label.append(text, input);
  return label;
}

export function initGameEditor(options: GameEditorOptions): GameEditor {
  const dialog = create("dialog", "game-editor-dialog");
  dialog.setAttribute("aria-labelledby", "game-editor-title");
  const form = create("form", "game-editor-form");
  form.noValidate = true;
  const heading = create("div", "game-editor-heading");
  const headingContent = create("div");
  const eyebrow = create("p", "game-editor-eyebrow");
  eyebrow.textContent = "本机游戏资料库";
  const headingTitle = create("h2");
  headingTitle.id = "game-editor-title";
  headingTitle.textContent = "添加游戏资料";
  const headingHint = create("p", "game-editor-heading-hint");
  headingHint.textContent = "资料只保存在当前设备，可在管理页导入或导出。";
  headingContent.append(eyebrow, headingTitle, headingHint);
  const close = create("button", "game-editor-close");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "关闭游戏资料编辑器");
  close.title = "关闭";
  heading.append(headingContent, close);

  const body = create("div", "game-editor-body");
  const mediaColumn = create("section", "game-editor-media");
  mediaColumn.setAttribute("aria-label", "游戏图片");
  const fieldsColumn = create("section", "game-editor-fields");
  fieldsColumn.setAttribute("aria-label", "游戏信息");
  body.append(mediaColumn, fieldsColumn);

  const titleInput = create("input");
  titleInput.type = "text";
  titleInput.maxLength = 120;
  titleInput.autocomplete = "off";
  titleInput.placeholder = "例如：星港回响";
  const subtitleInput = create("input");
  subtitleInput.type = "text";
  subtitleInput.maxLength = 200;
  subtitleInput.autocomplete = "off";
  subtitleInput.placeholder = "一句话说明它的特色";
  const descriptionInput = create("textarea");
  descriptionInput.maxLength = 10_000;
  descriptionInput.rows = 6;
  descriptionInput.placeholder = "玩法、故事、适合什么玩家……";
  const developerInput = create("input");
  developerInput.type = "text";
  developerInput.maxLength = 120;
  developerInput.autocomplete = "off";
  const publisherInput = create("input");
  publisherInput.type = "text";
  publisherInput.maxLength = 120;
  publisherInput.autocomplete = "off";
  const releaseDateInput = create("input");
  releaseDateInput.type = "date";
  const platformsInput = create("input");
  platformsInput.type = "text";
  platformsInput.maxLength = 599;
  platformsInput.placeholder = "Windows, Steam Deck";
  const tagsInput = create("input");
  tagsInput.type = "text";
  tagsInput.maxLength = 791;
  tagsInput.placeholder = "动作, 单人, 肉鸽";
  const featuredInput = create("input");
  featuredInput.type = "checkbox";
  const featuredLabel = create("label", "game-editor-featured");
  featuredLabel.append(
    featuredInput,
    document.createTextNode("在首页推荐展示"),
  );

  fieldsColumn.append(
    inputField("游戏名称", "game-editor-name", titleInput),
    inputField("短介绍", "game-editor-subtitle", subtitleInput),
    inputField("详细介绍", "game-editor-description", descriptionInput),
  );
  const companyFields = create("div", "game-editor-two-fields");
  companyFields.append(
    inputField("开发商", "game-editor-developer", developerInput),
    inputField("发行商", "game-editor-publisher", publisherInput),
  );
  const catalogFields = create("div", "game-editor-two-fields");
  catalogFields.append(
    inputField("发行日期", "game-editor-release-date", releaseDateInput),
    inputField("游戏平台（逗号分隔）", "game-editor-platforms", platformsInput),
  );
  fieldsColumn.append(
    companyFields,
    catalogFields,
    inputField("标签（逗号分隔）", "game-editor-tags", tagsInput),
    featuredLabel,
  );

  const singleControls = new Map<ImageSlot, SingleImageControls>();
  function addSingleImage(slot: ImageSlot, label: string, hint: string) {
    const section = create("section", "game-editor-image-card");
    const cardHeading = create("div", "game-editor-image-heading");
    const cardTitle = create("strong");
    cardTitle.textContent = label;
    const cardHint = create("span");
    cardHint.textContent = hint;
    cardHeading.append(cardTitle, cardHint);
    const preview = create(
      "div",
      "game-editor-image-preview game-editor-" + slot + "-preview",
    );
    const image = create("img");
    image.alt = label + "预览";
    image.hidden = true;
    const empty = create("span");
    empty.textContent = "还没有图片";
    preview.append(image, empty);
    const actions = create("div", "game-editor-image-actions");
    const file = create("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.hidden = true;
    const choose = create("button", "secondary");
    choose.type = "button";
    choose.textContent = "选择图片";
    const remove = create("button", "game-editor-remove");
    remove.type = "button";
    remove.textContent = "移除";
    actions.append(choose, remove, file);
    section.append(cardHeading, preview, actions);
    mediaColumn.append(section);
    choose.addEventListener("click", () => file.click());
    singleControls.set(slot, { image, empty, remove, file });
  }
  addSingleImage(
    "cover",
    "封面",
    "展示游戏必填 · PNG / JPEG / WebP · 最大 1.5 MiB",
  );
  addSingleImage("hero", "横幅", "可选 · 用于详情页头图");

  const screenshots = create("section", "game-editor-screenshots");
  const screenshotHeading = create("div", "game-editor-screenshot-heading");
  const screenshotTitle = create("div");
  const screenshotStrong = create("strong");
  screenshotStrong.textContent = "游戏截图";
  const screenshotHint = create("span");
  screenshotHint.textContent =
    "最多 " + MAX_SCREENSHOTS + " 张 · 每张最大 1.5 MiB";
  screenshotTitle.append(screenshotStrong, screenshotHint);
  const screenshotFile = create("input");
  screenshotFile.type = "file";
  screenshotFile.accept = "image/png,image/jpeg,image/webp";
  screenshotFile.multiple = true;
  screenshotFile.hidden = true;
  const addScreenshots = create("button", "secondary");
  addScreenshots.type = "button";
  addScreenshots.textContent = "添加截图";
  screenshotHeading.append(screenshotTitle, addScreenshots, screenshotFile);
  const screenshotList = create("div", "game-editor-screenshot-list");
  screenshots.append(screenshotHeading, screenshotList);
  mediaColumn.append(screenshots);

  const error = create("p", "game-editor-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  const actions = create("div", "game-editor-actions");
  const draft = create("button", "secondary");
  draft.type = "button";
  draft.textContent = "保存草稿";
  const publish = create("button", "primary");
  publish.type = "button";
  publish.textContent = "保存并展示";
  const uploadState = create("span", "game-editor-upload-state");
  uploadState.hidden = true;
  uploadState.setAttribute("role", "status");
  actions.append(uploadState, draft, publish);
  form.append(heading, body, error, actions);
  dialog.append(form);
  document.body.append(dialog);

  let active: Game | undefined;
  let dirty = false;
  let saving = false;
  let uploading = 0;
  let session = 0;
  let screenshotGeneration = 0;
  const imageGenerations: Record<ImageSlot, number> = { cover: 0, hero: 0 };

  function renderImages() {
    if (!active) return;
    for (const slot of ["cover", "hero"] as const) {
      const controls = singleControls.get(slot)!;
      const source = active[slot];
      controls.image.hidden = !source;
      controls.empty.hidden = Boolean(source);
      controls.remove.hidden = !source;
      controls.remove.disabled = saving;
      if (source) controls.image.src = source;
      else controls.image.removeAttribute("src");
    }
    screenshotList.replaceChildren();
    if (!active.screenshots.length) {
      const empty = create("span", "game-editor-screenshot-empty");
      empty.textContent = "添加实机截图，让资料页更完整。";
      screenshotList.append(empty);
    }
    active.screenshots.forEach((source, index) => {
      const card = create("figure", "game-editor-screenshot");
      const image = create("img");
      image.src = source;
      image.alt = "游戏截图 " + String(index + 1);
      const remove = create("button", "game-editor-screenshot-remove");
      remove.type = "button";
      remove.textContent = "移除";
      remove.disabled = saving;
      remove.addEventListener("click", () => {
        if (!active || saving) return;
        active.screenshots.splice(index, 1);
        changed(true);
      });
      card.append(image, remove);
      screenshotList.append(card);
    });
  }

  function updateControls() {
    const locked = saving || uploading > 0;
    close.disabled = locked;
    draft.disabled = locked;
    publish.disabled = locked;
    uploadState.hidden = uploading === 0;
    uploadState.textContent = uploading ? "正在读取并校验图片…" : "";
    addScreenshots.disabled =
      locked || !active || active.screenshots.length >= MAX_SCREENSHOTS;
    screenshotFile.disabled = locked;
    for (const controls of singleControls.values()) {
      controls.file.disabled = locked;
      controls.remove.disabled = locked || Boolean(controls.remove.hidden);
    }
    form
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="file"]), textarea',
      )
      .forEach((control) => {
        control.disabled = saving;
      });
    form.classList.toggle("game-editor-saving", saving);
  }

  function changed(images = false) {
    dirty = true;
    error.hidden = true;
    if (images) renderImages();
    updateControls();
  }

  function fill(game: Game) {
    titleInput.value = game.title;
    subtitleInput.value = game.subtitle;
    descriptionInput.value = game.description;
    developerInput.value = game.developer;
    publisherInput.value = game.publisher;
    releaseDateInput.value = game.releaseDate;
    platformsInput.value = game.platforms.join(", ");
    tagsInput.value = game.tags.join(", ");
    featuredInput.checked = game.featured;
  }

  function read(status: Game["status"]): Game {
    if (!active) throw new Error("编辑器尚未打开");
    return {
      ...active,
      title: titleInput.value.trim(),
      subtitle: subtitleInput.value.trim(),
      description: descriptionInput.value.trim(),
      developer: developerInput.value.trim(),
      publisher: publisherInput.value.trim(),
      releaseDate: releaseDateInput.value,
      platforms: splitList(platformsInput.value),
      tags: splitList(tagsInput.value),
      featured: featuredInput.checked,
      status,
      updatedAt: new Date().toISOString(),
    };
  }

  function showError(text: string) {
    error.textContent = text;
    error.hidden = false;
  }

  async function replaceSingle(slot: ImageSlot, file: File) {
    if (!active || saving) return;
    const request = ++imageGenerations[slot];
    const requestSession = session;
    uploading++;
    updateControls();
    try {
      const dataUrl = await fileToDataUrl(file);
      if (
        request !== imageGenerations[slot] ||
        requestSession !== session ||
        !active
      )
        return;
      active[slot] = dataUrl;
      changed(true);
    } catch (reason) {
      if (request === imageGenerations[slot] && requestSession === session)
        options.notify(errorMessage(reason), true);
    } finally {
      uploading--;
      if (request === imageGenerations[slot])
        singleControls.get(slot)!.file.value = "";
      updateControls();
    }
  }

  async function addScreenshotFiles(files: File[]) {
    if (!active || saving || !files.length) return;
    const available = MAX_SCREENSHOTS - active.screenshots.length;
    if (files.length > available) {
      options.notify("还可以添加 " + available + " 张截图。", true);
      return;
    }
    const request = ++screenshotGeneration;
    const requestSession = session;
    uploading++;
    updateControls();
    try {
      const images: string[] = [];
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        if (request !== screenshotGeneration || requestSession !== session)
          return;
        images.push(dataUrl);
      }
      if (
        request !== screenshotGeneration ||
        requestSession !== session ||
        !active
      )
        return;
      active.screenshots.push(...images);
      changed(true);
    } catch (reason) {
      if (request === screenshotGeneration && requestSession === session)
        options.notify(errorMessage(reason), true);
    } finally {
      uploading--;
      if (request === screenshotGeneration) screenshotFile.value = "";
      updateControls();
    }
  }

  function canClose(): boolean {
    if (saving || uploading > 0) return false;
    return !dirty || window.confirm("尚未保存的游戏资料会丢失，确定关闭吗？");
  }

  function closeEditor() {
    if (!canClose()) return;
    dialog.close();
  }

  async function persist(status: Game["status"]) {
    if (saving || uploading || !active) return;
    const game = read(status);
    const errors = validateGame(game, {
      requirePublished: status === "published",
    });
    if (errors.length) {
      showError(errors[0]);
      return;
    }
    saving = true;
    updateControls();
    try {
      await options.save(game);
      active = copyGame(game);
      dirty = false;
      options.notify(
        status === "published"
          ? "游戏资料已保存并展示。"
          : "游戏资料已保存为草稿。",
      );
      dialog.close();
    } catch (reason) {
      showError("保存失败：" + errorMessage(reason));
    } finally {
      saving = false;
      updateControls();
    }
  }

  for (const control of [
    titleInput,
    subtitleInput,
    descriptionInput,
    developerInput,
    publisherInput,
    releaseDateInput,
    platformsInput,
    tagsInput,
    featuredInput,
  ])
    control.addEventListener("input", () => changed());
  featuredInput.addEventListener("change", () => changed());
  for (const slot of ["cover", "hero"] as const) {
    const controls = singleControls.get(slot)!;
    controls.file.addEventListener("change", () => {
      const file = controls.file.files?.[0];
      if (file) void replaceSingle(slot, file);
    });
    controls.remove.addEventListener("click", () => {
      if (!active || saving) return;
      imageGenerations[slot]++;
      active[slot] = "";
      changed(true);
    });
  }
  addScreenshots.addEventListener("click", () => screenshotFile.click());
  screenshotFile.addEventListener("change", () => {
    const files = [...(screenshotFile.files ?? [])];
    if (files.length) void addScreenshotFiles(files);
  });
  close.addEventListener("click", closeEditor);
  draft.addEventListener("click", () => void persist("draft"));
  publish.addEventListener("click", () => void persist("published"));
  dialog.addEventListener("cancel", (event) => {
    if (!canClose()) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    session++;
    for (const slot of ["cover", "hero"] as const) imageGenerations[slot]++;
    screenshotGeneration++;
    active = undefined;
    dirty = false;
    error.hidden = true;
  });

  return {
    open(game?: Game) {
      if (dialog.open && !canClose()) return;
      session++;
      for (const slot of ["cover", "hero"] as const) imageGenerations[slot]++;
      screenshotGeneration++;
      for (const controls of singleControls.values()) controls.file.value = "";
      screenshotFile.value = "";
      active = game ? copyGame(game) : blankGame();
      dirty = false;
      saving = false;
      headingTitle.textContent = game ? "编辑游戏资料" : "添加游戏资料";
      headingHint.textContent = game
        ? "修改会保存到本机资料库，随时可导出备份。"
        : "先保存草稿，再补充封面和展示信息。";
      fill(active);
      renderImages();
      updateControls();
      if (!dialog.open) dialog.showModal();
    },
  };
}
