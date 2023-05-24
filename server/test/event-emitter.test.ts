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
  it('should ignore a listener that throws and return false', async () => {
    const helloMock = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', () => helloMock());
    emitter.on('hello', jest.fn(() => { helloMock(); throw Error('custom'); }));
    emitter.on('hello', () => helloMock());
    expect(emitter.test()).toStrictEqual([[Error('custom')], []]);
    expect(helloMock).toBeCalledTimes(3);
  });
  it('should not allow subscriptions or emits while emitting', async () => {
    class RecursiveEmitter extends EventEmitter<ExampleEvents> {
      test() {
        const helloMock = jest.fn();
        this.on('hello', () => {
          expect(() => this.on('hello', helloMock)).toThrow('cannot subscribe while emitting');
          expect(() => this.on('file', helloMock)).toThrow('cannot subscribe while emitting');
          expect(() => this.emit('hello', 'a')).toThrow('cannot emit while emitting');
          expect(() => this.emit('file', 2, 'a')).toThrow('cannot emit while emitting');
        });
        expect(this.emit('hello', 'simon')).toStrictEqual([]);
        expect(helloMock).toBeCalledTimes(0);
      }
    }
    new RecursiveEmitter().test();
  });
});
