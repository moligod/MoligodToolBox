import * as Blockly from "blockly/core";

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
