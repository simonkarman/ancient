import { monitorUsers } from './debug';
import { createServer, LogSeverity } from 'karmax';

const server = createServer({
  http: { path: 'game', queryParams: { ancient: true, version: '0.0.1' } },
  logger: ((severity: LogSeverity, ...args: unknown[]) => {
    console[severity](`[${severity}] [server]`, ...args);
  }),
});
monitorUsers(server);

server.on('authenticate', (username, isNewUser, reject) => {
  if (username.toLowerCase() !== username) {
    reject('username should be only lowercase'); // TODO: should this be part of karmax?
  } else if (isNewUser && server.getUsers().length > 4) {
    reject('server is full');
  }
});

server.on('message', (username, message) => {
  console.debug(`[debug] [ancient] ${username} sent ${message.type}`);
});

server.listen(8082);
