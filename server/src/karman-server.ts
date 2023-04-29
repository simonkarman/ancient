import ws from 'ws';
import http from 'http';
import short from 'short-uuid';

type SyntaxErrorMessage = { type: 'syntax-error', payload: { reason: string } };
type UserJoinMessage = { type: 'user/join', payload: { username: string } };
type UserRejectedMessage = { type: 'user/rejected', payload: { reason: string } };
type UserAcceptedMessage = { type: 'user/accepted' };
type UserLeaveMessage = { type: 'user/leave', payload: { username: string } };
type UserReconnectedMessage = { type: 'user/reconnected', payload: { username: string } };
type UserDisconnectedMessage = { type: 'user/disconnected', payload: { username: string } };
type Message = SyntaxErrorMessage | UserJoinMessage | UserRejectedMessage | UserAcceptedMessage | UserLeaveMessage | UserReconnectedMessage
  | UserDisconnectedMessage;

/**
 * The severity of the log message, which can be either 'debug', 'info'. 'warn, 'error'.
 */
type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger that the Karman Server will use to output log messages. It is called every time the Karman Server wants to output a log message.
 *
 * @param severity Indicates the severity of the log message.
 * @param message The message is the text representation of the event that occurred.
 */
type KarmanServerLogger = (severity: LogSeverity, message: string) => void;

type OnUserMessage<TMessage extends { type: string }> = (username: string, message: TMessage) => void;
type CreateWelcomeMessages<TMessage extends { type: string }> = () => TMessage[];

/**
 * The properties that can be passed to the Karman Server as it is created.
 */
export type KarmanServerProps<TMessage extends { type: string }> = {
  /**
   * Callback that is called every time a user sends a message to the server.
   *
   * @param username The username that send the message.
   * @param message The content of the message that the user sent.
   */
  onUserMessage: OnUserMessage<TMessage>,
  /**
   * Should return a list of messages that are sent to a user as it joins.
   *
   * @default When not provided, no messages are sent.
   */
  createWelcomeMessages?: CreateWelcomeMessages<TMessage>,
  /**
   * The logger that the Karman Server will use.
   *
   * @default When not provided, it will log the info, warn, and error messages to the console based on their severity.
   */
  log?: KarmanServerLogger,
};

/**
 * KarmanServer is a websocket server that abstracts individual websocket connections into users that can join and leave.
 */
export class KarmanServer<TMessage extends { type: string }> {
  // Server
  private readonly httpServer: http.Server;
  private readonly wsServer: ws.WebSocketServer;

  // Configuration
  private readonly onUserMessage: OnUserMessage<TMessage>;
  private readonly createWelcomeMessages: CreateWelcomeMessages<TMessage>;
  private readonly logger: KarmanServerLogger;

  // Internal State
  private readonly connections: { [connectionId: string]: ws.WebSocket } = {};
  private readonly users: { [username: string]: { connectionId: string | undefined } } = {};

  /**
   * Create a new Karman Server.
   * Note: This does not start the server. To start the server call the `.start(<port>)` method on the created object.
   *
   * @param props The properties with which the server should be created.
   */
  public constructor(props: KarmanServerProps<TMessage>) {
    // Server
    this.httpServer = http.createServer();
    this.wsServer = new ws.WebSocketServer({ server: this.httpServer });

    // Configuration
    this.onUserMessage = props.onUserMessage;
    this.createWelcomeMessages = props.createWelcomeMessages || (() => []);
    this.logger = props.log || ((severity: LogSeverity, message: string) => {
      severity !== 'debug' && console[severity](`[${severity}] [karman-server] ${message}`);
    });

    // Configure websocket server
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const karmanServer = this;
    this.wsServer.on('connection', function(connection) {
      const connectionId = `cn-${short.generate()}`;
      let username: string | undefined = undefined;
      karmanServer.connections[connectionId] = connection;
      karmanServer.logger('debug', `connection '${connectionId}' opened`);

      connection.on('message', (data) => {
        karmanServer.onRawDataReceived(
          data,
          connectionId,
          username,
          (_username: string | undefined) => username = _username,
          () => connection.close(),
          (message: Message) => connection.send(JSON.stringify(message)),
        );
      });

      connection.on('close', () => {
        karmanServer.onConnectionClosed(connectionId, username);
        username = undefined;
      });
    });
  }

