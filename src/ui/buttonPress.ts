type ButtonPointer = {
  readonly id: number;
  readonly isDown: boolean;
};

/** Tracks the gesture independently of hover/pressed artwork. */
export class ButtonPress {
  private pointerId: number | undefined;

  get isPressed(): boolean {
    return this.pointerId !== undefined;
  }

  down(pointer: ButtonPointer): void {
    this.pointerId ??= pointer.id;
  }

  out(pointer: ButtonPointer): void {
    // Touch release may clear hover before the button receives pointerup.
    // Moving off while still held cancels the gesture instead.
    if (pointer.isDown) this.reset(pointer);
  }

  up(pointer: ButtonPointer): boolean {
    if (this.pointerId !== pointer.id) return false;
    this.reset(pointer);
    return true;
  }

  reset(pointer?: ButtonPointer): void {
    if (!pointer || this.pointerId === pointer.id) this.pointerId = undefined;
  }
}
