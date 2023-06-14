import { game } from './game';
import { monitorUsers } from './monitor';
import { createServer, LogSeverity } from '@krmx/server';

export const server = createServer({
  http: { path: 'game', queryParams: { ancient: true, version: '0.0.2' } },
  logger: ((severity: LogSeverity, ...args: unknown[]) => {
    if (severity === 'warn' || severity === 'error') {
      console[severity](`[${severity}] [server]`, ...args);
    }
  }),
});
monitorUsers(server);
server.on('message', (username, message) => {
  console.debug(`[debug] [ancient] ${username} sent ${message.type}`);
});

game(server, {
  log: true,
  minPlayers: 2,
  maxPlayers: 4,
});

server.listen(8082);
