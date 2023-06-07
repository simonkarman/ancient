import ws from 'ws';
import { Server, createServer } from '../../src/karmax';

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

export function withServer<TScenario>(callback: (props: {
  server: Server,
  serverEmit: ServerEmit,
  addUser: (username?: string) => Promise<[user: ws.WebSocket, userEmit: UserEmit]>,
  scenario: { index: number, value: TScenario },
}) => Promise<void>, scenarios?: TScenario[]): () => Promise<void> {
  return withCustomServer(createServer(), callback, scenarios);
}

export function withCustomServer<TScenario>(server: Server, callback: (props: {
  server: Server,
  serverEmit: ServerEmit,
  addUser: (username?: string) => Promise<[user: ws.WebSocket, userEmit: UserEmit]>,
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
      return [user, userEmit];
    };
    try {
      await Promise.all((scenarios || [0 as unknown as TScenario]).map(
        (scenario, index) => callback({ server, addUser: addUser, serverEmit, scenario: { index, value: scenario } }),
      ));
    } finally {
      await new Promise<void>((resolve) => {
        server.on('close', resolve);
        server.close();
      });
    }
  };
}
