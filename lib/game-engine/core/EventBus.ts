/**
 * Простая шина событий для связи подсистем.
 */
export type EventMap = Record<string, unknown>;

type Handler<Payload> = (payload: Payload) => void;

export class EventBus<Events extends EventMap = Record<string, unknown>> {
  private listeners: {
    [K in keyof Events]?: Set<Handler<Events[K]>>;
  } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(handler);

    return () => {
      set?.delete(handler);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
