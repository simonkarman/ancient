// Inspired by Tech Talk with Simon (Building a better EventEmitter)
// - YouTube: https://www.youtube.com/watch?v=Pl7pDjWd830
// - Gist: https://gist.github.com/sstur/f205140b0965a0449932a364323db8dd

type Listener<T extends Array<unknown>> = (...args: T) => void;

/**
 * An abstract type safe event emitter with a protected emit method.
 */
export abstract class EventEmitter<EventMap extends Record<string, Array<unknown>>> {
  private eventListeners: {
    [K in keyof EventMap]?: Set<Listener<EventMap[K]>>;
  } = {};

  public on<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void {
    const listeners = this.eventListeners[eventName] ?? new Set();
    listeners.add(listener);
    this.eventListeners[eventName] = listeners;
  }

  protected emit<K extends keyof EventMap>(eventName: K, ...args: EventMap[K]): void {
    const listeners = this.eventListeners[eventName] ?? new Set();
    for (const listener of listeners) {
      listener(...args);
    }
  }
}
