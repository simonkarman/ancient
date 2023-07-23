import { createServer, EventEmitter, LogSeverity, Server } from '@krmx/server';
import { ancient } from './ancient/ancient';
import { cards } from './cards/cards';
import { createGame, GameEvents } from './game';
import { hexlines } from './hexlines/hexlines';
import { commands, monitorUsers } from './monitor';

type GameConfig = {
  minPlayers: number,
  maxPlayers: number,
  setup: (game: EventEmitter<GameEvents>, server: Server) => void
};
const gameConfigs: { [gameName: string]: GameConfig | undefined } = {
  'cards': {
    minPlayers: 2,
    maxPlayers: 8,
    setup: (game, server) => {
      cards(game, server, {
        startingHandSize: 5,
      });
    },
  },
  'ancient': {
    minPlayers: 1,
    maxPlayers: 3,
    setup: ancient,
  },
  'hexlines': {
    minPlayers: 1, // TODO: change back to 2
    maxPlayers: 6,
    setup: hexlines,
  },
};

// Create server
export const server = createServer({
  http: { path: 'game', queryParams: { ancient: true, version: '0.0.3' } },
  logger: ((severity: LogSeverity, ...args: unknown[]) => {
    if (severity === 'warn' || severity === 'error') {
      console[severity](`[${severity}] [server]`, ...args);
    }
  }),
});
monitorUsers(server);
commands(server, process.stdin);

// Setup game
// eslint-disable-next-line no-process-env
const gameName = process.env.GAME_NAME || 'none';
const gameConfig = gameConfigs[gameName];
if (gameConfig === undefined) {
  throw new Error(`environment variable GAME_NAME is set to ${gameName} and should be set to ${Object.keys(gameConfigs).join(' or ')}`);
}
console.info(`[info] Setting up ${gameName} game`);
const game = createGame(server, {
  log: true,
  name: gameName,
  minPlayers: gameConfig.minPlayers,
  maxPlayers: gameConfig.maxPlayers,
});
gameConfig.setup(game, server);

// Start server
server.on('listen', (port) => {
  console.info('[info] server started on port', port);
});
server.listen(8082);
