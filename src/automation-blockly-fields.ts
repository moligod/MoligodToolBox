import * as Blockly from "blockly/core";

/** Empty editable values should still offer a usable click target. */
export class TextField extends Blockly.FieldTextInput {
  protected override get size_() {
    const size = super.size_;
    if (!this.getValue()) size.width = Math.max(56, size.width);
    return size;
  }

  protected override set size_(value: Blockly.utils.Size) {
    super.size_ = value;
  }
}

/** Refresh the native list before opening, and never reopen after dismissal. */
export class WindowDropdown extends Blockly.FieldDropdown {
  private refresh: () => Promise<void>;
  private pending?: AbortController;

  constructor(options: () => [string, string][], refresh: () => Promise<void>) {
    super(options);
    this.refresh = refresh;
  }

  protected override showEditor_(event?: MouseEvent) {
    this.pending?.abort();
    const pending = new AbortController();
    this.pending = pending;
    document.addEventListener("pointerdown", () => pending.abort(), {
      capture: true,
      signal: pending.signal,
    });
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") pending.abort();
      },
      { capture: true, signal: pending.signal },
    );
    void this.refresh()
      .then(() => {
        if (
          pending.signal.aborted ||
          this.disposed ||
          this.getSourceBlock()?.workspace.isReadOnly()
        )
          return;
        this.getOptions(false);
        super.showEditor_(event);
      })
      .catch(() => {
        // The workspace reports the native refresh failure to the user.
      })
      .finally(() => {
        pending.abort();
        if (this.pending === pending) this.pending = undefined;
      });
  }

  override dispose() {
    this.pending?.abort();
    super.dispose();
  }
}
