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

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
game(server, {
  log: true,
  minPlayers: 2,
  maxPlayers: 4,
  onStart: noop,
  onPause: noop,
  onResume: noop,
  onFinished: noop,
});

server.listen(8082);
