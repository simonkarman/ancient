import ws, { AddressInfo } from 'ws';
import http from 'http';
import short from 'short-uuid';
import { EventEmitter } from './event-emitter';

export type SyntaxErrorMessage = { type: 'syntax-error', payload: { reason: string } };
export type UserJoinMessage = { type: 'user/join', payload: { username: string } };
export type UserRejectedMessage = { type: 'user/rejected', payload: { reason: string } };
export type UserAcceptedMessage = { type: 'user/accepted' };
export type UserLeaveMessage = { type: 'user/leave', payload: { username: string } };
export type UserReconnectedMessage = { type: 'user/reconnected', payload: { username: string } };
export type UserDisconnectedMessage = { type: 'user/disconnected', payload: { username: string } };
export type KarmanServerMessage = SyntaxErrorMessage | UserJoinMessage | UserRejectedMessage | UserAcceptedMessage | UserLeaveMessage
  | UserReconnectedMessage | UserDisconnectedMessage;
export type UnknownMessage = { type: unknown };

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

/**
 * The properties that can be passed to the Karman Server as it is initializing.
 */
export type KarmanServerProps = {
  /**
   * @default When not provided, it will log (non debug) to the standard console.
   */
  log?: KarmanServerLogger;
};

type KarmanServerEvents<TMessage> = {
  /**
   * This event is emitted once the server has started and is ready to accept connections.
   *
   * @param port The port at which the server started listening.
   */
  start: [port: number];

  /**
   * This event is emitted once the server has stopped running.
   */
  stop: [];

  /**
   * This event is emitted every time a new user joins the server.
   *
   * @param username The username of the new user that joined.
   */
  join: [username: string];

  /**
   * This event is emitted every time a user connects to the server. In other words: the first time the users joins, but also everytime that user
   *  reconnects.
   * For example: You can use this to send the current state of the server to the client.
   *
   * @param username The username of the user that connected.
   */
  connect: [username: string];

  /**
   * This event is emitted every time a user disconnects from the server without intending to leave.
   *
   * @param username The username of the user that disconnected.
   */
  disconnect: [username: string];

  /**
   * This event is emitted every time a user leaves the server.
   *
   * @param username The username of the user that left.
   */
  leave: [username: string],

  /**
   * This event is emitted every time a user sends a message to the server.
   *
   * @param username The username of the user that send the message.
   * @param message The content of the message that the user sent.
   */
  message: [username: string, message: TMessage]
}

/**
 * The states of a Karman Server.
 *
 * @description *initializing*: The server is initializing, but has not yet been started. This allows you to configure callbacks for the server before it starts.
 * @description *starting*: The start method of the server has been invoked, but the server is not yet running.
 * @description *running*: The server is running and accepting connections.
 * @description *stopping*: The stop method of the server has been invoked, but the server has not yet stopped.
 * @description *stopped*: The server has stopped.
 */
export type KarmanServerState = 'initializing' | 'starting' | 'running' | 'stopping' | 'stopped';

/**<KarmanServerEvents<TMessage>>
 * KarmanServer is a websocket server that abstracts individual websocket connections into users that can join and leave.
 */
export class KarmanServer<TMessage extends { type: string }> extends EventEmitter<KarmanServerEvents<TMessage>> {
  private readonly httpServer: http.Server;
  private readonly logger: KarmanServerLogger;
  private state: KarmanServerState;

  // Internal State
  private readonly connections: { [connectionId: string]: ws.WebSocket } = {};
  private readonly users: { [username: string]: { connectionId: string | undefined } } = {};

  /**
   * Create a new Karman Server.
   * Note: This does not start the server. To start the server call the `.start(<port>)` method on the new object.
   *
   * @param props The properties with which the server should be initialized.
   */
  public constructor(props?: KarmanServerProps) {
    super();

    // Server
    this.httpServer = http.createServer();
    this.state = 'initializing';
    this.httpServer.on('close', () => {
      this.state = 'stopped';
      this.logger('info', 'server has stopped.');
      this.emit('stop');
    });
    const wsServer = new ws.WebSocketServer({ server: this.httpServer });

    // Configuration
    this.logger = props?.log || ((severity: LogSeverity, message: string) => {
      severity !== 'debug' && console[severity](`[${severity}] [karman-server] ${message}`);
    });

    // Configure websocket server
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const karmanServer = this;
    wsServer.on('connection', function(connection) {
      /* istanbul ignore if */
      if (karmanServer.state !== 'running') {
        karmanServer.logger('debug', `an incoming connection was immediately discarded as the server is ${karmanServer.state}.`);
        connection.close();
        return;
      }

      const connectionId = `cn-${short.generate()}`;
      let username: string | undefined = undefined;
      karmanServer.connections[connectionId] = connection;
      karmanServer.logger('debug', `connection '${connectionId}' opened.`);

      connection.on('message', (data) => {
        karmanServer.onRawDataReceived(
          data,
          connectionId,
          username,
          (_username: string | undefined) => username = _username,
          () => connection.close(),
          (message: KarmanServerMessage) => connection.send(JSON.stringify(message)),
        );
      });

      connection.on('close', () => {
        karmanServer.onConnectionClosed(connectionId, username);
        username = undefined;
      });
    });
  }

