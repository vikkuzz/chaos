/**
 * Простейший обработчик мыши для будущего редактора маршрутов.
 * Сейчас только прокидывает колбэки движку/React.
 */
export interface MouseInputHandlers {
  onClick?: (x: number, y: number) => void;
  onDragStart?: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (x: number, y: number) => void;
}

export class MouseInput {
  private readonly element: HTMLElement;
  private readonly handlers: MouseInputHandlers;
  private isDragging = false;

  constructor(element: HTMLElement, handlers: MouseInputHandlers) {
    this.element = element;
    this.handlers = handlers;

    this.element.addEventListener("mousedown", this.handleMouseDown);
    this.element.addEventListener("mousemove", this.handleMouseMove);
    this.element.addEventListener("mouseup", this.handleMouseUp);
    this.element.addEventListener("mouseleave", this.handleMouseUp);
  }

  destroy(): void {
    this.element.removeEventListener("mousedown", this.handleMouseDown);
    this.element.removeEventListener("mousemove", this.handleMouseMove);
    this.element.removeEventListener("mouseup", this.handleMouseUp);
    this.element.removeEventListener("mouseleave", this.handleMouseUp);
  }

  private getRelativeCoords(event: MouseEvent): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private handleMouseDown = (event: MouseEvent): void => {
    const { x, y } = this.getRelativeCoords(event);
    this.isDragging = true;
    this.handlers.onDragStart?.(x, y);
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging) return;
    const { x, y } = this.getRelativeCoords(event);
    this.handlers.onDragMove?.(x, y);
  };

  private handleMouseUp = (event: MouseEvent): void => {
    const { x, y } = this.getRelativeCoords(event);
    if (this.isDragging) {
      this.handlers.onDragEnd?.(x, y);
    } else {
      this.handlers.onClick?.(x, y);
    }
    this.isDragging = false;
  };
}
