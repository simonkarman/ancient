import { createServer, LogSeverity } from '@krmx/server';
import { cards } from './cards';
import { createGame } from './game';
import { commands, monitorUsers } from './monitor';

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

const game = createGame(server, {
  log: true,
  minPlayers: 2,
  maxPlayers: 4,
});
cards(game, server);

server.listen(8082);
