import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserJoinMessage } from '../src/karman-server';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function stop(server: KarmanServer<KarmanServerMessage>): Promise<void> {
  return new Promise<void>((resolve) => {
    server.on('stop', resolve);
    server.stop();
  });
}

async function withRunningServer(callback: (
  server: KarmanServer<KarmanServerMessage>,
  withConnectedClient: (username: string) => Promise<ws.WebSocket>
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

describe('Karman Server', () => {
  test('should emit a start event with the port once the server successfully started', async () => {
    const server = new KarmanServer();
    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    expect(port).toBeGreaterThan(0);
    await stop(server);
  });
  test('should cycle through all server statuses when starting and stopping', async () => {
    const server = new KarmanServer();
    expect(server.getStatus()).toStrictEqual('initializing');
    await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
      expect(server.getStatus()).toStrictEqual('starting');
    });
    expect(server.getStatus()).toStrictEqual('running');
    await new Promise<void>((resolve) => {
      server.on('stop', resolve);
      server.stop();
      expect(server.getStatus()).toStrictEqual('stopping');
    });
    expect(server.getStatus()).toStrictEqual('stopped');
  });
  test('should accept a user joining with a valid join message', async () => {
    const server = new KarmanServer();
    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    const client = new ws.WebSocket(`ws:127.0.0.1:${port}`);
    const message = await new Promise<KarmanServerMessage>((resolve, reject) => {
      client.on('message', (rawDate) => {
        try {
          resolve(JSON.parse(rawDate.toString()));
        } catch (err) {
          reject(err);
        }
      });
      client.on('open', () => {
        const userJoinMessage: UserJoinMessage = { type: 'user/join', payload: { username: 'simon' } };
        client.send(JSON.stringify(userJoinMessage));
      });
    });
    client.close();
    expect(message?.type).toStrictEqual('user/accepted');
    await stop(server);
  });
  test('should reject a user joining with a username that is already taken', async () => {
    await withRunningServer(async (server, addClient) => {
      await addClient('simon');
      await addClient('lisa');
      await expect(addClient('simon')).rejects.toStrictEqual('username simon is already taken');
    });
  }, 100000);
});
