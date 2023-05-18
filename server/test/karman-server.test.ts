import {
  KarmanServer,
  KarmanServerMessage,
  KarmanServerState,
  UserAcceptedMessage,
  UserDisconnectedMessage,
  UserJoinMessage,
  UserLeaveMessage,
  UserReconnectedMessage,
} from '../src/karman-server';
import { sleep, withServer } from './test-utils';

describe('Karman Server', () => {
  it('should cycle through all server statuses when starting and stopping', async () => {
    const server = new KarmanServer();
    expect(server.getStatus()).toStrictEqual<KarmanServerState>('initializing');
    await new Promise<number>((resolve) => {
      server.on('start', resolve);
      server.start();
      expect(server.getStatus()).toStrictEqual<KarmanServerState>('starting');
    });
    expect(server.getStatus()).toStrictEqual<KarmanServerState>('running');
    await new Promise<void>((resolve) => {
      server.on('stop', resolve);
      server.stop();
      expect(server.getStatus()).toStrictEqual<KarmanServerState>('stopping');
    });
    expect(server.getStatus()).toStrictEqual<KarmanServerState>('stopped');
  });

  it('should not be allowed to start a server that is already running',
    withServer(async ({ server }) => {
      expect(() => server.start()).toThrow('Cannot start a running server.');
    }),
  );

  it('should send messages to a custom logger if provided', async () => {
    const log = jest.fn();
    const server = new KarmanServer({ log });
    server.start();
    await sleep();
    server.stop();
    expect(log).toHaveBeenCalledWith('info', expect.any(String));
  });

  it('should not be allowed to stop a server that is not running', async () => {
    const karmanServer = new KarmanServer();
    expect(() => karmanServer.stop()).toThrow('Cannot stop a initializing server.');
    karmanServer.start();
    await sleep();
    karmanServer.stop();
    await sleep();
    expect(() => karmanServer.stop()).toThrow('Cannot stop a stopped server.');
  });

  it('should emit a start event with the port once the server successfully started',
    withServer(async ({ serverEmit }) => {
      expect(serverEmit.start).toHaveBeenCalledWith(expect.any(Number));
    }),
  );

  it('should accept a user joining with a valid join message',
    withServer(async ({ addClient }) => {
      const [, simonEmit] = await addClient('simon');
      expect(simonEmit.message).toHaveBeenCalledWith<[UserAcceptedMessage]>({ type: 'user/accepted' });
    }),
  );

  it('should immediately close a connection when it sends an invalid join message',
    withServer(async ({ addClient, scenario }) => {
      const [client, clientEmit] = await addClient();
      client.send(JSON.stringify(scenario.value));
      await sleep();
      expect(clientEmit.close).toHaveBeenCalled();
    }, [
      { type: 'user/join', payload: { missing: 'incorrect' } },
      { type: 'user/join', payload: 3 },
      { type: 'user/join' },
    ]),
  );

  it('should ignore a join message when already joined',
    withServer(async ({ addClient }) => {
      const [simon, simonEmit] = await addClient('simon');
      const joinMessage = { type: 'user/join', payload: { username: 'simon' } };
      simon.send(JSON.stringify(joinMessage));
      await sleep();
      expect(simonEmit.close).not.toHaveBeenCalled();
    }),
  );

  it('should allow a connection to leave even before it joined',
    withServer(async ({ addClient }) => {
      const [client, clientEmit] = await addClient();
      const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'not-important' } };
      client.send(JSON.stringify(leaveMessage));
      await sleep();
      expect(clientEmit.close).toHaveBeenCalled();
    }),
  );

  it('should ignore any custom message sent before joining',
    withServer(async ({ addClient, serverEmit }) => {
      const [client, clientEmit] = await addClient();
      const customMessage = { type: 'custom/something' };
      client.send(JSON.stringify(customMessage));
      await sleep();
      expect(clientEmit.close).not.toHaveBeenCalled();
      expect(serverEmit.message).not.toHaveBeenCalled();
    }),
  );

  it('should reject a user joining with a username that is already taken',
    withServer(async ({ addClient }) => {
      await addClient('simon');
      await addClient('lisa');
      await expect(addClient('simon')).rejects.toStrictEqual('username simon is already taken');
    }),
  );

  it('should immediately disconnect a client if it sends a message with unknown format',
    withServer(async({ serverEmit, addClient }) => {
      const messages = ['', 'this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
      messages.forEach((message, index) => addClient(`simon-${index}`).then(([client]) => {
        client.send(message);
      }));
      await sleep();
      messages.forEach((_, index) => {
        expect(serverEmit.disconnect).toHaveBeenCalledWith(`simon-${index}`);
      });
    }),
  );

  it('should immediately disconnect a connection if it sends a message with unknown format',
    withServer(async({ serverEmit, addClient }) => {
      const messages = ['', 'this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
      const clientEmits = await Promise.all(messages.map(async (message) => {
        const [client, clientEmit] = await addClient();
        client.send(message);
        return clientEmit;
      }));
      await sleep();
      clientEmits.forEach((client) => {
        expect(client.close).toHaveBeenCalled();
      });
    }),
  );

  it('should immediately disconnect a client if it sends a server only message',
    withServer(async({ serverEmit, addClient }) => {
      const messages: KarmanServerMessage[] = [
        { type: 'user/reconnected', payload: { username: 'any' } },
        { type: 'user/disconnected', payload: { username: 'any' } },
        { type: 'user/accepted' },
        { type: 'user/rejected', payload: { reason: 'any' } },
      ];
      messages.forEach((message, index) => addClient(`simon-${index}`).then(([client]) => {
        client.send(JSON.stringify(message));
      }));
      await sleep();
      messages.forEach((_, index) => {
        expect(serverEmit.disconnect).toHaveBeenCalledWith(`simon-${index}`);
      });
    }),
  );

  it('should immediately disconnect a connection if it sends a server only message',
    withServer(async({ serverEmit, addClient }) => {
      const messages: KarmanServerMessage[] = [
        { type: 'user/reconnected', payload: { username: 'any' } },
        { type: 'user/disconnected', payload: { username: 'any' } },
        { type: 'user/accepted' },
        { type: 'user/rejected', payload: { reason: 'any' } },
      ];
      const clientEmits = await Promise.all(messages.map(async (message) => {
        const [client, clientEmit] = await addClient();
        client.send(JSON.stringify(message));
        return clientEmit;
      }));
      await sleep();
      clientEmits.forEach((client) => {
        expect(client.close).toHaveBeenCalled();
      });
    }),
  );

  it('should allow a user to reconnect after it has disconnected',
    withServer(async({ serverEmit, addClient }) => {
      const [simon] = await addClient('simon');
      await sleep();
      simon.close();
      await sleep();
      await addClient('simon');
    }),
  );

  it('should emit the message and sender if it receives a custom message from a client',
    withServer<{ type: 'custom', payload: { key: string } }, never>(async({ serverEmit, addClient }) => {
      const [simon] = await addClient('simon');
      const customMessage = { type: 'custom', payload: { key: 'value' } };
      simon.send(JSON.stringify(customMessage));
      await sleep();
      expect(serverEmit.message).toHaveBeenCalledWith('simon', customMessage);
    }),
  );

  it('should inform all clients when a client joins',
    withServer(async({ addClient }) => {
      const [, simonEmit] = await addClient('simon');
      await addClient('lisa');
      await sleep();
      expect(simonEmit.message).toHaveBeenCalledWith<[UserJoinMessage]>({
        type: 'user/join',
        payload: { username: 'lisa' },
      });
    }),
  );

  it('should welcome a client that joins with information about all users',
    withServer(async({ server, addClient }) => {
      await addClient('simon');
      const [lisa] = await addClient('lisa');
      await sleep();
      lisa.close();
      await sleep();
      const [, marjoleinEmit] = await addClient('marjolein');
      expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserAcceptedMessage]>({
        type: 'user/accepted',
      });
      expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserReconnectedMessage]>({
        type: 'user/reconnected',
        payload: { username: 'simon' },
      });
      expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserDisconnectedMessage]>({
        type: 'user/disconnected',
        payload: { username: 'lisa' },
      });
      expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserJoinMessage]>({
        type: 'user/join',
        payload: { username: 'marjolein' },
      });
      expect(marjoleinEmit.message).toHaveBeenCalledTimes(4);
      expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
        { username: 'simon', isConnected: true },
        { username: 'lisa', isConnected: false },
        { username: 'marjolein', isConnected: true },
      ]);
    }),
  );

  it(
    'should disconnect a client and inform other clients when a client identifies it wants to leave',
    withServer(async({ server, serverEmit, addClient }) => {
      const [, simonEmit] = await addClient('simon');
      const [lisa, lisaEmit] = await addClient('lisa');
      await sleep();
      const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'lisa' } };
      lisa.send(JSON.stringify(leaveMessage));
      await sleep();
      expect(simonEmit.message).toHaveBeenCalledWith(leaveMessage);
      expect(serverEmit.leave).toHaveBeenCalledWith('lisa');
      expect(lisaEmit.close).toBeCalled();
      expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
        { username: 'simon', isConnected: true },
      ]);
    }),
  );

  it(
    'should not allow a client to send a leave of another client',
    withServer(async({ server, serverEmit, addClient }) => {
      const [simon] = await addClient('simon');
      const [, lisaEmit] = await addClient('lisa');
      await sleep();
      const lisaLeaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'lisa' } };
      simon.send(JSON.stringify(lisaLeaveMessage));
      await sleep();
      expect(lisaEmit.close).not.toHaveBeenCalled();
    }),
  );

  it(
    'should not allow a client to send a leave without payload',
    withServer(async({ server, serverEmit, addClient }) => {
      const [simon] = await addClient('simon');
      const [, lisaEmit] = await addClient('lisa');
      await sleep();
      const leaveMessageWithoutPayload = { type: 'user/leave' };
      simon.send(JSON.stringify(leaveMessageWithoutPayload));
      await sleep();
      expect(lisaEmit.close).not.toHaveBeenCalled();
    }),
  );

  it('should inform all clients when a client disconnects',
    withServer(async({ server, serverEmit, addClient }) => {
      const [, simonEmit] = await addClient('simon');
      const [lisa] = await addClient('lisa');
      await sleep();
      lisa.close();
      await sleep();
      expect(serverEmit.disconnect).toHaveBeenCalledWith('lisa');
      expect(simonEmit.message).toHaveBeenCalledWith<[UserDisconnectedMessage]>({
        type: 'user/disconnected',
        payload: { username: 'lisa' },
      });
      expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
        { username: 'simon', isConnected: true },
        { username: 'lisa', isConnected: false },
      ]);
    }),
  );

  it('should inform all clients when a client reconnects',
    withServer(async({ serverEmit, addClient }) => {
      const [, simonEmit] = await addClient('simon');
      const [lisa] = await addClient('lisa');
      await sleep();
      lisa.close();
      await sleep();
      serverEmit.connect.mockReset();
      await addClient('lisa');
      await sleep();
      expect(serverEmit.connect).toHaveBeenCalledWith('lisa');
      expect(simonEmit.message).toHaveBeenCalledWith<[UserReconnectedMessage]>({
        type: 'user/reconnected',
        payload: { username: 'lisa' },
      });
    }),
  );

  it('should not allow sending a message to a user if the server is not running', async () => {
    const karmanServer = new KarmanServer();
    expect(() => karmanServer.send('simon', { type: 'custom/hello' })).toThrow('Cannot send a message if the server is not running.');
  });

  it('should not allow sending a message to a user if the user does not exist',
    withServer(async ({ server }) => {
      expect(() => server.send('simon', { type: 'custom/hello' }))
        .toThrow('Can not send message to \'simon\' as there is no user with that username.');
    }),
  );

  it('should return false when sending a message to a user that is not connected',
    withServer(async ({ server, addClient }) => {
      const [simon] = await addClient('simon');
      simon.close();
      await sleep();
      expect(server.send('simon', { type: 'custom/hello' })).toBe(false);
    }),
  );

  it('should return true when sending a message to a user that is successful',
    withServer(async ({ server, addClient }) => {
      await addClient('simon');
      expect(server.send('simon', { type: 'custom/hello' })).toBe(true);
    }),
  );

  it('should return the number of users a message was broadcast to',
    withServer(async ({ server, addClient }) => {
      const [, simonEmit] = await addClient('simon');
      const [lisa] = await addClient('lisa');
      const [, marjoleinEmit] = await addClient('marjolein');
      lisa.close();
      await sleep();
      expect(server.broadcast({ type: 'custom/hello' })).toBe(2);
      await sleep();
      expect(simonEmit.message).toHaveBeenCalledWith({ type: 'custom/hello' });
      expect(marjoleinEmit.message).toHaveBeenCalledWith({ type: 'custom/hello' });
    }),
  );

  (['send', 'broadcast'] as const).forEach(methodName => {
    it(`should allow ${methodName}ing a message to the newly connected user in the on join and on connect hook`,
      withServer(async ({ server, addClient }) => {
        server.on('join', (username: string) => {
          if (methodName === 'send') {
            server.send(username, { type: 'custom/welcome-on-join' });
          } else {
            server.broadcast({ type: 'custom/welcome-on-join' });
          }
        });
        server.on('connect', (username: string) => {
          if (methodName === 'send') {
            server.send(username, { type: 'custom/welcome-on-connect' });
          } else {
            server.broadcast({ type: 'custom/welcome-on-connect' });
          }
        });
        const [, simonEmit] = await addClient('simon');
        await sleep();
        const numberOfMessages = simonEmit.message.mock.calls.length;
        expect(simonEmit.message).toHaveBeenNthCalledWith(numberOfMessages - 2, { type: 'custom/welcome-on-join' });
        expect(simonEmit.message).toHaveBeenNthCalledWith(numberOfMessages - 1, { type: 'custom/welcome-on-connect' });
      }),
    );
  });

  it('should skip broadcasting a message to a user if skipUsername is provided',
    withServer(async ({ server, addClient }) => {
      const [, simonEmit] = await addClient('simon');
      const [, lisaEmit] = await addClient('lisa');
      await sleep();
      expect(server.broadcast({ type: 'custom/hello' }, 'simon')).toBe(1);
      await sleep();
      expect(simonEmit.message).not.toHaveBeenCalledWith({ type: 'custom/hello' });
      expect(lisaEmit.message).toHaveBeenCalledWith({ type: 'custom/hello' });
    }),
  );
});
