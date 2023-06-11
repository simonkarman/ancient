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
  it('should callback listener on emit with the provided value', async () => {
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
  it('should callback each listener on emit', async () => {
    const helloMock1 = jest.fn();
    const helloMock2 = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', helloMock1);
    emitter.on('hello', helloMock2);
    emitter.test();
    expect(helloMock1).toBeCalledTimes(1);
    expect(helloMock2).toBeCalledTimes(1);
  });
  it('should allow emitting an event without any listeners', async () => {
    const emitter = new ExampleEmitter();
    emitter.test();
  });
  it('should callback a listener only once on emit if it is registered twice', async () => {
    const helloMock = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', helloMock);
    emitter.on('hello', helloMock);
    emitter.test();
    expect(helloMock).toBeCalledTimes(1);
  });
  it('should catch a listener that throws and return the error', async () => {
    const helloMock = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', () => helloMock());
    emitter.on('hello', jest.fn(() => { helloMock(); throw Error('custom'); }));
    emitter.on('hello', () => helloMock());
    expect(emitter.test()).toStrictEqual([[Error('custom')], []]);
    expect(helloMock).toBeCalledTimes(3);
  });
  it('should not allow subscriptions on the specific event(s) being emitted', async () => {
    class RecursiveEmitter extends EventEmitter<ExampleEvents> {
      test() {
        const helloMock = jest.fn();
        const fileMock = jest.fn();
        this.on('hello', () => {
          expect(() => this.on('hello', helloMock)).toThrow('cannot subscribe to \'hello\' event while that is also being emitted');
          expect(() => this.on('file', fileMock)).not.toThrow();
          expect(() => this.emit('file', 2, 'a')).not.toThrow();
        });
        expect(this.emit('hello', 'simon')).toStrictEqual([]);
        expect(fileMock).toBeCalledTimes(1);
        expect(helloMock).toBeCalledTimes(0);
      }
    }
    new RecursiveEmitter().test();
  });
  it('should not allow subscriptions on all event(s) being currently emitted', async () => {
    class RecursiveEmitter extends EventEmitter<ExampleEvents> {
      test() {
        const mock = jest.fn();
        this.on('hello', (name: string) => {
          expect(() => this.on('hello', mock)).toThrow('cannot subscribe to \'hello\' event while that is also being emitted');
          if (name === 'from-file') {
            expect(() => this.on('file', mock)).toThrow('cannot subscribe to \'file\' event while that is also being emitted');
          } else if (name === 'from-root') {
            this.emit('hello', 'from-hello');
          } else {
            expect(() => this.on('file', mock)).not.toThrow();
          }
          expect(() => this.on('hello', mock)).toThrow('cannot subscribe to \'hello\' event while that is also being emitted');
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
});
