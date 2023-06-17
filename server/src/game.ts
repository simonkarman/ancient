import { Message, Server } from '@krmx/server';

export const game = (
  server: Server,
  props: {
    log: boolean,
    maxPlayers: number,
    minPlayers: number,
    onStart?: (players: string[]) => void,
    onPause?: () => void,
    onResume?: () => void,
    onFinished?: () => void,
    onMessage?: (username:string, message: Message) => void,
  },
): { finish: () => void } => {
  const log = (...args: unknown[]) => {
    props.log && console.info('[info] [game]', ...args);
  };
  let phase: 'lobby' | 'playing' | 'paused' | 'finished' = 'lobby';
  const players: { [username: string]: { isReady: boolean } } = {};
  const getAllPlayers = () => Object.entries(players).map(([username, player]) => ({ ...player, username }));

  server.on('authenticate', (username, isNewUser, reject) => {
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
  server.on('join', (username: string) => {
    players[username] = { isReady: false };
  });
  server.on('link', (username) => {
    getAllPlayers().filter(player => player.isReady).forEach(player => {
      server.send(username, { type: 'game/ready-upped', payload: { username: player.username } });
    });
    if (phase === 'paused') {
      players[username].isReady = true;
      server.broadcast({ type: 'game/ready-upped', payload: { username } });
      server.send(username, { type: 'game/paused' });
      if (getAllPlayers().every(player => player.isReady)) {
        phase = 'playing';
        log('game has resumed');
        server.broadcast({ type: 'game/resumed' });
        props.onResume && props.onResume();
      }
    }
  });
  server.on('unlink', (username: string) => {
    if (phase === 'lobby') {
      players[username].isReady = false;
    } else if (phase !== 'finished') {
      players[username].isReady = false;
      if (phase !== 'paused') {
        phase = 'paused';
        log('game has paused');
        server.broadcast({ type: 'game/paused' });
        props.onPause && props.onPause();
      }
    }
  });
  const finish = (): void => {
    if (phase !== 'finished') {
      phase = 'finished';
      log('game has finished');
      server.broadcast({ type: 'game/finished' });
      props.onFinished && props.onFinished();
    }
  };
  server.on('leave', (username: string) => {
    if (phase === 'lobby') {
      delete players[username];
    } else {
      players[username].isReady = false;
      finish();
    }
  });
  server.on('message', (username, message) => {
    if (phase === 'lobby' && message.type === 'game/ready-up') {
      if (!players[username].isReady) {
        players[username].isReady = true;
        server.broadcast({ type: 'game/ready-upped', payload: { username } });
        const allPlayers = getAllPlayers();
        if (allPlayers.length >= props.minPlayers && allPlayers.every(player => player.isReady)) {
          phase = 'playing';
          log('game has started');
          server.broadcast({ type: 'game/started' });
          props.onStart && props.onStart(allPlayers.map(player => player.username));
        }
      }
    }
    if (!message.type.startsWith('game/') && phase === 'playing') {
      props.onMessage && props.onMessage(username, message);
    }
  });
  return { finish };
};
