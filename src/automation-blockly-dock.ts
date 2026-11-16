import * as Blockly from "blockly/core";

/** Keep the chosen category open while editing on the adjacent canvas. */
export class DockedToolbox extends Blockly.Toolbox {
  override setSelectedItem(item: Parameters<Blockly.Toolbox["setSelectedItem"]>[0]) {
    if (!item || item === this.getSelectedItem()) return;
    super.setSelectedItem(item);
  }
}

export class DockedFlyout extends Blockly.VerticalFlyout {
  override getFlyoutScale() {
    return 0.9;
  }

  override getWidth() {
    const width = super.getWidth();
    const selected = this.targetWorkspace?.getToolbox()?.getSelectedItem();
    if (selected instanceof Blockly.ToolboxCategory && selected.getName() === "组件库") {
      return Math.min(width, this.targetWorkspace.getInjectionDiv().clientWidth / 4);
    }
    return width;
  }

  override position() {
    super.position();
    if (!this.isVisible()) return;
    // Share the actual palette edge with the log dock and validation messages.
    const layout = this.targetWorkspace.getInjectionDiv().closest<HTMLElement>(".automation-layout");
    layout?.style.setProperty("--auto-dock-width", `${this.getX() + this.getWidth()}px`);
  }
}
