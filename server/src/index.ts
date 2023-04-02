import { WebSocket, RawData, WebSocketServer } from 'ws';
import http from 'http';
import { v4 as uuid } from 'uuid';

const httpServer = http.createServer();
const wsServer = new WebSocketServer({ server: httpServer });
const port = 8082;
httpServer.listen(port, () => {
  console.log(`Ancient websocket server started on port: ${port}`);
});

const connections: { [connectionId: string]: WebSocket } = {};
const users: { [username: string]: { connectionId: string | undefined } } = {};

type SyntaxErrorMessage = { type: 'syntax-error', reason: string };
type UserJoinMessage = { type: 'user/join', username: string };
type UserRejectedMessage = { type: 'user/rejected', reason: string };
type UserLeaveMessage = { type: 'user/leave', username: string };
type UserReconnectedMessage = { type: 'user/reconnected', username: string };
type UserDisconnectedMessage = { type: 'user/disconnected', username: string };
type Message = SyntaxErrorMessage | UserJoinMessage | UserRejectedMessage | UserLeaveMessage | UserReconnectedMessage | UserDisconnectedMessage;

function send<T>(username: string, message: T) {
  const { connectionId } = users[username];
  if (connectionId === undefined) {
    throw new Error(`Can not send message to '${username}' as there is no connection available for it.`)
  }
  const connection = connections[connectionId];
  if (connection.readyState !== WebSocket.OPEN) {
    throw new Error(`Can not send message to '${username}' as the connection '${connection}' its using is '${connection.readyState}'`)
  }
  const data = JSON.stringify(message);
  connection.send(data)
}

function broadcast<T>(message: T, skipUsername?: string) {
  const data = JSON.stringify(message);
  Object.entries(users)
    .filter(([username, {connectionId}]) => skipUsername !== username && connectionId !== undefined)
    .map(([,{connectionId}]) => connections[connectionId!])
    .filter(connection => connection.readyState === WebSocket.OPEN)
    .forEach(connection => connection.send(data))
}

wsServer.on('connection', function(connection) {
  const connectionId = uuid();
  let username: string | undefined = undefined;
  connections[connectionId] = connection;
  console.info(`connection '${connectionId}' opened.`);

  connection.on('message', (data) => {
    const tryParse = (data: RawData): Message => {
      try {
        return JSON.parse(data.toString());
      } catch (error) {
        if (error instanceof SyntaxError) {
          return { type: 'syntax-error', reason: error.message };
        }
        return { type: 'syntax-error', reason: 'unknown' };
      }
    }
    const message: Message = tryParse(data);
    if (!message?.type) {
      console.error(`received message with unknown format from '${username ?? connectionId}'.`);
      connection.close();
      return;
    }
    if (message.type === 'syntax-error') {
      console.error(`received message with unknown format (${message.reason}) from '${username ?? connectionId}'`);
      connection.close();
      return;
    }
    if (message.type === 'user/reconnected' || message.type === 'user/disconnected' || message.type === 'user/rejected') {
      console.error(`received '${message.type}' message from '${username ?? connectionId}', while this is a message that should only be sent by the server to clients.`);
      return;
    }

    const isJoinMessage = message.type === 'user/join';
    // Normal: Has username && NOT trying to join
    if (username !== undefined && !isJoinMessage) {
      if (message.type === 'user/leave') {
        if (message.username !== username) {
          console.error(`'${username}' is trying to make '${message.username}' leave, which '${username}' is not allowed to do.`);
          return;
        }
        delete users[username];
        connection.close();
        broadcast<Message>({ type: 'user/leave', username });
        console.info(`'${username}' left.`);
        username = undefined;
      } else {
        onUserMessage(username, message);
      }
    // Setup: Does NOT have username && trying to join
    } else if (username === undefined && isJoinMessage) {
      if (!message?.username) {
        console.error(`received join message with unknown format from '${username ?? connectionId}'.`)
        connection.close();
        return;
      }
      const sendExistingInformation = () => {
        Object.entries(users).map(([otherUsername, { connectionId }]) => {
          connection.send(JSON.stringify({
            type: connectionId === undefined ? 'user/disconnected' : 'user/reconnected',
            username: otherUsername
          }));
        });
      };
      if (users[message.username] === undefined) {
        username = message.username;
        sendExistingInformation();
        users[message.username] = { connectionId };
        broadcast<Message>({ type: 'user/join', username });
        console.info(`'${username}' joined from connection '${connectionId}'.`);
      } else if (users[message.username].connectionId === undefined) {
        username = message.username;
        sendExistingInformation();
        users[message.username].connectionId = connectionId;
        broadcast<Message>({ type: 'user/reconnected', username });
        console.info(`'${username}' reconnected from connection '${connectionId}'.`);
      } else {
        connection.send(JSON.stringify({ type: 'user/rejected', message: 'username already taken' }));
        console.info(`'${message.username}' rejected from connection '${connectionId}', since username is already taken.`);
      }
    // Weird situations
    //  - the username is set, but getting a 'trying to join' message
    //  - the username is not set, but getting a message other than a 'trying to join' message
    } else {
      console.error(`connection '${connectionId}' received a message of type '${message.type}', while it is ${username ? '' : 'NOT '}connected to a user`)
    }
  });

  connection.on('close', () => {
    if (username === undefined) {
      delete connections[connectionId];
      console.info(`connection '${connectionId}' closed.`);
    } else {
      users[username].connectionId = undefined;
      broadcast<Message>({ type: 'user/disconnected', username });
      console.info(`'${username}' disconnected.`);
      username = undefined;
    }
  });
});

// Ancient Logic
type IncreaseCounterMessage = { type: 'counter/increase' };
type SetCounterMessage = { type: 'counter/set', value: number };
type AncientMessage = Message | IncreaseCounterMessage | SetCounterMessage;

let counter = 0;

function onUserMessage(username: string, message: AncientMessage) {
  const user = users[username];
  switch (message?.type) {
    case 'counter/set':
      counter = message.value;
      broadcast<AncientMessage>(message);
      break;
    case 'counter/increase':
      counter += 1;
      broadcast<AncientMessage>({ type: 'counter/set', value: counter });
      break;
    default:
      console.error(`Received noop message: ${message.type} from ${username}`)
      return;
  }
}
