import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserJoinMessage } from '../src/karman-server';

export const sleep = (ms = 75) => new Promise((r) => setTimeout(r, ms));

export interface ServerEmit<TMessage> {
  start: jest.Mock<void, [number]>;
  stop: jest.Mock<void, []>;
  accept: jest.Mock<void, [string, (reason: string) => void]>;
  join: jest.Mock<void, [string]>;
  link: jest.Mock<void, [string]>;
  unlink: jest.Mock<void, [string]>;
  leave: jest.Mock<void, [string, 'voluntary' | 'kicked']>;
  message: jest.Mock<void, [string, TMessage]>;
}

export interface UserEmit {
  message: jest.Mock<void, [unknown]>;
  close: jest.Mock<void, []>;
}

export function withServer<TMessage extends { type: string }, TScenario>(callback: (props: {
  server: KarmanServer<TMessage>,
  serverEmit: ServerEmit<TMessage>,
  addUser: (username?: string) => Promise<[user: ws.WebSocket, userEmit: UserEmit]>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return withCustomServer(new KarmanServer<TMessage>(), callback, scenarios);
}

export function withCustomServer<TMessage extends { type: string }, TScenario>(server: KarmanServer<TMessage>, callback: (props: {
  server: KarmanServer<TMessage>,
  serverEmit: ServerEmit<TMessage>,
  addUser: (username?: string) => Promise<[user: ws.WebSocket, userEmit: UserEmit]>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return async () => {
    const serverEmit: ServerEmit<TMessage> = {
      start: jest.fn(),
      stop: jest.fn(),
      accept: jest.fn(),
      join: jest.fn(),
      link: jest.fn(),
      unlink: jest.fn(),
      leave: jest.fn(),
      message: jest.fn(),
    };
    server.on('start', (port) => serverEmit.start(port));
    server.on('stop', () => serverEmit.stop());
    server.on('accept', (username, reject) => {serverEmit.accept(username, reject);});
    server.on('join', (username) => serverEmit.join(username));
    server.on('link', (username) => serverEmit.link(username));
    server.on('unlink', (username) => serverEmit.unlink(username));
    server.on('leave', (username, reason) => {serverEmit.leave(username, reason);});
    server.on('message', (username, message) => {serverEmit.message(username, message);});

    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    const users: ws.WebSocket[] = [];
    const addUser = async (username?: string): Promise<[user: ws.WebSocket, userEmit: UserEmit]> => {
      const user = new ws.WebSocket(`ws:127.0.0.1:${port}`);
      const userEmit: UserEmit = {
        message: jest.fn(),
        close: jest.fn(),
      };
      user.on('message', (data) => {
        userEmit.message(JSON.parse(data.toString()));
      });
      user.on('close', () => {userEmit.close();});
      users.push(user);
      if (username !== undefined) {
        await new Promise<void>((resolve, reject) => {
          user.on('message', (rawDate) => {
            const message: KarmanServerMessage = JSON.parse(rawDate.toString());
            if (message.type === 'user/accepted') {
              resolve();
            } else if (message.type === 'user/rejected') {
              reject(message.payload.reason);
            }
          });
          user.on('open', () => {
            const userJoinMessage: UserJoinMessage = { type: 'user/join', payload: { username } };
            user.send(JSON.stringify(userJoinMessage));
          });
        });
      } else {
        await sleep();
      }
      return [user, userEmit];
    };
    try {
      await Promise.all((scenarios || [0 as unknown as TScenario]).map(
        (scenario, index) => callback({ server, addUser: addUser, serverEmit, scenario: { index, value: scenario } }),
      ));
    } finally {
      users.forEach((user) => user.close());
      await new Promise<void>((resolve) => {
        server.on('stop', resolve);
        server.stop();
      });
    }
  };
}
