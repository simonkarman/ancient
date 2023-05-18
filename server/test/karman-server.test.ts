import ws from 'ws';
import {
  KarmanServer,
  KarmanServerMessage, KarmanServerState, UserAcceptedMessage,
  UserDisconnectedMessage,
  UserJoinMessage,
  UserLeaveMessage,
  UserReconnectedMessage,
} from '../src/karman-server';
import { sleep, stop, withServer } from './test-utils';

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

  it('should reject a user joining with a username that is already taken',
    withServer(async ({ addClient }) => {
      await addClient('simon');
      await addClient('lisa');
      await expect(addClient('simon')).rejects.toStrictEqual('username simon is already taken');
    }),
  );

  it('should immediately close a connection to a client if it sends a message with unknown format',
    withServer(async({ serverEmit, addClient }) => {
      const messages = ['this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
      messages.forEach((message, index) => addClient(`simon-${index}`).then(([client]) => {
        client.send(message);
      }));
      await sleep();
      messages.forEach((_, index) => {
        expect(serverEmit.disconnect).toHaveBeenCalledWith(`simon-${index}`);
      });
    }),
  );

  it('should immediately close a connection to a client if it sends a server only message',
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

  it('should emit the message and sender if it receives a custom message from a client',
    withServer<{ type: 'custom', payload: { key: string } }>(async({ serverEmit, addClient }) => {
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

  // TODO:
  //   - should inform all clients when a client reconnects
  //   - should not emit anything as a connection is closed without ever having joined as a user
  //   - broadcast
  //   - send
  //   - ... more ...
});
