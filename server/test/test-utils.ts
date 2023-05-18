import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserJoinMessage } from '../src/karman-server';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export interface ServerMock<TMessage> {
  start: jest.Mock<void, [number]>;
  stop: jest.Mock<void, []>;
  join: jest.Mock<void, [string]>;
  connect: jest.Mock<void, [string]>;
  disconnect: jest.Mock<void, [string]>;
  leave: jest.Mock<void, [string]>;
  message: jest.Mock<void, [string, TMessage]>;
}

export interface ClientMock {
  message: jest.Mock<void, [unknown]>;
  close: jest.Mock<void, []>;
}

export function withServer<TMessage extends { type: string }>(callback: (props: {
  server: KarmanServer<TMessage>,
  serverMock: ServerMock<TMessage>,
  addClient: (username: string) => Promise<readonly [ws.WebSocket, ClientMock]>,
}) => Promise<void>): () => Promise<void> {
  return async () => {
    const server = new KarmanServer<TMessage>();
    const serverMock: ServerMock<TMessage> = {
      start: jest.fn(),
      stop: jest.fn(),
      join: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      leave: jest.fn(),
      message: jest.fn(),
    };
    server.on('start', (port) => serverMock.start(port));
    server.on('stop', () => serverMock.stop());
    server.on('join', (username) => serverMock.join(username));
    server.on('connect', (username) => serverMock.connect(username));
    server.on('disconnect', (username) => serverMock.disconnect(username));
    server.on('leave', (username) => serverMock.leave(username));
    server.on('message', (username, message) => {
      serverMock.message(username, message);
    });

    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    const clients: ws.WebSocket[] = [];
    const addClient = async (username: string) => {
      const client = new ws.WebSocket(`ws:127.0.0.1:${port}`);
      const clientMock: ClientMock = {
        message: jest.fn(),
        close: jest.fn(),
      };
      client.on('message', (data) => {
        const dataString = data.toString();
        try {
          clientMock.message(JSON.parse(dataString));
        } catch (e) {
          clientMock.message(dataString);
        }
      });
      client.on('close', () => {clientMock.close();});
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
      return [client, clientMock] as const;
    };
    await callback({ server, addClient, serverMock });
    clients.forEach((client) => client.close());
    await stop(server);
  };
}
