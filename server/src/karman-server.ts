import ws, { AddressInfo } from 'ws';
import http from 'http';
import short from 'short-uuid';
import { DateTime } from 'luxon';
import { EventEmitter } from './event-emitter';

export type SyntaxErrorMessage = { type: 'syntax-error', payload: { reason: string } };
export type UserJoinMessage = { type: 'user/join', payload: { username: string } };
export type UserRejectedMessage = { type: 'user/rejected', payload: { reason: string } };
export type UserAcceptedMessage = { type: 'user/accepted' };
export type UserLeaveMessage = { type: 'user/leave', payload: { username: string, reason: 'voluntary' | 'kicked' } };
export type UserLinkedMessage = { type: 'user/linked', payload: { username: string } };
export type UserUnlinkedMessage = { type: 'user/unlinked', payload: { username: string } };
export type KarmanServerMessage = SyntaxErrorMessage | UserJoinMessage | UserRejectedMessage | UserAcceptedMessage | UserLeaveMessage
  | UserLinkedMessage | UserUnlinkedMessage;
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
   * The logger that the Karman Server should use.
   *
   * @default When not provided, it will log (non debug) to the standard console.
   */
  log?: KarmanServerLogger;

  /**
   * Whether metadata should be added to sent and broadcast messages. If set to true, each message send or broadcast to users will include a
   *  'metadata' field in the root of the json message including the timestamp it was sent and wether the message was a broadcast.
   * Example message when metadata is set to true:
   *  {
   *    type: "custom/message",
   *    payload: { value: 3 },
   *    metadata: { isBroadcast: true, timestamp: "2023-04-07T20:11:11.432Z" },
   *  }
   *
   * @default When not provided, metadata will not be added to messages.
   */
  metadata?: boolean;
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
   * This event is emitted every time a new user tries to join the server.
   *
   * @param username The username of the new user that is trying to join.
   * @param reject A reject callback that, if invoked, will reject the user from joining the server with the provided reason.
   */
  accept: [username: string, reject: (reason: string) => void];

  /**
   * This event is emitted every time a new user has joined the server.
   *
   * @param username The username of the new user that joined.
   */
  join: [username: string];

  /**
   * This event is emitted every time a user is (re)linked to a connection. This is emitted when a user joins and everytime that a user reconnects.
   * Note: When a user links, this could be with a different or the same connection as it was linked with before.
   *
   * Example: You can use this to send the current state of the server to the user.
   *
   * @param username The username of the user that linked to a connection.
   */
  link: [username: string];

  /**
   * This event is emitted every time a user is no longer linked to a connection. This can happen when a user has disconnected from the server
   *  without it indicating it wanted to leave. For example: due to a bad internet connection or accidental refresh of the webpage.
   *
   * Example: You can use this to pause the game and wait for the user to be linked to a connection again.
   *
   * @param username The username of the user that unlinked from its connection.
   */
  unlink: [username: string];

  /**
   * This event is emitted every time a user is about to leave the server.
   *
   * @param username The username of the user that left.
   * @param reason The reason why the user left the server. This can be either voluntarily (voluntary) or because it was kicked (kicked).
   */
  leave: [username: string, reason: 'voluntary' | 'kicked'],

  /**
   * This event is emitted every time a user has sent a message to the server.
   *
   * @param username The username of the user that send the message.
   * @param message The content of the message that the user sent.
   */
  message: [username: string, message: TMessage]
}

/**
 * The states of a Karman Server.
 *
 * @description *initializing*: The server is initializing, but has not yet been started. This allows you to configure callbacks for the server
 *  before it starts.
 * @description *starting*: The start method of the server has been invoked, but the server is not yet running.
 * @description *running*: The server is running and accepting connections.
 * @description *stopping*: The stop method of the server has been invoked, but the server has not yet stopped.
 * @description *stopped*: The server has stopped.
 */
export type KarmanServerState = 'initializing' | 'starting' | 'running' | 'stopping' | 'stopped';

// TODO: create sequence diagram with all flows (and make sure that the tests are including all these flows)
/**
 * KarmanServer is a websocket server that abstracts individual websocket connections into users that can join, leave, and interact by linking to
 *  these connections.
 */
