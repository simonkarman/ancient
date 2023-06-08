import ws from 'ws';
import { Server, createServer, Message } from '../../src/karmax';

export const sleep = (ms = 75) => new Promise((r) => setTimeout(r, ms));

export interface ServerEmit {
  listen: jest.Mock<void, [number]>;
  close: jest.Mock<void, []>;
  authenticate: jest.Mock<void, [string, boolean, (reason: string) => void]>;
  join: jest.Mock<void, [string]>;
  link: jest.Mock<void, [string]>;
  unlink: jest.Mock<void, [string]>;
  leave: jest.Mock<void, [string, string]>;
  message: jest.Mock<void, [string, { type: string }]>;
}

export interface UserEmit {
  message: jest.Mock<void, [unknown]>;
  close: jest.Mock<void, []>;
}

export interface User {
  emit: UserEmit;
  send: <TMessage extends Message>(message: TMessage) => void;
  sendRaw: (rawMessage: string) => void;
  close: () => void;
}

export function withServer<TScenario>(callback: (props: {
  server: Server,
  serverEmit: ServerEmit,
  addUser: (username?: string) => Promise<User>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return withCustomServer(createServer(), callback, scenarios);
}

export function withCustomServer<TScenario>(server: Server, callback: (props: {
  server: Server,
  serverEmit: ServerEmit,
  addUser: (username?: string) => Promise<User>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return async () => {
    const serverEmit: ServerEmit = {
      listen: jest.fn(),
      close: jest.fn(),
      authenticate: jest.fn(),
      join: jest.fn(),
      link: jest.fn(),
      unlink: jest.fn(),
      leave: jest.fn(),
      message: jest.fn(),
    };
    server.on('listen', (port) => serverEmit.listen(port));
    server.on('close', () => serverEmit.close());
    server.on('authenticate', (username, isNewUser, reject) => {serverEmit.authenticate(username, isNewUser, reject);});
    server.on('join', (username) => serverEmit.join(username));
    server.on('link', (username) => serverEmit.link(username));
    server.on('unlink', (username) => serverEmit.unlink(username));
    server.on('leave', (username, reason) => {serverEmit.leave(username, reason);});
    server.on('message', (username, message) => {serverEmit.message(username, message);});

    const port = await new Promise<number>((resolve) => {
      server.on('listen', resolve);
      server.listen();
    });
    const users: ws.WebSocket[] = [];
    const addUser = async (username?: string): Promise<User> => {
      const user = new ws.WebSocket(`ws:127.0.0.1:${port}`);
      users.push(user);
      const userEmit: UserEmit = {
        message: jest.fn(),
        close: jest.fn(),
      };
      user.on('message', (data) => {
        userEmit.message(JSON.parse(data.toString()));
      });
      user.on('close', () => {userEmit.close();});
      if (username !== undefined) {
        await new Promise<void>((resolve, reject) => {
          user.on('message', (rawDate) => {
            const message = JSON.parse(rawDate.toString());
            if (message.type === 'user/accepted') {
              resolve();
            } else if (message.type === 'user/rejected') {
              reject(message.payload.reason);
            }
          });
          user.on('open', () => {
            const userAuthenticateMessage = { type: 'user/authenticate', payload: { username } };
            user.send(JSON.stringify(userAuthenticateMessage));
          });
        });
      } else {
        await sleep();
      }
      return {
        emit: userEmit,
        send: (message: { type: string }) => user.send(JSON.stringify(message)),
        sendRaw: (message: string) => user.send(message),
        close: () => user.close(),
      };
    };
    try {
      await Promise.all((scenarios || [0 as unknown as TScenario]).map(
        (scenario, index) => callback({ server, addUser, serverEmit, scenario: { index, value: scenario } }),
      ));
    } finally {
      users.forEach(user => user.close());
      await new Promise<void>((resolve) => {
        server.on('close', resolve);
        server.close();
      });
    }
  };
}