  /**
   * Internal method for when new data is received from a WebSocket connection
   * @private
   */
  private onRawDataReceived(
    rawData: ws.RawData,
    connectionId: string,
    username: string | undefined,
    setUsername: (username: string | undefined) => void,
    close: () => void,
    send: (message: KarmanServerMessage) => void,
  ): void {
    const tryParse = (data: ws.RawData): KarmanServerMessage => {
      try {
        return JSON.parse(data.toString());
      } catch (error: unknown) {
        return {
          type: 'syntax-error',
          payload: {
            reason: (error as SyntaxError).message,
          },
        };
      }
    };
    const unknownMessage: UnknownMessage = tryParse(rawData);
    if (!unknownMessage.type || typeof unknownMessage.type !== 'string') {
      this.logger('warn', 'connection immediately closed, since a message with unknown format '
        + `was received from '${username ?? connectionId}'.`);
      close();
      return;
    }
    const message = unknownMessage as KarmanServerMessage;
    if (message.type === 'syntax-error') {
      this.logger('warn', `connection immediately closed, since a message with unknown format (${message.payload.reason}) ` +
        `was received from '${username ?? connectionId}'.`);
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
        this.emit('leave', username);
        close();
        this.broadcast({ type: 'user/leave', payload: { username } });
        this.logger('info', `'${username}' left.`);
        username = undefined;
        setUsername(undefined);
      } else {
        this.emit('message', username, message);
      }
    // Setup: Does NOT have username && trying to join
    } else if (username === undefined && isJoinMessage) {
      if (!message.payload?.username) {
        this.logger('warn', 'connection immediately closed, since a join message with unknown format was received '
          + `from '${connectionId}'.`);
        close();
        return;
      }
      const sendWelcomeMessages = (isJoin: boolean, username: string) => {
        // Accepted Welcome Message
        const acceptedMessage: UserAcceptedMessage = { type: 'user/accepted' };
        send(acceptedMessage);
        // User Welcome Messages
        Object.entries(this.users).forEach(([otherUsername, { connectionId }]) => {
          if (otherUsername === username) {
            return;
          }
          const message: UserDisconnectedMessage | UserReconnectedMessage = {
            type: connectionId === undefined ? 'user/disconnected' : 'user/reconnected',
            payload: { username: otherUsername },
          };
          send(message);
        });
        // If this is a new joiner, also emit for the new joiner
        if (isJoin) {
          this.emit('join', username);
        }
        // Emit connect event
        this.emit('connect', username);
      };
      if (this.users[message.payload.username] === undefined) {
        username = message.payload.username;
        setUsername(message.payload.username);
        this.users[message.payload.username] = { connectionId };
        sendWelcomeMessages(true, username);
        this.broadcast({ type: 'user/join', payload: { username } });
        this.logger('info', `'${username}' joined from connection '${connectionId}'.`);
      } else if (this.users[message.payload.username].connectionId === undefined) {
        username = message.payload.username;
        setUsername(message.payload.username);
        this.users[message.payload.username].connectionId = connectionId;
        sendWelcomeMessages(false, username);
        this.broadcast({ type: 'user/reconnected', payload: { username } });
        this.logger('info', `'${username}' reconnected from connection '${connectionId}'.`);
      } else {
        const rejectedMessage: UserRejectedMessage = {
          type: 'user/rejected',
          payload: { reason: `username ${message.payload.username} is already taken` },
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
        + `, while it is ${username ? '' : 'NOT '}connected to a user.`);
      close();
      return;
    }
  }

  /**
   * Internal method for when a WebSocket connection is closed
   * @private
   */
  private onConnectionClosed(connectionId: string, username: string | undefined): void {
    if (username === undefined) {
      delete this.connections[connectionId];
      this.logger('debug', `connection '${connectionId}' closed.`);
    } else {
      this.users[username].connectionId = undefined;
      try {
        this.broadcast({ type: 'user/disconnected', payload: { username } });
      } catch (e) {
        this.logger('debug', `broadcasting failed while '${username}' disconnected, due too ${e}.`);
      }
      this.logger('info', `'${username}' disconnected.`);
      this.emit('disconnect', username);
    }
  }

  /**
   * Starts the server at the specified port number.
   *
   * @param port The port number at which to start the server. When not provided, the server will start at an available port.
   */
  public start(port?: number): void {
    if (this.state !== 'initializing') {
      throw new Error(`Cannot start a ${this.state} server.`);
    }
    this.state = 'starting';
    this.httpServer.listen(port, () => {
      this.state = 'running';
      const address = this.httpServer.address() as AddressInfo;
      this.logger('info', `started on port ${address.port}.`);
      this.emit('start', address.port);
    });
  }

  /**
   * Stops the server.
   */
  public stop() {
    if (this.state !== 'starting' && this.state !== 'running') {
      throw new Error(`Cannot stop a ${this.state} server.`);
    }
    this.state = 'stopping';
    this.logger('info', 'server is stopping.');
    this.httpServer.close();
    this.httpServer.closeAllConnections();
  }

  /**
   * Get the current status of the server.
   */
  public getStatus(): KarmanServerState {
    return this.state;
  }

  /**
   * Get the current users known to the server.
   */
  public getUsers(): { username: string, isConnected: boolean }[] {
    return Object.entries(this.users).map(([username, { connectionId }]) => {
      return { username, isConnected: connectionId != undefined };
    });
  }

  /**
   * Broadcasts a message to all users, that are currently connected to the server.
   *
   * @param message The message to send to all the users.
   * @param skipUsername (optional) The username of the user you want to skip sending this message to.
   *
   * @returns Returns the number of users this message is sent to.
   */
  public broadcast(message: TMessage | KarmanServerMessage, skipUsername?: string): number {
    if (this.state !== 'running') {
      throw new Error('Cannot broadcast a message if the server is not running.');
    }
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
    if (this.state !== 'running') {
      throw new Error('Cannot send a message if the server is not running.');
    }
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
    /* istanbul ignore if */
    if (connection.readyState !== ws.WebSocket.OPEN) {
      throw new Error(`Can not send message to '${username}' as the connection '${connection}' its using is '${connection.readyState}'`);
    }
    const data = JSON.stringify(message);
    connection.send(data);
    return true;
  }
}

