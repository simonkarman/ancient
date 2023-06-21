import { EventEmitter } from '../src/event-emitter';

describe('Event Emitter', () => {
  type ExampleEvents = {
    hello: [name: string],
    file: [size: number, name: string];
  }
  class ExampleEmitter extends EventEmitter<ExampleEvents> {
    test(): [unknown[], unknown[]] {
      return [
        this.emit('hello', 'world'),
        this.emit('file', 11, 'example.json'),
      ];
    }
  }
  it('should callback listener on emit with the provided value', () => {
    let receivedFromHello: [string] | undefined;
    let receivedFromFile: [number, string] | undefined;
    const emitter = new ExampleEmitter();
    emitter.on('hello', (name) => {
      receivedFromHello = [name];
    });
    emitter.on('file', (size, name) => {
      receivedFromFile = [size, name];
    });
    expect(emitter.test()).toStrictEqual([[], []]);
    expect(receivedFromHello).toStrictEqual(['world']);
    expect(receivedFromFile).toStrictEqual([11, 'example.json']);
  });
  it('should callback each listener on emit', () => {
    const helloMock1 = jest.fn();
    const helloMock2 = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', helloMock1);
    emitter.on('hello', helloMock2);
    emitter.test();
    expect(helloMock1).toBeCalledTimes(1);
    expect(helloMock2).toBeCalledTimes(1);
  });
  it('should allow emitting an event without any listeners', () => {
    const emitter = new ExampleEmitter();
    emitter.test();
  });
  it('should callback a listener twice on emit if it is registered twice', () => {
    const helloMock = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', helloMock);
    emitter.on('hello', helloMock);
    emitter.test();
    expect(helloMock).toBeCalledTimes(2);
  });
  it('should catch a listener that throws and return the errors', () => {
    const helloMock = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', () => helloMock());
    emitter.on('hello', jest.fn(() => { helloMock(); throw Error('custom'); }));
    emitter.on('hello', () => helloMock());
    expect(emitter.test()).toStrictEqual([[Error('custom')], []]);
    expect(helloMock).toBeCalledTimes(3);
  });
  it('should return a flatted list of errors if the errors thrown are arrays', () => {
    const emitter = new ExampleEmitter();
    emitter.on('hello', () => {
      throw [Error('1'), Error('2')];
    });
    emitter.on('hello', () => {
      throw [Error('3'), Error('4')];
    });
    expect(emitter.test()).toStrictEqual([[Error('1'), Error('2'), Error('3'), Error('4')], []]);
  });
  it('should not allow subscriptions on the specific event(s) being emitted', () => {
    class RecursiveEmitter extends EventEmitter<ExampleEvents> {
      test() {
        const helloMock = jest.fn();
        const fileMock = jest.fn();
        this.on('hello', () => {
          expect(() => this.on('hello', helloMock)).toThrow('cannot subscribe to \'hello\' event in my-emitter while that is also being emitted');
          expect(() => this.on('file', fileMock)).not.toThrow();
          expect(() => this.emit('file', 2, 'a')).not.toThrow();
        });
        expect(this.emit('hello', 'simon')).toStrictEqual([]);
        expect(fileMock).toBeCalledTimes(1);
        expect(helloMock).toBeCalledTimes(0);
      }
    }
    const emitter = new RecursiveEmitter();
    emitter.name = 'my-emitter';
    emitter.test();
  });
  it('should not allow subscriptions on all event(s) being currently emitted', () => {
    class RecursiveEmitter extends EventEmitter<ExampleEvents> {
      test() {
        const mock = jest.fn();
        this.on('hello', (name: string) => {
          expect(() => this.on('hello', mock)).toThrow('cannot subscribe to \'hello\' event in event-emitter while that is also being emitted');
          if (name === 'from-file') {
            expect(() => this.on('file', mock)).toThrow('cannot subscribe to \'file\' event in event-emitter while that is also being emitted');
          } else if (name === 'from-root') {
            this.emit('hello', 'from-hello');
          } else {
            expect(() => this.on('file', mock)).not.toThrow();
          }
          expect(() => this.on('hello', mock)).toThrow('cannot subscribe to \'hello\' event in event-emitter while that is also being emitted');
        });
        this.on('file', () => {
          expect(this.emit('hello', 'from-file')).toStrictEqual([]);
        });
        expect(this.emit('file', 3, 'kg')).toStrictEqual([]);
        expect(this.emit('hello', 'from-root')).toStrictEqual([]);
        expect(mock).not.toBeCalled();
      }
    }
    new RecursiveEmitter().test();
  });
  it('should sent all events to an onAny listener', () => {
    const emitter = new EventEmitter<ExampleEvents>();
    const mock = jest.fn();
    emitter.onAny(mock);
    emitter.emit('hello', 'world');
    emitter.emit('file', 23, 'example.json');
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith('hello', 'world');
    expect(mock).toHaveBeenCalledWith('file', 23, 'example.json');
  });
  it('should not allow subscribing using an onAny listener when any event is emitting', () => {
    const emitter = new EventEmitter<ExampleEvents>();
    emitter.name = 'my-any-emitter';
    const mock = jest.fn();
    emitter.onAny(() => {
      emitter.onAny(mock);
    });
    const errors = emitter.emit('hello', 'world');
    expect(mock).not.toHaveBeenCalled();
    expect(errors).toStrictEqual([Error('cannot subscribe to any events in my-any-emitter while an event is being emitted')]);
  });
  it('should allow piping events to a new event emitter', () => {
    type EntryEvents = {
      'another': [value: string];
      'hello': [name: string];
      'bought': [price: number];
    }
    const entryPoint: EventEmitter<EntryEvents> = new EventEmitter<EntryEvents>();
    const second = entryPoint.pipe();
    const mock = jest.fn();
    second.on('hello', mock);
    second.on('bought', mock);
    let errors = entryPoint.emit('another', 'test');
    expect(mock).not.toHaveBeenCalled();
    expect(errors).toStrictEqual([]);
    errors = entryPoint.emit('hello', 'world');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('world');
    expect(errors).toStrictEqual([]);
    errors = entryPoint.emit('bought', 32);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith(32);
    expect(errors).toStrictEqual([]);
  });
  it('should return errors on emit when errors are thrown in a piped event listener', () => {
    type EntryEvents = { 'hello': [name: string] }
    const entryPoint: EventEmitter<EntryEvents> = new EventEmitter<EntryEvents>();
    const second = entryPoint.pipe();
    entryPoint.on('hello', () => {
      throw new Error('failure');
    });
    second.on('hello', () => {
      throw new Error('failure-from-piped');
    });
    const errors = entryPoint.emit('hello', 'world');
    expect(errors).toStrictEqual([Error('failure'), Error('failure-from-piped')]);
  });
  it('should allow chaining pipe multiple times on an event listeners', () => {
    type EntryEvents = { 'hello': [name: string] }
    const entryPoint: EventEmitter<EntryEvents> = new EventEmitter<EntryEvents>();
    const second = entryPoint.pipe().pipe().pipe();
    const mock = jest.fn();
    second.on('hello', mock);
    const errors = entryPoint.emit('hello', 'world');
    expect(errors).toStrictEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('world');
  });
  it('should allow ending and re-emitting specific events in the pipe configuration', () => {
    type EntryEvents = { 'hello': [name: string] }
    const entryPoint: EventEmitter<EntryEvents> = new EventEmitter<EntryEvents>();
    const inPipeMock = jest.fn();
    const afterPipeMock = jest.fn();
    const second = entryPoint.pipe(pipe => {
      pipe.end('hello', (name) => {
        if (name.startsWith('s')) {
          inPipeMock(name);
        } else {
          pipe.emit('hello', name);
        }
      });
    });
    second.on('hello', afterPipeMock);

    entryPoint.emit('hello', 'simon');
    expect(inPipeMock).toHaveBeenCalledTimes(1);
    expect(inPipeMock).toHaveBeenCalledWith('simon');
    expect(afterPipeMock).not.toHaveBeenCalled();
    entryPoint.emit('hello', 'lisa');
    expect(inPipeMock).toHaveBeenCalledTimes(1);
    expect(afterPipeMock).toHaveBeenCalledTimes(1);
    expect(afterPipeMock).toHaveBeenCalledWith('lisa');
  });
  it('should allow tapping and ending emits in a pipe', () => {
    type EntryEvents = { 'tapped': [], 'ended': [] }
    const entryPoint: EventEmitter<EntryEvents> = new EventEmitter<EntryEvents>();
    const tappedInPipe = jest.fn();
    const tappedAfterPipe = jest.fn();
    const endedInPipe = jest.fn();
    const endedAfterPipe = jest.fn();
    const second = entryPoint.pipe(pipe => {
      pipe.tap('tapped', tappedInPipe);
      pipe.end('ended', endedInPipe);
    });
    second.on('tapped', tappedAfterPipe);
    second.on('ended', endedAfterPipe);

    entryPoint.emit('tapped');
    entryPoint.emit('ended');
    expect(tappedInPipe).toHaveBeenCalled();
    expect(tappedAfterPipe).toHaveBeenCalled();
    expect(endedInPipe).toHaveBeenCalled();
    expect(endedAfterPipe).not.toHaveBeenCalled();
  });
  it('should allow emitting new events in a pipe', () => {
    type EntryEvents = { 'hello': [name: string] }
    const entryPoint: EventEmitter<EntryEvents> = new EventEmitter<EntryEvents>();
    const mock = jest.fn();
    const second = entryPoint.pipe<{ 'counter': [number] } & EntryEvents>(pipe => {
      let counter = 0;
      pipe.tap('hello', () => {
        counter += 1;
        pipe.emit('counter', counter);
      });
    });
    second.on('counter', mock);

    entryPoint.emit('hello', 'simon');
    entryPoint.emit('hello', 'lisa');
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith(1);
    expect(mock).toHaveBeenCalledWith(2);
  });
});
