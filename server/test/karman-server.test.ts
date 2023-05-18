import ws from 'ws';
import { KarmanServer, KarmanServerMessage, UserDisconnectedMessage, UserJoinMessage, UserLeaveMessage } from '../src/karman-server';
import { resolver, sleep, stop, withServer } from './test-utils';

describe('Karman Server', () => {
  it('should emit a start event with the port once the server successfully started', async () => {
    const server = new KarmanServer();
    const port = await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
    });
    expect(port).toBeGreaterThan(0);
    await stop(server);
  });
  it('should cycle through all server statuses when starting and stopping', async () => {
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
  it('should accept a user joining with a valid join message', async () => {
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
  it('should reject a user joining with a username that is already taken', withServer(async ({ addClient }) => {
    await addClient('simon');
    await addClient('lisa');
    await expect(addClient('simon')).rejects.toStrictEqual('username simon is already taken');
  }));
  it('should immediately close a connection to a client if it sends a message with an unknown format', withServer(async({ server, addClient }) => {
    const messages = ['this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
    await Promise.all(messages.map((message, index) => new Promise<void>((resolve) => {
      addClient(`simon-${index}`).then(([client]) => {
        server.on('disconnect', (username: string) => {
          if (username === `simon-${index}`) {
            resolve();
          }
        });
        client.send(message);
      });
    })));
  }));
  it('should immediately close a connection to a client if it sends a server only message', withServer(async({ server, addClient }) => {
    const messages: KarmanServerMessage[] = [
      { type: 'user/reconnected', payload: { username: 'any' } },
      { type: 'user/disconnected', payload: { username: 'any' } },
      { type: 'user/accepted' },
      { type: 'user/rejected', payload: { reason: 'any' } },
    ];
    await Promise.all(messages.map((message, index) => new Promise<void>((resolve) => {
      addClient(`simon-${index}`).then(([client]) => {
        server.on('disconnect', (username: string) => {
          if (username === `simon-${index}`) {
            resolve();
          }
        });
        client.send(JSON.stringify(message));
      });
    })));
  }));
  it('should emit the message and sender if it receives a custom message', withServer(async({ server, addClient }) => {
    const [simon] = await addClient('simon');
    const customMessage = { type: 'custom', payload: { key: 'value' } };
    const [resultUsername, resultMessage] = await new Promise<[string, unknown]>((resolve) => {
      server.on('message', (username, message) => {
        resolve([username, message]);
      });
      simon.send(JSON.stringify(customMessage));
    });
    expect(resultUsername).toStrictEqual('simon');
    expect(resultMessage).toStrictEqual(customMessage);
  }));
  it('should inform all clients when a client joins', withServer(async({ server, addClient }) => {
    const [simon] = await addClient('simon');
    const result = await new Promise<unknown>((resolve) => {
      simon.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
      addClient('lisa');
    });
    expect(result).toStrictEqual<UserJoinMessage>({
      type: 'user/join',
      payload: { username: 'lisa' },
    });
  }));
  it('should disconnect a client and inform other clients when a client identifies it wants to leave', withServer(async({ server, addClient }) => {
    const [simon] = await addClient('simon');
    const [lisa] = await addClient('lisa');
    await sleep(10);
    const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'lisa' } };
    const result = await resolver(new Set(['otherUserMessage', 'serverLeaveUsername', 'clientDisconnected']), (resolve) => {
      // Other users should receive a leave event (and not a disconnect event)
      simon.on('message', (data) => {
        resolve('otherUserMessage', JSON.parse(data.toString()));
      });
      // Server should emit a leave event
      server.on('leave', (username) => {
        resolve('serverLeaveUsername', username);
      });
      // Client should be disconnected
      lisa.on('close', () => {
        resolve('clientDisconnected');
      });
      // The client leaves
      lisa.send(JSON.stringify(leaveMessage));
    });
    expect(result.serverLeaveUsername).toStrictEqual('lisa');
    expect(result.otherUserMessage).toStrictEqual<UserLeaveMessage>(leaveMessage);
  }));
  it('should inform all clients when a client disconnects', withServer(async({ server, serverMock, addClient }) => {
    const [simon] = await addClient('simon');
    const [lisa] = await addClient('lisa');
    await sleep(10);

    const result = await resolver(new Set(['otherReceivedMessage', 'serverDisconnectUsername']), (resolve) => {
      // Other connected users should receive a disconnect event
      simon.on('message', (data) => {
        resolve('otherReceivedMessage', JSON.parse(data.toString()));
      });
      // Server should emit a disconnect event
      server.on('disconnect', (username) => {
        resolve('serverDisconnectUsername', username);
      });
      // The client disconnects
      lisa.close();
    });
    expect(result.serverDisconnectUsername).toStrictEqual('lisa');
    expect(result.otherReceivedMessage).toStrictEqual<UserDisconnectedMessage>({
      type: 'user/disconnected',
      payload: { username: 'lisa' },
    });
  }));
  // TODO:
  //   - should inform all clients when a client reconnects
  //   - should not emit anything as a connection is closed without ever having joined as a user
  //   - broadcast
  //   - send
  //   - ... more ...
});
