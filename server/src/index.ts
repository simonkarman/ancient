import { WebSocket, RawData, WebSocketServer } from 'ws';
import http from 'http';
import { v4 as uuid } from 'uuid';

const httpServer = http.createServer();
const wsServer = new WebSocketServer({ server: httpServer });
const port = 8082;
httpServer.listen(port, () => {
  console.log(`[server] Ancient websocket server started on port: ${port}`);
});

const connections: { [connectionId: string]: WebSocket } = {};
const users: { [username: string]: { connectionId: string | undefined } } = {};

type SyntaxErrorMessage = { type: 'syntax-error', payload: { reason: string } };
type UserJoinMessage = { type: 'user/join', payload: { username: string } };
type UserRejectedMessage = { type: 'user/rejected', payload: { reason: string } };
type UserAcceptedMessage = { type: 'user/accepted' };
type UserLeaveMessage = { type: 'user/leave', payload: { username: string } };
type UserReconnectedMessage = { type: 'user/reconnected', payload: { username: string } };
type UserDisconnectedMessage = { type: 'user/disconnected', payload: { username: string } };
type Message = SyntaxErrorMessage | UserJoinMessage | UserRejectedMessage | UserLeaveMessage | UserReconnectedMessage | UserDisconnectedMessage;

// function send<T>(username: string, message: T) {
//   const { connectionId } = users[username];
//   if (connectionId === undefined) {
//     throw new Error(`Can not send message to '${username}' as there is no connection available for it.`);
//   }
//   const connection = connections[connectionId];
//   if (connection.readyState !== WebSocket.OPEN) {
//     throw new Error(`Can not send message to '${username}' as the connection '${connection}' its using is '${connection.readyState}'`);
//   }
//   const data = JSON.stringify(message);
//   connection.send(data);
// }

function broadcast<T>(message: T, skipUsername?: string) {
  const data = JSON.stringify(message);
  Object.entries(users)
    .filter(([username, { connectionId }]) => skipUsername !== username && connectionId !== undefined)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map(([, { connectionId }]) => connections[connectionId!])
    .filter(connection => connection.readyState === WebSocket.OPEN)
    .forEach(connection => connection.send(data));
}

wsServer.on('connection', function(connection) {
  const connectionId = uuid();
  let username: string | undefined = undefined;
  connections[connectionId] = connection;
  console.info(`[server] connection '${connectionId}' opened.`);

  connection.on('message', (data) => {
    const tryParse = (data: RawData): Message => {
      try {
        return JSON.parse(data.toString());
      } catch (error) {
        if (error instanceof SyntaxError) {
          return { type: 'syntax-error', payload: { reason: error.message } };
        }
        return { type: 'syntax-error', payload: { reason: 'unknown' } };
      }
    };
    const message: Message = tryParse(data);
    if (!message?.type) {
      console.error(`[server] received message with unknown format from '${username ?? connectionId}'.`);
      connection.close();
      return;
    }
    if (message.type === 'syntax-error') {
      console.error(`[server] received message with unknown format (${message.payload.reason}) from '${username ?? connectionId}'`);
      connection.close();
      return;
    }
    if (message.type === 'user/reconnected' || message.type === 'user/disconnected' || message.type === 'user/rejected') {
      console.error(`[server] received '${message.type}' message from '${username ?? connectionId}'` +
        ', while this is a message that should only be sent by the server to clients.');
      return;
    }

    const isJoinMessage = message.type === 'user/join';
    // Normal: Has username && NOT trying to join
    if (username !== undefined && !isJoinMessage) {
      if (message.type === 'user/leave') {
        if (message.payload?.username !== username) {
          console.error(`[server] '${username}' is trying to make '${message.payload?.username}' leave, which '${username}' is not allowed to do.`);
          return;
        }
        delete users[username];
        connection.close();
        broadcast<Message>({ type: 'user/leave', payload: { username } });
        console.info(`[server] '${username}' left.`);
        username = undefined;
      } else {
        onUserMessage(username, message);
      }
    // Setup: Does NOT have username && trying to join
    } else if (username === undefined && isJoinMessage) {
      if (!message?.payload?.username) {
        console.error(`[server] received join message with unknown format from '${username ?? connectionId}'.`);
        connection.close();
        return;
      }
      const sendExistingInformation = () => {
        Object.entries(users).forEach(([otherUsername, { connectionId }]) => {
          const message: UserDisconnectedMessage | UserReconnectedMessage = {
            type: connectionId === undefined ? 'user/disconnected' : 'user/reconnected',
            payload: {
              username: otherUsername,
            },
          };
          connection.send(JSON.stringify(message));
        });
        getExistingInformationMessages().forEach(message => {
          connection.send(JSON.stringify(message));
        });
      };
      if (users[message.payload.username] === undefined) {
        username = message.payload.username;
        const acceptedMessage: UserAcceptedMessage = { type: 'user/accepted' };
        connection.send(JSON.stringify(acceptedMessage));
        sendExistingInformation();
        users[message.payload.username] = { connectionId };
        broadcast<Message>({ type: 'user/join', payload: { username } });
        console.info(`[server] '${username}' joined from connection '${connectionId}'.`);
      } else if (users[message.payload.username].connectionId === undefined) {
        username = message.payload.username;
        const acceptedMessage: UserAcceptedMessage = { type: 'user/accepted' };
        connection.send(JSON.stringify(acceptedMessage));
        sendExistingInformation();
        users[message.payload.username].connectionId = connectionId;
        broadcast<Message>({ type: 'user/reconnected', payload: { username } });
        console.info(`[server] '${username}' reconnected from connection '${connectionId}'.`);
      } else {
        const rejectedMessage: UserRejectedMessage = {
          type: 'user/rejected',
          payload: { reason: `username ${message.payload.username} was already taken` },
        };
        connection.send(JSON.stringify(rejectedMessage));
        console.info(`[server] '${message.payload.username}' rejected from connection '${connectionId}', since username is already taken.`);
      }
    } else if (username === undefined && message.type === 'user/leave') {
      console.info(`[server] connection '${connectionId}' is voluntarily leaving before being accepted.`);
      connection.close();
      return;
    // Weird situations
    //  - the username is set, but getting a 'trying to join' message
    //  - the username is not set, but getting a message other than a 'trying to join' or 'trying to leave' message
    } else {
      console.error(`[server] connection '${connectionId}' received a message of type '${message.type}'`
        + `, while it is ${username ? '' : 'NOT '}connected to a user`);
    }
  });

  connection.on('close', () => {
    if (username === undefined) {
      delete connections[connectionId];
      console.info(`[server] connection '${connectionId}' closed.`);
    } else {
      users[username].connectionId = undefined;
      broadcast<Message>({ type: 'user/disconnected', payload: { username } });
      console.info(`[server] '${username}' disconnected.`);
      username = undefined;
    }
  });
});

// Ancient Logic
type IncreaseCounterMessage = { type: 'counter/increase' };
type SetCounterMessage = { type: 'counter/set', payload: { value: number } };
type AncientMessage = Message | IncreaseCounterMessage | SetCounterMessage;

let counter = 0;

function onUserMessage(username: string, message: AncientMessage) {
  switch (message?.type) {
  case 'counter/increase':
    counter += 1;
    broadcast<AncientMessage>({ type: 'counter/set', payload: { value: counter } });
    break;
  default:
    console.error(`[ancient] received noop message: ${message.type} from ${username}`);
    return;
  }
}

function getExistingInformationMessages(): AncientMessage[] {
  return [{ type: 'counter/set', payload: { value: counter } }];
}