  private onRawDataReceived(
    rawData: ws.RawData,
    connectionId: string,
    username: string | undefined,
    setUsername: (username: string | undefined) => void,
    close: () => void,
    send: (message: Message) => void,
  ): void {
    const tryParse = (data: ws.RawData): Message => {
      try {
        return JSON.parse(data.toString());
      } catch (error) {
        if (error instanceof SyntaxError) {
          return { type: 'syntax-error', payload: { reason: error.message } };
        }
        return { type: 'syntax-error', payload: { reason: 'unknown' } };
      }
    };
    const message: Message = tryParse(rawData);
    if (!message?.type) {
      this.logger('warn', 'connection immediately closed, since a message with unknown format '
        + `was received from '${username ?? connectionId}'.`);
      close();
      return;
    }
    if (message.type === 'syntax-error') {
      this.logger('warn', `connection immediately closed, since a message with unknown format (${message.payload.reason}) ` +
        `was received from '${username ?? connectionId}'`);
      close();
      return;
    }
    if (
      message.type === 'user/reconnected'
      || message.type === 'user/disconnected'
      || message.type === 'user/accepted'
      || message.type === 'user/rejected'
    ) {
      this.logger('warn', `connection immediately closed, since a '${message.type}' message was received ` +
        `from '${username ?? connectionId}', while this is a message that should only be sent by the server to clients.`);
      close();
      return;
    }

    const isJoinMessage = message.type === 'user/join';
    // Normal: Has username && NOT trying to join
    if (username !== undefined && !isJoinMessage) {
      if (message.type === 'user/leave') {
        if (message.payload?.username !== username) {
          this.logger('warn', `'${username}' is trying to make '${message.payload?.username}' leave, ` +
            `which '${username}' is not allowed to do.`);
          return;
        }
        delete this.users[username];
        close();
        this.broadcast({ type: 'user/leave', payload: { username } });
        this.logger('info', `'${username}' left.`);
        username = undefined;
        setUsername(undefined);
      } else {
        this.onUserMessage(username, message);
      }
    // Setup: Does NOT have username && trying to join
    } else if (username === undefined && isJoinMessage) {
      if (!message?.payload?.username) {
        this.logger('warn', 'connection immediately closed, since a join message with unknown format was received '
          + `from '${connectionId}'.`);
        close();
        return;
      }
      const sendWelcomeMessages = () => {
        // Accepted Welcome Message
        const acceptedMessage: UserAcceptedMessage = { type: 'user/accepted' };
        send(acceptedMessage);
        // User Welcome Messages
        Object.entries(this.users).forEach(([username, { connectionId }]) => {
          const message: UserDisconnectedMessage | UserReconnectedMessage = {
            type: connectionId === undefined ? 'user/disconnected' : 'user/reconnected',
            payload: { username },
          };
          send(message);
        });
        // Custom Welcome Messages
        this.createWelcomeMessages().forEach(message => {
          send(message as Message);
        });
      };
      if (this.users[message.payload.username] === undefined) {
        username = message.payload.username;
        setUsername(message.payload.username);
        sendWelcomeMessages();
        this.users[message.payload.username] = { connectionId };
        this.broadcast({ type: 'user/join', payload: { username } });
        this.logger('info', `'${username}' joined from connection '${connectionId}'.`);
      } else if (this.users[message.payload.username].connectionId === undefined) {
        username = message.payload.username;
        setUsername(message.payload.username);
        sendWelcomeMessages();
        this.users[message.payload.username].connectionId = connectionId;
        this.broadcast({ type: 'user/reconnected', payload: { username } });
        this.logger('info', `'${username}' reconnected from connection '${connectionId}'.`);
      } else {
        const rejectedMessage: UserRejectedMessage = {
          type: 'user/rejected',
          payload: { reason: `username ${message.payload.username} was already taken` },
        };
        send(rejectedMessage);
        this.logger('info', `'${message.payload.username}' rejected from connection '${connectionId}', since username is already taken.`);
      }
      // Early leaver: has no username && trying to leave
    } else if (username === undefined && message.type === 'user/leave') {
      this.logger('debug', `connection '${connectionId}' is voluntarily leaving before being accepted.`);
      close();
      return;
      // Weird situations
      //  - the username is set, but getting a 'trying to join' message
      //  - the username is not set, but getting a message other than a 'trying to join' or 'trying to leave' message
    } else {
      this.logger('warn', `connection '${connectionId}' received a message of type '${message.type}'`
        + `, while it is ${username ? '' : 'NOT '}connected to a user`);
    }
  }

  private onConnectionClosed(connectionId: string, username: string | undefined): void {
    if (username === undefined) {
      delete this.connections[connectionId];
      this.logger('debug', `connection '${connectionId}' closed.`);
    } else {
      this.users[username].connectionId = undefined;
      this.broadcast({ type: 'user/disconnected', payload: { username } });
      this.logger('info', `'${username}' disconnected.`);
    }
  }

  /**
   * Starts the server at the specified port number.
   *
   * @param port The port number at which to start the server.
   */
  public start(port?: number): void {
    this.httpServer.listen(port, () => {
      const address = this.httpServer.address();
      this.logger('info', `started on port ${typeof address === 'string' ? address : address?.port}`);
    });
  }

  /**
   * Broadcasts a message to all users, that are currently connected to the server.
   *
   * @param message The message to send to all the users.
   * @param skipUsername (optional) The username of the user you want to skip sending this message to.
   *
   * @returns Returns the number of users this message is actually sent to.
   */
  public broadcast(message: TMessage | Message, skipUsername?: string): number {
    const data = JSON.stringify(message);
    return Object.entries(this.users)
      .filter(([username, { connectionId }]) => skipUsername !== username && connectionId !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map(([, { connectionId }]) => this.connections[connectionId!])
      .filter(connection => connection.readyState === ws.WebSocket.OPEN)
      .map(connection => connection.send(data))
      .length;
  }

  /**
   * Sends a message to a specific user, if it is currently connected to the server.
   *
   * @param username The username of the user to send the message to.
   * @param message The message to send to the user.
   *
   * @returns Returns whether the message is sent to the client.
   */
  public send(username: string, message: TMessage): boolean {
    const user = this.users[username];
    if (user === undefined) {
      throw new Error(`Can not send message to '${username}' as there is no user with that username.`);
    }
    const { connectionId } = user;
    if (connectionId === undefined) {
      this.logger('warn', `can not send message to '${username}' as that user is not connected.`);
      return false;
    }
    const connection = this.connections[connectionId];
    if (connection.readyState !== ws.WebSocket.OPEN) {
      throw new Error(`Can not send message to '${username}' as the connection '${connection}' its using is '${connection.readyState}'`);
    }
    const data = JSON.stringify(message);
    connection.send(data);
    return true;
  }
}

