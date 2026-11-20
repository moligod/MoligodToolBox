import * as Blockly from "blockly/core";
import type { ActionBlock } from "./automation-blockly-blocks.ts";

function positionAtRight(block: ActionBlock, element: SVGElement) {
  const bounds = (block.pathObject.svgPath as SVGGraphicsElement).getBBox();
  const x = bounds.x + bounds.width + 5;
  element.setAttribute("x", String(x));
  return x;
}

/** Attach one button to the selected action so it follows canvas pan and zoom. */
export function createCommentShortcut(addComment: (block: ActionBlock) => void) {
  const control = Blockly.utils.dom.createSvgElement(
    Blockly.utils.Svg.FOREIGNOBJECT,
    { class: "auto-blockly-comment-shortcut", y: 7, width: 28, height: 28 },
  );
  const button = document.createElement("button");
  button.type = "button";
  button.className = "auto-blockly-add-comment";
  button.textContent = "+";
  button.title = "添加注释";
  button.setAttribute("aria-label", button.title);
  control.append(button);

  let selected: ActionBlock | undefined;
  function position() {
    if (selected) positionAtRight(selected, control);
  }
  const observer = new ResizeObserver(position);
  for (const type of ["pointerdown", "keydown"]) {
    button.addEventListener(type, event => event.stopPropagation());
  }
  button.addEventListener("click", event => {
    event.stopPropagation();
    if (selected) addComment(selected);
  });
  return (block?: ActionBlock) => {
    if (block === selected) return;
    observer.disconnect();
    control.remove();
    selected = block;
    if (block) {
      position();
      block.getSvgRoot().append(control);
      observer.observe(block.pathObject.svgPath);
    }
  };
}

type AnnotationEditor = { control: SVGElement; input: HTMLTextAreaElement };
const annotations = new WeakMap<ActionBlock, AnnotationEditor>();
const annotationSize = { y: 4, width: 200, height: 36 };

function twoLineText(value: string) {
  const [first, ...rest] = value.split(/\r\n?|[\n\u2028\u2029]/);
  return rest.length ? `${first}\n${rest.join(" ")}` : first;
}

function fitAnnotationWidth({ control, input }: AnnotationEditor) {
  // Use the textarea's own wrapping, including fallback fonts and wide glyphs.
  for (let width = annotationSize.width; width < 0x1000000; width = Math.ceil(width * 1.125)) {
    control.setAttribute("width", String(width));
    if (input.scrollHeight <= input.clientHeight && input.scrollWidth <= input.clientWidth) break;
  }
}

export function renderAnnotation(
  block: ActionBlock,
  edit: (block: ActionBlock, value: string) => void,
  open = false,
) {
  const value = block.payload.step.annotation ?? "";
  const readOnly = block.workspace.isReadOnly();
  let editor = annotations.get(block);
  if (!value && !open && (readOnly || editor?.input !== document.activeElement)) {
    if (editor) {
      editor.control.remove();
      annotations.delete(block);
    }
    return;
  }
  if (!editor) {
    const control = Blockly.utils.dom.createSvgElement(
      Blockly.utils.Svg.FOREIGNOBJECT,
      { class: "auto-blockly-annotation", ...annotationSize },
      block.getSvgRoot(),
    );
    const input = document.createElement("textarea");
    input.className = "auto-blockly-annotation-input";
    input.setAttribute("aria-label", "动作注解");
    input.placeholder = "写注解…";
    for (const type of ["pointerdown", "keydown", "wheel"])
      input.addEventListener(type, event => event.stopPropagation());
    const view = { control, input };
    input.addEventListener("input", () => {
      const value = twoLineText(input.value);
      if (value !== input.value) {
        const caret = input.selectionStart;
        input.value = value;
        input.setSelectionRange(caret, caret);
      }
      fitAnnotationWidth(view);
      edit(block, value);
    });
    input.addEventListener("blur", () => {
      if (block.payload.step.annotation) return;
      control.remove();
      annotations.delete(block);
    });
    control.append(input);
    annotations.set(block, editor = view);
  }
  editor.input.readOnly = readOnly;
  const text = twoLineText(value);
  if (editor.input.value !== text) {
    editor.input.value = text;
    requestAnimationFrame(() => fitAnnotationWidth(editor!));
  }
  const x = positionAtRight(block, editor.control);
  if (open) {
    const xy = block.getRelativeToSurfaceXY();
    const top = xy.y + annotationSize.y, left = xy.x + x;
    block.workspace.scrollBoundsIntoView(new Blockly.utils.Rect(
      top, top + annotationSize.height, left, left + annotationSize.width,
    ));
    editor.input.focus({ preventScroll: true });
  }
}

/** A compact multiline editor inside a standalone comment action. */
export class CommentField extends Blockly.FieldLabel {
  private input?: HTMLTextAreaElement;
  private onEdit: (value: string) => void;

  constructor(value: string, onEdit: (value: string) => void) {
    super(value);
    this.onEdit = onEdit;
  }

  override initView() {
    const foreign = Blockly.utils.dom.createSvgElement(
      Blockly.utils.Svg.FOREIGNOBJECT,
      { width: 240, height: 24 },
      this.fieldGroup_!,
    );
    const input = document.createElement("textarea");
    input.className = "auto-blockly-comment-input";
    input.setAttribute("aria-label", "注解内容");
    input.placeholder = "输入注解…";
    input.rows = 1;
    input.spellcheck = false;
    input.value = this.getValue() ?? "";
    for (const name of ["pointerdown", "keydown", "wheel"])
      input.addEventListener(name, (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      if (this.getSourceBlock()?.workspace.isReadOnly()) return;
      this.onEdit(input.value);
      this.setValue(input.value, false);
    });
    foreign.append(input);
    this.input = input;
    this.updateEditable();
  }

  protected override render_() {
    this.size_.width = 240;
    this.size_.height = 24;
  }

  override updateEditable() {
    super.updateEditable();
    if (this.input)
      this.input.readOnly =
        this.getSourceBlock()?.workspace.isReadOnly() ?? true;
  }
}
