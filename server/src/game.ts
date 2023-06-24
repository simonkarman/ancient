import { Message, Server } from '@krmx/server';

export type GameEvents = {
  started: [players: string[]];
  paused: [];
  relinked: [player: string];
  resumed: [];
  finished: [];
  message: [player: string, message: Message];
};
export const createGame = (
  server: Server,
  props: {
    log: boolean,
    maxPlayers: number,
    minPlayers: number,
  },
) => server.pipe<GameEvents>(pipe => {
  const log = (...args: unknown[]) => {
    props.log && console.info('[info] [game]', ...args);
  };
  let phase: 'lobby' | 'playing' | 'paused' | 'finished' = 'lobby';
  const players: { [username: string]: { isReady: boolean } } = {};
  const getAllPlayers = () => Object.entries(players).map(([username, player]) => ({ ...player, username }));

  const finish = (): void => {
    if (phase !== 'finished') {
      phase = 'finished';
      log('game has finished');
      server.broadcast({ type: 'game/finished' });
      pipe.emit('finished');
    }
  };

  pipe.on('authenticate', (username, isNewUser, reject) => {
    if (phase === 'finished') {
      reject('game has finished');
    } else if (isNewUser) {
      if (phase !== 'lobby') {
        reject('game has already started');
      } else if (server.getUsers().length >= props.maxPlayers) {
        reject('server is full');
      }
    }
  });
  pipe.on('join', (username: string) => {
    players[username] = { isReady: false };
  });
  pipe.on('link', (username) => {
    getAllPlayers().filter(player => player.isReady).forEach(player => {
      server.send(username, { type: 'game/ready-upped', payload: { username: player.username } });
    });
    if (phase === 'paused') {
      players[username].isReady = true;
      server.broadcast({ type: 'game/ready-upped', payload: { username } });
      server.send(username, { type: 'game/paused' });
      pipe.emit('relinked', username);
      if (getAllPlayers().every(player => player.isReady)) {
        phase = 'playing';
        log('game has resumed');
        server.broadcast({ type: 'game/resumed' });
        pipe.emit('resumed');
      }
    }
  });
  pipe.on('unlink', (username: string) => {
    if (phase === 'lobby') {
      players[username].isReady = false;
    } else if (phase !== 'finished') {
      players[username].isReady = false;
      if (phase !== 'paused') {
        phase = 'paused';
        log('game has paused');
        server.broadcast({ type: 'game/paused' });
        pipe.emit('paused');
      }
    }
  });
  pipe.on('leave', (username: string) => {
    if (phase === 'lobby') {
      delete players[username];
    } else {
      players[username].isReady = false;
      finish();
    }
  });
  pipe.on('message', (username, message) => {
    if (phase === 'lobby' && message.type === 'game/ready-up') {
      if (!players[username].isReady) {
        players[username].isReady = true;
        server.broadcast({ type: 'game/ready-upped', payload: { username } });
        const allPlayers = getAllPlayers();
        if (allPlayers.length >= props.minPlayers && allPlayers.every(player => player.isReady)) {
          phase = 'playing';
          log('game has started');
          server.broadcast({ type: 'game/started' });
          pipe.emit('started', allPlayers.map(player => player.username));
        }
      }
    }
    if (!message.type.startsWith('game/') && phase === 'playing') {
      pipe.emit('message', username, message);
    }
  });
});
export type Game = ReturnType<typeof createGame>;
