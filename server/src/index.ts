import { createServer as createHttpServer } from 'http';
import { createServer as createKrmxServer, EventEmitter, LogSeverity, Server } from '@krmx/server';
import express from 'express';
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
// eslint-disable-next-line no-process-env
const gameName = process.env.GAME_NAME || 'none';
const gameConfig = gameConfigs[gameName];
if (gameConfig === undefined) {
  throw new Error(`environment variable GAME_NAME is set to ${gameName} and should be set to ${Object.keys(gameConfigs).join(' or ')}`);
}

const createAncientServer = () => {
  // Create http server
  const expressServer = express();
  expressServer.get('/health', (_, res) => {
    res.send('Server is running!');
  });
  const httpServer = createHttpServer(expressServer);

  // Create krmx server
  const krmxServer = createKrmxServer({
    http: { server: httpServer, path: 'game', queryParams: { ancient: true, version: '0.0.4' } },
    logger: ((severity: LogSeverity, ...args: unknown[]) => {
      if (severity === 'warn' || severity === 'error') {
        console[severity](`[${severity}] [server]`, ...args);
      }
    }),
  });
  monitorUsers(krmxServer);
  commands(krmxServer, process.stdin);

  // Setup game
  console.info(`[info] Setting up ${gameName} game`);
  const game = createGame(krmxServer, {
    log: true,
    name: gameName,
    minPlayers: gameConfig.minPlayers,
    maxPlayers: gameConfig.maxPlayers,
    tickMs: 100,
  });
  gameConfig.setup(game, krmxServer);

  // Start server
  krmxServer.on('listen', (port) => {
    console.info('[info] server started on port', port);
  });
  krmxServer.on('close', () => {
    console.info('[info] server has closed');
    setTimeout(() => {
      createAncientServer();
    }, 1000);
  });
  expressServer.get('/restart', (_, res) => {
    console.info('[info] server restart requested');
    res.send('Server will restart shortly...');
    krmxServer.close();
  });
  krmxServer.listen(8082);
};
createAncientServer();
