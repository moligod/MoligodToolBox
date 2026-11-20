import * as Blockly from "blockly/core";

/** Keep the chosen category open while editing on the adjacent canvas. */
export class DockedToolbox extends Blockly.Toolbox {
  override setSelectedItem(item: Parameters<Blockly.Toolbox["setSelectedItem"]>[0]) {
    if (!item || item === this.getSelectedItem()) return;
    super.setSelectedItem(item);
  }
}

export class DockedFlyout extends Blockly.VerticalFlyout {
  private componentHint?: HTMLParagraphElement;

  override getFlyoutScale() {
    return 0.9;
  }

  private isComponentLibrary() {
    const selected = this.targetWorkspace?.getToolbox()?.getSelectedItem();
    return selected instanceof Blockly.ToolboxCategory && selected.getName() === "组件库";
  }

  override getWidth() {
    const width = super.getWidth();
    if (this.isComponentLibrary()) {
      return Math.min(width, this.targetWorkspace.getInjectionDiv().clientWidth / 4);
    }
    return width;
  }

  protected override positionAt_(width: number, height: number, x: number, y: number) {
    if (this.isComponentLibrary() && this.svgGroup_) {
      if (!this.componentHint) {
        this.componentHint = document.createElement("p");
        this.componentHint.className = "auto-component-hint";
        this.componentHint.textContent = "Ctrl 逐个选，Shift 选范围，右键「保存成组件」";
        this.svgGroup_.after(this.componentHint);
      }
      this.componentHint.hidden = false;
      this.componentHint.style.left = `${x}px`;
      this.componentHint.style.width = `${width}px`;
      // Give Blockly's scrollbar the space above the hint.
      height = Math.max(0, height - this.componentHint.offsetHeight);
    } else if (this.componentHint) {
      this.componentHint.hidden = true;
    }
    this.height_ = height;
    super.positionAt_(width, height, x, y);
  }

  override position() {
    super.position();
    if (!this.isVisible()) return;
    // Share the actual palette edge with the log dock and validation messages.
    const layout = this.targetWorkspace.getInjectionDiv().closest<HTMLElement>(".automation-layout");
    layout?.style.setProperty("--auto-dock-width", `${this.getX() + this.getWidth()}px`);
  }

  override dispose() {
    this.componentHint?.remove();
    super.dispose();
  }
}
