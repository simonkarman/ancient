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

export async function stop(server: KarmanServer<KarmanServerMessage>): Promise<void> {
  return new Promise<void>((resolve) => {
    server.on('stop', resolve);
    server.stop();
  });
}

export async function withRunningServer(callback: (
  server: KarmanServer<KarmanServerMessage>,
  withConnectedClient: (username: string) => Promise<ws.WebSocket>,
) => Promise<void>): Promise<void> {
  const server = new KarmanServer();
  const port = await new Promise<number>((resolve) => {
    server.on('start', resolve);
    server.start();
  });
  const clients: ws.WebSocket[] = [];
  const withConnectedClient = async (username: string) => {
    const client = new ws.WebSocket(`ws:127.0.0.1:${port}`);
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
    return client;
  };
  await callback(server, withConnectedClient);
  clients.forEach((client) => client.close());
  await stop(server);
}
