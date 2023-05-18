import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserJoinMessage } from '../src/karman-server';

// eslint-disable-next-line no-process-env
export const sleep = (ms = Number.parseInt(process.env.DEFAULT_SLEEP_MS ?? '50', 10)) => new Promise((r) => setTimeout(r, ms));

export function resolver<T extends string>(names: Set<T>, method: (
  resolve: (name: T, value?: unknown) => void,
  reject: (reason?: unknown) => void) => void,
) {
  return new Promise<Record<T, unknown>>((resolve, reject) => {
    const todo = new Set(names);
    const result: Record<T, unknown> = {} as unknown as Record<T, unknown>;
    const resolveWrapper = (name: T, value: unknown) => {
      if (todo.delete(name)) {
        result[name] = value;
        if (todo.size === 0) {
          resolve(result);
        }
      }
    };
    try {
      method(resolveWrapper, reject);
    } catch (e) {
      reject(e);
    }
  });
}

export async function stop<TMessage extends { type: string }>(server: KarmanServer<TMessage>): Promise<void> {
  return new Promise<void>((resolve) => {
    server.on('stop', resolve);
    server.stop();
  });
}

export interface ServerEmit<TMessage> {
  start: jest.Mock<void, [number]>;
  stop: jest.Mock<void, []>;
  join: jest.Mock<void, [string]>;
  connect: jest.Mock<void, [string]>;
  disconnect: jest.Mock<void, [string]>;
  leave: jest.Mock<void, [string]>;
  message: jest.Mock<void, [string, TMessage]>;
}

export interface ClientEmit {
  message: jest.Mock<void, [unknown]>;
  close: jest.Mock<void, []>;
}

export function withServer<TMessage extends { type: string }>(callback: (props: {
  server: KarmanServer<TMessage>,
  serverEmit: ServerEmit<TMessage>,
  addClient: (username: string) => Promise<[client: ws.WebSocket, clientEmit: ClientEmit]>,
}) => Promise<void>): () => Promise<void> {
  return async () => {
    const server = new KarmanServer<TMessage>();
    const serverEmit: ServerEmit<TMessage> = {
      start: jest.fn(),
      stop: jest.fn(),
      join: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      leave: jest.fn(),
      message: jest.fn(),
    };
    server.on('start', (port) => serverEmit.start(port));
    server.on('stop', () => serverEmit.stop());
    server.on('join', (username) => serverEmit.join(username));
    server.on('connect', (username) => serverEmit.connect(username));
    server.on('disconnect', (username) => serverEmit.disconnect(username));
    server.on('leave', (username) => serverEmit.leave(username));
    server.on('message', (username, message) => {
      serverEmit.message(username, message);
    });

    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    const clients: ws.WebSocket[] = [];
    const addClient = async (username: string): Promise<[client: ws.WebSocket, clientEmit: ClientEmit]> => {
      const client = new ws.WebSocket(`ws:127.0.0.1:${port}`);
      const clientEmit: ClientEmit = {
        message: jest.fn(),
        close: jest.fn(),
      };
      client.on('message', (data) => {
        const dataString = data.toString();
        try {
          clientEmit.message(JSON.parse(dataString));
        } catch (e) {
          clientEmit.message(dataString);
        }
      });
      client.on('close', () => {clientEmit.close();});
      clients.push(client);
      await new Promise<void>((resolve, reject) => {
        client.on('message', (rawDate) => {
          try {
            const message: KarmanServerMessage = JSON.parse(rawDate.toString());
            if (message.type === 'user/accepted') {
              resolve();
            } else if (message.type === 'user/rejected') {
              reject(message.payload.reason);
            }
          } catch (err) {
            reject(err);
          }
        });
        client.on('open', () => {
          const userJoinMessage: UserJoinMessage = { type: 'user/join', payload: { username } };
          client.send(JSON.stringify(userJoinMessage));
        });
      });
      return [client, clientEmit];
    };
    try {
      await callback({ server, addClient, serverEmit });
    } finally {
      clients.forEach((client) => client.close());
      await stop(server);
    }
  };
}