export class KarmanServer<TMessage extends { type: string }> extends EventEmitter<KarmanServerEvents<TMessage>> {
  private readonly httpServer: http.Server;
  private readonly logger: KarmanServerLogger;
  private state: KarmanServerState;

  // Internal State
  private readonly connections: { [connectionId: string]: { socket: ws.WebSocket, username: string | undefined } } = {};
  private readonly users: { [username: string]: { connectionId: string | undefined } } = {};
  private readonly metadata: boolean;

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
    this.logger = props?.log ?? ((severity: LogSeverity, message: string) => {
      severity !== 'debug' && console[severity](`[${severity}] [karman-server] ${message}`);
    });
    this.metadata = props?.metadata ?? false;

    // Configure websocket server
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const karmanServer = this;
    wsServer.on('connection', function(socket) {
      /* istanbul ignore if */
      if (karmanServer.state !== 'running') {
        karmanServer.logger('debug', `an incoming connection was immediately discarded as the server is ${karmanServer.state}.`);
        socket.close();
        return;
      }

      const connectionId = `cn-${short.generate()}`;
      karmanServer.connections[connectionId] = { socket, username: undefined };
      karmanServer.logger('debug', `connection '${connectionId}' opened.`);

      socket.on('message', (data) => {
        karmanServer.onRawDataReceived(
          data,
          connectionId,
          () => socket.close(),
          (message: KarmanServerMessage) => socket.send(JSON.stringify({
            ...message,
            ...karmanServer.getMetadata(false),
          })),
        );
      });

      socket.on('close', () => {
        karmanServer.onConnectionClosed(connectionId);
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
    close: () => void,
    send: (message: KarmanServerMessage) => void,
  ): void {
    const { username } = this.connections[connectionId];
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
      message.type === 'user/linked'
      || message.type === 'user/unlinked'
      || message.type === 'user/accepted'
      || message.type === 'user/rejected'
    ) {
      this.logger('warn', `connection immediately closed, since a '${message.type}' message was received ` +
        `from '${username ?? connectionId}', while this is a message that should only be sent by the server to users.`);
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
        this.logger('info', `'${username}' left.`);
        const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username, reason: 'voluntary' } };
        this.broadcastServerMessage(leaveMessage);
        delete this.users[username];
        this.emit('leave', username, 'voluntary');
        close(); // TODO: do we really need to close the connection on a leave?
        this.connections[connectionId].username = undefined;
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
          const message: UserUnlinkedMessage | UserLinkedMessage = {
            type: connectionId === undefined ? 'user/unlinked' : 'user/linked',
            payload: { username: otherUsername },
          };
          send(message);
        });
        // If this is a new joiner, also emit for the new joiner
        if (isJoin) {
          this.broadcastServerMessage({ type: 'user/join', payload: { username } });
          this.emit('join', username);
        } else {
          this.broadcastServerMessage({ type: 'user/linked', payload: { username } });
        }
        // Emit link event
        this.emit('link', username);
      };
      if (this.users[message.payload.username] === undefined) {
        let rejectedReason: undefined | string;
        this.emit('accept', message.payload.username, (reason: string) => {
          rejectedReason = reason;
        });
        if (rejectedReason !== undefined) {
          const rejectedMessage: UserRejectedMessage = {
            type: 'user/rejected',
            payload: { reason: rejectedReason },
          };
          this.logger('info', `'${message.payload.username}' rejected from `
            + `connection '${connectionId}', since the ${rejectedMessage.payload.reason}.`);
          send(rejectedMessage);
        } else {
          this.connections[connectionId].username = message.payload.username;
          this.users[message.payload.username] = { connectionId };
          this.logger('info', `'${message.payload.username}' joined from connection '${connectionId}'.`);
          sendWelcomeMessages(true, message.payload.username);
        }
      } else if (this.users[message.payload.username].connectionId === undefined) {
        this.connections[connectionId].username = message.payload.username;
        this.users[message.payload.username].connectionId = connectionId;
        this.logger('info', `'${message.payload.username}' reconnected from connection '${connectionId}'.`);
        sendWelcomeMessages(false, message.payload.username);
      } else {
        const rejectedMessage: UserRejectedMessage = {
          type: 'user/rejected',
          payload: { reason: `username ${message.payload.username} is already taken` },
        };
        this.logger('info', `'${message.payload.username}' rejected from `
          + `connection '${connectionId}', since the ${rejectedMessage.payload.reason}.`);
        send(rejectedMessage);
      }
    // Early leaver: has no username && trying to leave
    } else if (username === undefined && message.type === 'user/leave') {
      this.logger('debug', `connection '${connectionId}' is voluntarily leaving before being accepted.`);
      close(); // TODO: do we really need to close the connection on a leave?
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
  private onConnectionClosed(connectionId: string): void {
    const username = this.connections[connectionId].username;
    delete this.connections[connectionId];
    if (username === undefined) {
      this.logger('debug', `connection '${connectionId}' closed.`);
    } else {
      this.users[username].connectionId = undefined;
      try {
        this.broadcastServerMessage({ type: 'user/unlinked', payload: { username } });
      } catch (e) {
        this.logger('debug', `broadcasting failed while '${username}' disconnected, due too ${e}.`);
      }
      this.logger('info', `'${username}' disconnected.`);
      this.emit('unlink', username);
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
   * Get the metadata that should be sent along with every message.
   *
   * @param isBroadcast Whether this message is a broadcast to all users.
   */
  private getMetadata(isBroadcast: boolean) {
    return this.metadata ? {
      metadata: {
        isBroadcast,
        timestamp: DateTime.now().toUTC().toISO(),
      },
    } : undefined;
  }

  /**
   * Broadcasts a server message to all users. (alias for KarmanServer.broadcast())
   */
  private broadcastServerMessage(message: KarmanServerMessage, skipUsername?: string): number {
    return this.broadcast(message as TMessage, skipUsername);
  }

  /**
   * Broadcasts a message to all users, that are currently connected to the server.
   *
   * @param message The message to send to all the users.
   * @param skipUsername (optional) The username of the user you want to skip sending this message to.
   *
   * @returns Returns the number of users this message is sent to.
   */
  public broadcast(message: TMessage, skipUsername?: string): number {
    if (this.state !== 'running') {
      throw new Error('Cannot broadcast a message if the server is not running.');
    }
    const data = JSON.stringify({ ...message, ...this.getMetadata(true) });
    return Object.entries(this.users)
      .filter(([username, { connectionId }]) => skipUsername !== username && connectionId !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map(([, { connectionId }]) => this.connections[connectionId!])
      .filter(connection => connection.socket.readyState === ws.WebSocket.OPEN)
      .map(connection => connection.socket.send(data))
      .length;
  }

  /**
   * Sends a message to a specific user, if it is currently connected to the server.
   *
   * @param username The username of the user to send the message to.
   * @param message The message to send to the user.
   *
   * @returns Returns whether the message is sent to the user. This is false if the user is not connected to the server.
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
      this.logger('warn', `can not send message to '${username}' as that user is not linked to a connection.`);
      return false;
    }
    const connection = this.connections[connectionId];
    /* istanbul ignore if */
    if (connection.socket.readyState !== ws.WebSocket.OPEN) {
      throw new Error(`Can not send message to '${username}' as the connection '${connection}' its using is '${connection.socket.readyState}'`);
    }
    const data = JSON.stringify({ ...message, ...this.getMetadata(false) });
    connection.socket.send(data);
    return true;
  }

  /**
   * Kick a user from the server.
   *
   * @param username The username of the user to kick from the server.
   */
  public kick(username: string): void {
    if (this.state !== 'running') {
      throw new Error('Cannot kick a user if the server is not running.');
    }
    const user = this.users[username];
    if (user === undefined) {
      throw new Error(`Can not kick '${username}' as there is no user with that username.`);
    }

    this.logger('info', `'${username}' kicked.`);
    const leaveMessage: UserLeaveMessage = { type: 'user/leave', payload: { username, reason: 'kicked' } };
    this.broadcastServerMessage(leaveMessage);
    delete this.users[username];
    this.emit('leave', username, 'kicked');
    const { connectionId } = user;
    if (connectionId !== undefined) {
      this.connections[connectionId].username = undefined;
      if (this.connections[connectionId].socket.readyState === ws.WebSocket.OPEN) {
        this.connections[connectionId].socket.close(); // TODO: do we really need to close the connection on a leave?
      }
    }
  }
}

