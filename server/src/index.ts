import { monitorUsers } from './server/debug';
import { LogSeverity, createServer } from './server';

const server = createServer({
  logger: ((severity: LogSeverity, ...args: unknown[]) => {
    console[severity](`[${severity}] [server]`, ...args);
  }),
  metadata: true,
});
monitorUsers(server);

server.on('listen', () => {
  server.join('simon');
});

server.on('authenticate', (username, isNewUser, reject) => {
  if (isNewUser && server.getUsers().length >= 2) {
    reject('server is full');
  }
});

server.on('message', (username, message) => {
  console.debug(`[debug] [ancient] ${username} sent ${message.type}`);
});

server.listen(8082);

