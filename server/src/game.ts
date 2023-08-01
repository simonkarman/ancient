import { Message, Server } from '@krmx/server';

export type GameEvents = {
  started: [players: string[]];
  paused: [];
  relinked: [player: string];
  resumed: [];
  abandoned: [];
  completed: [];
  message: [player: string, message: Message];
  tick: [totalElapsedMs: number];
};
export const createGame = (
  server: Server,
  props: {
    log: boolean,
    name: string,
    maxPlayers: number,
    minPlayers: number,
    tickMs: number,
  },
) => server.pipe<GameEvents>(pipe => {
  const log = (...args: unknown[]) => {
    props.log && console.info('[info] [game]', ...args);
  };
  // TODO: add completed
  let state: 'lobby' | 'playing' | 'paused' | 'abandoned' = 'lobby';
  const players: { [username: string]: { isReady: boolean } } = {};
  const getAllPlayers = () => Object.entries(players).map(([username, player]) => ({ ...player, username }));

  let totalElapsedMs = 0;
  let tickId: NodeJS.Timer | undefined = undefined;

  const abandon = (): void => {
    if (state !== 'abandoned') {
      clearInterval(tickId);
      state = 'abandoned';
      log('game was abandoned');
      server.broadcast({ type: 'game/abandoned' });
      pipe.emit('abandoned');
    }
  };

  const unreadyAllPlayers = () => {
    Object.entries(players).forEach(([username, player]) => {
      if (player.isReady) {
        player.isReady = false;
        server.broadcast({ type: 'game/unready-upped', payload: { username } });
      }
    });
  };

  pipe.on('authenticate', (username, isNewUser, reject) => {
    if (state === 'abandoned') {
      reject('game was abandoned');
    } else if (isNewUser) {
      if (state !== 'lobby') {
        reject('game has already started');
      } else if (server.getUsers().length >= props.maxPlayers) {
        reject('server is full');
      }
    }
  });
  pipe.on('join', (username: string) => {
    players[username] = { isReady: false };
    unreadyAllPlayers();
  });
  pipe.on('link', (username) => {
    server.send(username, { type: 'game/config', payload: {
      name: props.name,
      minPlayers: props.minPlayers,
      maxPlayers: props.maxPlayers,
    } });
    getAllPlayers().filter(player => player.isReady).forEach(player => {
      server.send(username, { type: 'game/ready-upped', payload: { username: player.username } });
    });
    if (state === 'paused') {
      players[username].isReady = true;
      server.broadcast({ type: 'game/ready-upped', payload: { username } });
      server.send(username, { type: 'game/paused' });
      pipe.emit('relinked', username);
      if (getAllPlayers().every(player => player.isReady)) {
        state = 'playing';
        log('game has resumed');
        server.broadcast({ type: 'game/resumed' });
        pipe.emit('resumed');
      }
    }
  });
  pipe.on('unlink', (username: string) => {
    if (state === 'lobby') {
      players[username].isReady = false;
    } else if (state !== 'abandoned') {
      players[username].isReady = false;
      if (state !== 'paused') {
        state = 'paused';
        log('game has paused');
        server.broadcast({ type: 'game/paused' });
        pipe.emit('paused');
      }
    }
  });
  pipe.on('leave', (username: string) => {
    if (state === 'lobby') {
      delete players[username];
      unreadyAllPlayers();
    } else {
      players[username].isReady = false;
      abandon();
    }
  });
  pipe.on('message', (username, message) => {
    if (state === 'lobby') {
      if (message.type === 'game/ready-up' && !players[username].isReady) {
        players[username].isReady = true;
        server.broadcast({ type: 'game/ready-upped', payload: { username } });
        const allPlayers = getAllPlayers();
        if (allPlayers.length >= props.minPlayers && allPlayers.every(player => player.isReady)) {
          state = 'playing';
          log('game has started');
          server.broadcast({ type: 'game/started' });
          pipe.emit('started', allPlayers.map(player => player.username));
          tickId = setInterval(() => {
            if (state === 'playing') {
              totalElapsedMs += props.tickMs;
              pipe.emit('tick', totalElapsedMs);
            }
          }, props.tickMs);
        }
      }
      if (message.type === 'game/unready-up' && players[username].isReady) {
        players[username].isReady = false;
        server.broadcast({ type: 'game/unready-upped', payload: { username } });
      }
    }
    if (!message.type.startsWith('game/') && state === 'playing') {
      pipe.emit('message', username, message);
    }
  });
});
export type Game = ReturnType<typeof createGame>;
