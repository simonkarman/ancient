// Inspired by Tech Talk with Simon (Building a better EventEmitter)
// - YouTube: https://www.youtube.com/watch?v=Pl7pDjWd830
// - Gist: https://gist.github.com/sstur/f205140b0965a0449932a364323db8dd

type Listener<T extends Array<unknown>> = (...args: T) => void;

export interface IEventEmitter<EventMap extends Record<string, Array<unknown>>> {
  on<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void;
}

/**
 * An abstract type safe event emitter with a protected emit method that doesn't allow subscriptions while emitting.
 */
export abstract class EventEmitter<EventMap extends Record<string, Array<unknown>>> implements IEventEmitter<EventMap> {
  private eventListeners: {
    [K in keyof EventMap]?: Set<Listener<EventMap[K]>>;
  } = {};
  private isEmitting: (keyof EventMap)[] = [];

  public on<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void {
    if (this.isEmitting.includes(eventName)) {
      throw new Error(`cannot subscribe to '${String(eventName)}' event while that is also being emitted`);
    }
    const listeners = this.eventListeners[eventName] ?? new Set();
    listeners.add(listener);
    this.eventListeners[eventName] = listeners;
  }

  protected emit<K extends keyof EventMap>(eventName: K, ...args: EventMap[K]): unknown[] {
    this.isEmitting.push(eventName);
    const listeners = this.eventListeners[eventName] ?? new Set();
    const errors: unknown[] = [];
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (e: unknown) {
        errors.push(e);
        console.error(`[error] [event-emitter] [${String(eventName)}]`, e);
      }
    }
    this.isEmitting.pop();
    return errors;
  }
}