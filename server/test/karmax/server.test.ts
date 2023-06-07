import { createServer, Status } from '../../src/karmax';
import { sleep, withServer, withCustomServer } from './server.test-utils';

describe('Karmax Server', () => {
  it('should cycle through all server statuses when starting and closing', async () => {
    const server = createServer();
    expect(server.getStatus()).toStrictEqual<Status>('initializing');
    await new Promise<number>((resolve) => {
      server.on('listen', resolve);
      server.listen();
      expect(server.getStatus()).toStrictEqual<Status>('starting');
    });
    expect(server.getStatus()).toStrictEqual<Status>('listening');
    await new Promise<void>((resolve) => {
      server.on('close', resolve);
      server.close();
      expect(server.getStatus()).toStrictEqual<Status>('closing');
    });
    expect(server.getStatus()).toStrictEqual<Status>('closed');
  });

  it('should not be allowed to start listening on a server that is already listening',
    withServer(async ({ server }) => {
      expect(() => server.listen()).toThrow('cannot start listening when the server is listening');
    }),
  );

  it('should send messages to a custom logger if provided', async () => {
    const logger = jest.fn();
    const server = createServer({ logger });
    server.listen();
    await sleep();
    server.close();
    expect(logger).toHaveBeenCalledWith('info', expect.any(String));
  });

  it('should add metadata to messages when server has metadata enabled',
    withCustomServer(createServer({ metadata: true }), async({ server, addUser }) => {
      const [, simonEmit] = await addUser('simon');
      await sleep();
      for (let callIndex = 0; callIndex < simonEmit.message.mock.calls.length; callIndex++) {
        const call = simonEmit.message.mock.calls[callIndex];
        expect(call[0]).toHaveProperty('metadata', { timestamp: expect.any(String), isBroadcast: expect.any(Boolean) });
      }

      // broadcast
      simonEmit.message.mockClear();
      server.broadcast({ type: 'custom/message' });
      await sleep();
      expect(simonEmit.message).toHaveBeenCalledWith({ type: 'custom/message', metadata: { timestamp: expect.any(String), isBroadcast: true } });
      expect(simonEmit.message).toHaveBeenCalledTimes(1);

      // send
      simonEmit.message.mockClear();
      server.send('simon', { type: 'custom/message' });
      await sleep();
      expect(simonEmit.message).toHaveBeenCalledWith({ type: 'custom/message', metadata: { timestamp: expect.any(String), isBroadcast: false } });
      expect(simonEmit.message).toHaveBeenCalledTimes(1);
    }),
  );
//
//   it('should not be allowed to stop a server that is not running', async () => {
//     const karmanServer = new KarmanServer();
//     expect(() => karmanServer.stop()).toThrow('Cannot stop a initializing server.');
//     karmanServer.start();
//     await sleep();
//     karmanServer.stop();
//     await sleep();
//     expect(() => karmanServer.stop()).toThrow('Cannot stop a stopped server.');
//   });
//
//   it('should emit a start event with the port once the server successfully started',
//     withServer(async ({ serverEmit }) => {
//       expect(serverEmit.start).toHaveBeenCalledWith(expect.any(Number));
//     }),
//   );
//
//   it('should accept a user joining with a valid join message',
//     withServer(async ({ serverEmit, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       await sleep();
//       expect(simonEmit.message).toHaveBeenCalledWith<[UserAcceptedMessage]>({ type: 'user/accepted' });
//       expect(serverEmit.accept).toHaveBeenCalledWith('simon', expect.any(Function));
//       expect(serverEmit.join).toHaveBeenCalledWith('simon');
//     }),
//   );
//
//   it('should immediately close a connection when it sends an invalid join message',
//     withServer(async ({ addUser, scenario }) => {
//       const [user, userEmit] = await addUser();
//       user.send(JSON.stringify(scenario.value));
//       await sleep();
//       expect(userEmit.close).toHaveBeenCalled();
//     }, [
//       { type: 'user/join', payload: { missing: 'incorrect' } },
//       { type: 'user/join', payload: 3 },
//       { type: 'user/join' },
//     ]),
//   );
//
//   it('should immediately close a connection when it sends a join message when already joined',
//     withServer(async ({ addUser }) => {
//       const [simon, simonEmit] = await addUser('simon');
//       const joinMessage = { type: 'user/join', payload: { username: 'simon' } };
//       simon.send(JSON.stringify(joinMessage));
//       await sleep();
//       expect(simonEmit.close).toHaveBeenCalled();
//     }),
//   );
//
//   it('should allow a connection to leave even before it joined',
//     withServer(async ({ addUser }) => {
//       const [user, userEmit] = await addUser();
//       const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'not-important', reason: 'voluntary' } }; // TODO: payload here is weird
//       user.send(JSON.stringify(leaveMessage));
//       await sleep();
//       expect(userEmit.close).toHaveBeenCalled();
//     }),
//   );
//
//   it('should immediately close a connection when any custom message is sent before joining',
//     withServer(async ({ addUser, serverEmit }) => {
//       const [user, userEmit] = await addUser();
//       const customMessage = { type: 'custom/something' };
//       user.send(JSON.stringify(customMessage));
//       await sleep();
//       expect(userEmit.close).toHaveBeenCalled();
//       expect(serverEmit.message).not.toHaveBeenCalled();
//     }),
//   );
//
//   it('should reject a user joining with a username that is already taken',
//     withServer(async ({ addUser }) => {
//       await addUser('simon');
//       await addUser('lisa');
//       await expect(addUser('simon')).rejects.toStrictEqual('username simon is already taken');
//     }),
//   );
//
//   it('should immediately disconnect a user if it sends a message with unknown format',
//     withServer(async({ serverEmit, addUser }) => {
//       const messages = ['', 'this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
//       messages.forEach((message, index) => addUser(`simon-${index}`).then(([user]) => {
//         user.send(message);
//       }));
//       await sleep();
//       messages.forEach((_, index) => {
//         expect(serverEmit.unlink).toHaveBeenCalledWith(`simon-${index}`);
//       });
//     }),
//   );
//
//   it('should immediately disconnect a connection if it sends a message with unknown format',
//     withServer(async({ serverEmit, addUser }) => {
//       const messages = ['', 'this-is-not-a-json-message', '{}', '{"type":3}', '{"type":{"key":"value"}}'];
//       const userEmits = await Promise.all(messages.map(async (message) => {
//         const [user, userEmit] = await addUser();
//         user.send(message);
//         return userEmit;
//       }));
//       await sleep();
//       userEmits.forEach((user) => {
//         expect(user.close).toHaveBeenCalled();
//       });
//     }),
//   );
//
//   // TODO: unlink instead of close connection should be implemented
//   it('should immediately unlink a user if it sends a server only message',
//     withServer(async({ serverEmit, addUser }) => {
//       const messages: KarmanServerMessage[] = [
//         { type: 'user/linked', payload: { username: 'any' } },
//         { type: 'user/unlinked', payload: { username: 'any' } },
//         { type: 'user/accepted' },
//         { type: 'user/rejected', payload: { reason: 'any' } },
//       ];
//       messages.forEach((message, index) => addUser(`simon-${index}`).then(([user]) => {
//         user.send(JSON.stringify(message));
//       }));
//       await sleep();
//       messages.forEach((_, index) => {
//         expect(serverEmit.unlink).toHaveBeenCalledWith(`simon-${index}`);
//       });
//     }),
//   );
//
//   // TODO: unlink instead of close connection should be implemented
//   it('should immediately unlink a connection if it sends a server only message',
//     withServer(async({ addUser }) => {
//       const messages: KarmanServerMessage[] = [
//         { type: 'user/linked', payload: { username: 'any' } },
//         { type: 'user/unlinked', payload: { username: 'any' } },
//         { type: 'user/accepted' },
//         { type: 'user/rejected', payload: { reason: 'any' } },
//       ];
//       const userEmits = await Promise.all(messages.map(async (message) => {
//         const [user, userEmit] = await addUser();
//         user.send(JSON.stringify(message));
//         return userEmit;
//       }));
//       await sleep();
//       userEmits.forEach((user) => {
//         expect(user.close).toHaveBeenCalled();
//       });
//     }),
//   );
//
//   it('should allow a user to link to a new connection after the connection was lost',
//     withServer(async({ addUser }) => {
//       const [simon] = await addUser('simon');
//       await sleep();
//       simon.close();
//       await sleep();
//       await addUser('simon');
//     }),
//   );
//
//   it('should emit the message and sender if it receives a custom message from a user',
//     withServer<{ type: 'custom', payload: { key: string } }, never>(async({ serverEmit, addUser }) => {
//       const [simon] = await addUser('simon');
//       const customMessage = { type: 'custom', payload: { key: 'value' } };
//       simon.send(JSON.stringify(customMessage));
//       await sleep();
//       expect(serverEmit.message).toHaveBeenCalledWith('simon', customMessage);
//     }),
//   );
//
//   it('should inform all users when a user joins',
//     withServer(async({ addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       await addUser('lisa');
//       await sleep();
//       // TODO: also expect an link event
//       expect(simonEmit.message).toHaveBeenCalledWith<[UserJoinMessage]>({
//         type: 'user/join',
//         payload: { username: 'lisa' },
//       });
//     }),
//   );
//
//   it('should welcome a user that joins by sending the new user information about all users',
//     withServer(async({ server, addUser }) => {
//       await addUser('simon');
//       const [lisa] = await addUser('lisa');
//       await sleep();
//       lisa.close();
//       await sleep();
//       const [, marjoleinEmit] = await addUser('marjolein');
//       await sleep();
//       expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserAcceptedMessage]>({
//         type: 'user/accepted',
//       });
//       expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserLinkedMessage]>({
//         type: 'user/linked',
//         payload: { username: 'simon' },
//       });
//       expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserUnlinkedMessage]>({
//         type: 'user/unlinked',
//         payload: { username: 'lisa' },
//       });
//       expect(marjoleinEmit.message).toHaveBeenCalledWith<[UserJoinMessage]>({
//         type: 'user/join',
//         payload: { username: 'marjolein' },
//       });
//       expect(marjoleinEmit.message).toHaveBeenCalledTimes(4);
//       expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
//         { username: 'simon', isConnected: true },
//         { username: 'lisa', isConnected: false },
//         { username: 'marjolein', isConnected: true },
//       ]);
//     }),
//   );
//
//   it(
//     'should let a user leave the server and inform other user that the user left',
//     withServer(async({ server, serverEmit, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       const [lisa, lisaEmit] = await addUser('lisa');
//       await sleep();
//       const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'lisa', reason: 'voluntary' } }; // TODO: should not have to sent reason
//       lisa.send(JSON.stringify(leaveMessage));
//       await sleep();
//       // TODO: expect an unlink event too (this has to be added)
//       expect(simonEmit.message).toHaveBeenCalledWith(leaveMessage);
//       expect(serverEmit.leave).toHaveBeenCalledWith('lisa', 'voluntary');
//       expect(lisaEmit.close).toBeCalled();
//       expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
//         { username: 'simon', isConnected: true },
//       ]);
//     }),
//   );
//
//   it(
//     'should not allow a user to send a leave of another user',
//     withServer(async({ server, serverEmit, addUser }) => {
//       const [simon] = await addUser('simon');
//       const [, lisaEmit] = await addUser('lisa');
//       await sleep();
//       const lisaLeaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'lisa', reason: 'voluntary' } }; // TODO: should not have to sent reason
//       simon.send(JSON.stringify(lisaLeaveMessage));
//       await sleep();
//       expect(lisaEmit.close).not.toHaveBeenCalled();
//     }),
//   );
//
//   it(
//     'should not allow a user to send a leave without payload',
//     withServer(async({ addUser }) => {
//       const [simon, simonEmit] = await addUser('simon');
//       await sleep();
//       const leaveMessageWithoutPayload = { type: 'user/leave' };
//       simon.send(JSON.stringify(leaveMessageWithoutPayload));
//       await sleep();
//       expect(simonEmit.close).not.toHaveBeenCalled();
//     }),
//   );
//
//   it('should inform all users when a user is unlinked from a connection',
//     withServer(async({ server, serverEmit, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       const [lisa] = await addUser('lisa');
//       await sleep();
//       lisa.close();
//       await sleep();
//       expect(serverEmit.unlink).toHaveBeenCalledWith('lisa');
//       expect(simonEmit.message).toHaveBeenCalledWith<[UserUnlinkedMessage]>({
//         type: 'user/unlinked',
//         payload: { username: 'lisa' },
//       });
//       expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
//         { username: 'simon', isConnected: true },
//         { username: 'lisa', isConnected: false },
//       ]);
//     }),
//   );
//
//   it('should inform all users when a user is linked to a connection',
//     withServer(async({ serverEmit, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       const [lisa] = await addUser('lisa');
//       await sleep();
//       lisa.close();
//       await sleep();
//       serverEmit.link.mockReset();
//       await addUser('lisa');
//       await sleep();
//       expect(serverEmit.link).toHaveBeenCalledWith('lisa');
//       expect(simonEmit.message).toHaveBeenCalledWith<[UserLinkedMessage]>({
//         type: 'user/linked',
//         payload: { username: 'lisa' },
//       });
//     }),
//   );
//
//   it('should not allow send, broadcast, or leave if the server is not running', async () => {
//     const karmanServer = new KarmanServer();
//     expect(() => karmanServer.send('simon', { type: 'custom/hello' })).toThrow('Cannot send a message if the server is not running.');
//     expect(() => karmanServer.broadcast({ type: 'custom/hello' })).toThrow('Cannot broadcast a message if the server is not running.');
//     expect(() => karmanServer.kick('simon')).toThrow('Cannot leave a user if the server is not running.');
//   });
//
//   it('should not allow sending a message to a user, if that user does not exist',
//     withServer(async ({ server }) => {
//       expect(() => server.send('simon', { type: 'custom/hello' }))
//         .toThrow('Can not send message to \'simon\' as there is no user with that username.');
//     }),
//   );
//
//   it('should return false when sending a message to a user that is not linked to a connection',
//     withServer(async ({ server, addUser }) => {
//       const [simon] = await addUser('simon');
//       simon.close();
//       await sleep();
//       expect(server.send('simon', { type: 'custom/hello' })).toBe(false);
//     }),
//   );
//
//   it('should return true when sending a message to a user is successful',
//     withServer(async ({ server, addUser }) => {
//       await addUser('simon');
//       expect(server.send('simon', { type: 'custom/hello' })).toBe(true);
//     }),
//   );
//
//   it('should, when broadcasting, return the number of users a message was broadcast to',
//     withServer(async ({ server, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       const [lisa] = await addUser('lisa');
//       const [, marjoleinEmit] = await addUser('marjolein');
//       lisa.close();
//       await sleep();
//       expect(server.broadcast({ type: 'custom/hello' })).toBe(2);
//       await sleep();
//       expect(simonEmit.message).toHaveBeenCalledWith({ type: 'custom/hello' });
//       expect(marjoleinEmit.message).toHaveBeenCalledWith({ type: 'custom/hello' });
//     }),
//   );
//
//   (['send', 'broadcast'] as const).forEach(methodName => {
//     it(`should allow ${methodName}ing a message to the newly joined user in the on join and on connect hook`,
//       withServer(async ({ server, addUser }) => {
//         server.on('join', (username: string) => {
//           if (methodName === 'send') {
//             server.send(username, { type: 'custom/welcome-on-join' });
//           } else {
//             server.broadcast({ type: 'custom/welcome-on-join' });
//           }
//         });
//         server.on('link', (username: string) => {
//           if (methodName === 'send') {
//             server.send(username, { type: 'custom/welcome-on-link' });
//           } else {
//             server.broadcast({ type: 'custom/welcome-on-link' });
//           }
//         });
//         const [, simonEmit] = await addUser('simon');
//         await sleep();
//         const numberOfMessages = simonEmit.message.mock.calls.length;
//         expect(simonEmit.message).toHaveBeenNthCalledWith(numberOfMessages - 1, { type: 'custom/welcome-on-join' });
//         expect(simonEmit.message).toHaveBeenNthCalledWith(numberOfMessages, { type: 'custom/welcome-on-link' });
//       }),
//     );
//   });
//
//   it('should skip broadcasting a message to a user if skipUsername is provided',
//     withServer(async ({ server, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       const [, lisaEmit] = await addUser('lisa');
//       await sleep();
//       expect(server.broadcast({ type: 'custom/hello' }, 'simon')).toBe(1);
//       await sleep();
//       expect(simonEmit.message).not.toHaveBeenCalledWith({ type: 'custom/hello' });
//       expect(lisaEmit.message).toHaveBeenCalledWith({ type: 'custom/hello' });
//     }),
//   );
//
//   it('should allow a connection to link correctly after it was rejected before',
//     withServer(async ({ server, addUser }) => {
//       await addUser('simon');
//       const [user, userEmit] = await addUser();
//       await sleep();
//       const joinMessage: UserJoinMessage = { type: 'user/join', payload: { username: 'simon' } };
//       user.send(JSON.stringify(joinMessage));
//       await sleep();
//       const rejectMessage: UserRejectedMessage = { type: 'user/rejected', payload: { reason: 'username simon is already taken' } };
//       expect(userEmit.message).toHaveBeenCalledWith(rejectMessage);
//       joinMessage.payload.username = 'lisa';
//       user.send(JSON.stringify(joinMessage));
//       await sleep();
//       const acceptMessage: UserAcceptedMessage = { type: 'user/accepted' };
//       expect(userEmit.message).toHaveBeenCalledWith(acceptMessage);
//     }),
//   );
//
//   it('should reject linking a connection to a user, if the reject callback in the accept hook is called with a reason',
//     withServer(async ({ server, serverEmit, addUser }) => {
//       server.on('accept', (username: string, reject: (reason: string) => void) => {
//         if (server.getUsers().length >= 1) {
//           reject('server is full');
//         }
//       });
//       await addUser('simon');
//       await expect(addUser('lisa')).rejects.toBe('server is full');
//       await expect(addUser('marjolein')).rejects.toBe('server is full');
//       expect(serverEmit.accept).toHaveBeenCalledTimes(3);
//       expect(serverEmit.join).toHaveBeenCalledTimes(1);
//     }),
//   );
//
//   it('should not reject a connection if it is trying to link to an existing user',
//     withServer(async ({ server, serverEmit, addUser }) => {
//       server.on('accept', (username: string, reject: (reason: string) => void) => {
//         if (server.getUsers().length >= 1) {
//           reject('server is full');
//         }
//       });
//       const [user] = await addUser('simon');
//       user.close();
//       await addUser('simon');
//       expect(serverEmit.accept).toHaveBeenCalledTimes(1);
//     }),
//   );
//
//   it('should be able to leave a linked user from the server',
//     withServer(async ({ server, serverEmit, addUser }) => {
//       const [, simonEmit] = await addUser('simon');
//       const [, lisaEmit] = await addUser('lisa');
//       server.kick('simon');
//       await sleep();
//       const kickMessage: UserLeaveMessage = { type: 'user/leave', payload: { username: 'simon', reason: 'kicked' } };
//       expect(simonEmit.message).toHaveBeenCalledWith(kickMessage);
//       expect(simonEmit.close).toHaveBeenCalled();
//       expect(lisaEmit.message).toHaveBeenCalledWith(kickMessage);
//       expect(lisaEmit.close).not.toHaveBeenCalled();
//       expect(serverEmit.leave).toHaveBeenCalledWith('simon', 'kicked');
//       expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([
//         { username: 'lisa', isConnected: true },
//       ]);
//     }),
//   );
//
//   it('should be able to leave an unlinked user from the server',
//     withServer(async ({ server, serverEmit, addUser }) => {
//       const [simon] = await addUser('simon');
//       simon.close();
//       await sleep();
//       server.kick('simon');
//       await sleep();
//       expect(serverEmit.leave).toHaveBeenCalledWith('simon', 'kicked');
//       expect(server.getUsers()).toStrictEqual<ReturnType<KarmanServer<KarmanServerMessage>['getUsers']>>([]);
//     }),
//   );
//
//   it('should not allow kicking a user, if that user does not exist',
//     withServer(async ({ server }) => {
//       expect(() => server.kick('simon')).toThrow('Can not kick \'simon\' as there is no user with that username.');
//     }),
//   );
});
