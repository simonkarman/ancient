import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserJoinMessage } from '../src/karman-server';
import { stop, withRunningServer } from './test-utils';

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
  });
  test('should immediately close a connection to a client if it sends a message with an unknown format', async () => {
    await withRunningServer(async(server, addClient) => {
      const messages = ['this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
      await Promise.all(messages.map((message, index) => new Promise<void>((resolve) => {
        addClient(`simon-${index}`).then(client => {
          server.on('disconnect', (username: string) => {
            if (username === `simon-${index}`) {
              resolve();
            }
          });
          client.send(message);
        });
      })));
    });
  });
  test('should immediately close a connection to a client if it sends a server only message', async () => {
    await withRunningServer(async(server, addClient) => {
      const messages: KarmanServerMessage[] = [
        { type: 'user/reconnected', payload: { username: 'any' } },
        { type: 'user/disconnected', payload: { username: 'any' } },
        { type: 'user/accepted' },
        { type: 'user/rejected', payload: { reason: 'any' } },
      ];
      await Promise.all(messages.map((message, index) => new Promise<void>((resolve) => {
        addClient(`simon-${index}`).then(client => {
          server.on('disconnect', (username: string) => {
            if (username === `simon-${index}`) {
              resolve();
            }
          });
          client.send(JSON.stringify(message));
        });
      })));
    });
  });
  test('should emmit a message and the sender if it receives a custom message', async () => {
    await withRunningServer(async(server, addClient) => {
      const simon = await addClient('simon');
      const customMessage = { type: 'custom', payload: { key: 'value' } };
      await new Promise<void>((resolve) => {
        server.on('message', (username, message) => {
          expect(username).toStrictEqual('simon');
          expect(message).toStrictEqual(customMessage);
          resolve();
        });
        simon.send(JSON.stringify(customMessage));
      });
    });
  });
});
