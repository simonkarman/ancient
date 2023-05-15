import { EventEmitter } from '../src/event-emitter';

describe('Event Emitter', () => {
  type ExampleEvents = {
    hello: [name: string],
    file: [size: number, name: string];
  }
  class ExampleEmitter extends EventEmitter<ExampleEvents> {
    test() {
      this.emit('hello', 'world');
      this.emit('file', 11, 'example.json');
    }
  }
  test('should callback listener on emit with the provided value', async () => {
    let receivedFromHello: [string] | undefined;
    let receivedFromFile: [number, string] | undefined;
    const emitter = new ExampleEmitter();
    emitter.on('hello', (name) => {
      receivedFromHello = [name];
    });
    emitter.on('file', (size, name) => {
      receivedFromFile = [size, name];
    });
    emitter.test();
    expect(receivedFromHello).toStrictEqual(['world']);
    expect(receivedFromFile).toStrictEqual([11, 'example.json']);
  });
  test('should callback each listener on emit', async () => {
    const helloMock1 = jest.fn();
    const helloMock2 = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', helloMock1);
    emitter.on('hello', helloMock2);
    emitter.test();
    expect(helloMock1).toBeCalledTimes(1);
    expect(helloMock2).toBeCalledTimes(1);
  });
  test('should allow emitting an event without any listeners', async () => {
    const emitter = new ExampleEmitter();
    emitter.test();
  });
  test('should callback a listener only once on emit if it was already registered', async () => {
    const helloMock = jest.fn();
    const emitter = new ExampleEmitter();
    emitter.on('hello', helloMock);
    emitter.on('hello', helloMock);
    emitter.test();
    expect(helloMock).toBeCalledTimes(1);
  });
});
