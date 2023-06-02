import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserJoinMessage } from '../src/karman-server';

export const sleep = (ms = 75) => new Promise((r) => setTimeout(r, ms));

export interface ServerEmit<TMessage> {
  start: jest.Mock<void, [number]>;
  stop: jest.Mock<void, []>;
  accept: jest.Mock<void, [string, (reason: string) => void]>;
  join: jest.Mock<void, [string]>;
  connect: jest.Mock<void, [string]>;
  disconnect: jest.Mock<void, [string]>;
  leave: jest.Mock<void, [string, 'voluntary' | 'kicked']>;
  message: jest.Mock<void, [string, TMessage]>;
}

export interface ClientEmit {
  message: jest.Mock<void, [unknown]>;
  close: jest.Mock<void, []>;
}

export function withServer<TMessage extends { type: string }, TScenario>(callback: (props: {
  server: KarmanServer<TMessage>,
  serverEmit: ServerEmit<TMessage>,
  addClient: (username?: string) => Promise<[client: ws.WebSocket, clientEmit: ClientEmit]>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return withCustomServer(new KarmanServer<TMessage>(), callback, scenarios);
}

export function withCustomServer<TMessage extends { type: string }, TScenario>(server: KarmanServer<TMessage>, callback: (props: {
  server: KarmanServer<TMessage>,
  serverEmit: ServerEmit<TMessage>,
  addClient: (username?: string) => Promise<[client: ws.WebSocket, clientEmit: ClientEmit]>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return async () => {
    const serverEmit: ServerEmit<TMessage> = {
      start: jest.fn(),
      stop: jest.fn(),
      accept: jest.fn(),
      join: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      leave: jest.fn(),
      message: jest.fn(),
    };
    server.on('start', (port) => serverEmit.start(port));
    server.on('stop', () => serverEmit.stop());
    server.on('accept', (username, reject) => {serverEmit.accept(username, reject);});
    server.on('join', (username) => serverEmit.join(username));
    server.on('connect', (username) => serverEmit.connect(username));
    server.on('disconnect', (username) => serverEmit.disconnect(username));
    server.on('leave', (username, reason) => {serverEmit.leave(username, reason);});
    server.on('message', (username, message) => {serverEmit.message(username, message);});

    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    const clients: ws.WebSocket[] = [];
    const addClient = async (username?: string): Promise<[client: ws.WebSocket, clientEmit: ClientEmit]> => {
      const client = new ws.WebSocket(`ws:127.0.0.1:${port}`);
      const clientEmit: ClientEmit = {
        message: jest.fn(),
        close: jest.fn(),
      };
      client.on('message', (data) => {
        clientEmit.message(JSON.parse(data.toString()));
      });
      client.on('close', () => {clientEmit.close();});
      clients.push(client);
      if (username !== undefined) {
        await new Promise<void>((resolve, reject) => {
          client.on('message', (rawDate) => {
            const message: KarmanServerMessage = JSON.parse(rawDate.toString());
            if (message.type === 'user/accepted') {
              resolve();
            } else if (message.type === 'user/rejected') {
              reject(message.payload.reason);
            }
          });
          client.on('open', () => {
            const userJoinMessage: UserJoinMessage = { type: 'user/join', payload: { username } };
            client.send(JSON.stringify(userJoinMessage));
          });
        });
      } else {
        await sleep();
      }
      return [client, clientEmit];
    };
    try {
      await Promise.all((scenarios || [0 as unknown as TScenario]).map(
        (scenario, index) => callback({ server, addClient, serverEmit, scenario: { index, value: scenario } }),
      ));
    } finally {
      clients.forEach((client) => client.close());
      await new Promise<void>((resolve) => {
        server.on('stop', resolve);
        server.stop();
      });
    }
  };
}
