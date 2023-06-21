// Inspired by Tech Talk with Simon (Building a better EventEmitter)
// - YouTube: https://www.youtube.com/watch?v=Pl7pDjWd830
// - Gist: https://gist.github.com/sstur/f205140b0965a0449932a364323db8dd

type Listener<T extends Array<unknown>> = (...args: T) => void;

export interface EventListener<EventMap extends Record<string, Array<unknown>>> {
  name: string;

  on<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void;
  pipe<NextEventMap extends EventMap>(configurePipe?: (pipe: {
    tap<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void;
    end<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void;
    emit<K extends keyof NextEventMap>(eventName: K, ...args: NextEventMap[K]): unknown[],
  }) => void): EventListener<NextEventMap>;
}

/**
 * An abstract type safe event emitter that doesn't allow subscriptions while emitting and can be piped to event listeners.
 */
export class EventEmitter<EventMap extends Record<string, Array<unknown>>> implements EventListener<EventMap> {
  private eventListeners: {
    [K in keyof EventMap]?: Listener<EventMap[K]>[];
  } = {};
  private anyEventListeners: { listener: Listener<[keyof EventMap, ...EventMap[keyof EventMap]]>, logErrors: boolean }[] = [];
  private isEmitting: (keyof EventMap)[] = [];
  public name = 'event-emitter';

  public on<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void {
    if (this.isEmitting.includes(eventName)) {
      throw new Error(`cannot subscribe to '${String(eventName)}' event in ${this.name} while that is also being emitted`);
    }
    const listeners = this.eventListeners[eventName] ?? [];
    listeners.push(listener);
    this.eventListeners[eventName] = listeners;
  }

  public emit<K extends keyof EventMap>(eventName: K, ...args: EventMap[K]): unknown[] {
    this.isEmitting.push(eventName);
    const listeners = this.eventListeners[eventName] ?? [];
    const errors: unknown[] = [];
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (e: unknown) {
        if (e instanceof Array) {
          errors.push(...e);
        } else {
          errors.push(e);
        }
        console.error(`[error] [${this.name}] [on:${String(eventName)}]`, e);
      }
    }
    for (const listener of this.anyEventListeners) {
      try {
        listener.listener(eventName, ...args);
      } catch (e: unknown) {
        if (e instanceof Array) {
          errors.push(...e);
        } else {
          errors.push(e);
        }
        if (listener.logErrors) {
          console.error(`[error] [${this.name}] [on-any:${String(eventName)}]`, e);
        }
      }
    }
    this.isEmitting.pop();
    return errors;
  }

  public onAny(listener: Listener<[keyof EventMap, ...EventMap[keyof EventMap]]>, logErrors = true) {
    if (this.isEmitting.length !== 0) {
      throw new Error(`cannot subscribe to any events in ${this.name} while an event is being emitted`);
    }
    this.anyEventListeners.push({ listener, logErrors });
  }

  // TODO: resolve this
  //  situation: For a pipe, the default behaviour is the pass-through of each event and in the pipe you can tap or end specific events during runtime
  //  problem: The type system has to assume everything is passed through, as that's the default unless overwritten with an 'end' at runtime
  //  use-case: In some cases it can be useful for the pipe to express (via the type system) that some events are never passed through
  //  consideration: Remove default pass through functionality entirely as this means the onAny functionality can be removed
  //  solution:
  //   A: Make a new 'pipe'-like method on listener, that by default ends every event (come up with a logical name for this)
  //   -- OR --
  //   B: only setup onAny / default pass through functionality when pipe.defaultPassThrough is invoked, but make that method only available if NextEventMap
  //      extends from EventMap otherwise it can be set to never
  //   -- OR --
  //   C: create pipe.PassThrough(events: string[]) that you can only allow for event names that are in both EventMap and NextEventMap and also have the
  //      same call signature
  public pipe<NextEventMap extends EventMap>(configurePipe?: (pipe: {
    tap<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void;
    end<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>): void;
    emit<K extends keyof NextEventMap>(eventName: K, ...args: NextEventMap[K]): unknown[],
  }) => void): EventListener<NextEventMap> {
    const nextEmitter = new EventEmitter<NextEventMap>();
    nextEmitter.name = `piped(${this.name})`;
    const overridden: Set<keyof EventMap> = new Set();
    this.onAny((eventName, ...args) => {
      if (overridden.has(eventName)) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const errors = nextEmitter.emit(eventName, ...args);
      if (errors.length !== 0) {
        throw errors;
      }
    }, false);
    configurePipe && configurePipe({
      tap: <K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>) => {
        this.on(eventName, listener);
      },
      end: <K extends keyof EventMap>(eventName: K, listener?: Listener<EventMap[K]>) => {
        overridden.add(eventName);
        if (listener) {
          this.on(eventName, listener);
        }
      },
      emit: <K extends keyof NextEventMap>(eventName: K, ...args: NextEventMap[K]): unknown[] => {
        return nextEmitter.emit(eventName, ...args);
      },
    });
    return nextEmitter;
  }
}
