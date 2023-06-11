import { monitorUsers } from './debug';
import { createServer, LogSeverity } from '@krmx/server';

const server = createServer({
  http: { path: 'game', queryParams: { ancient: true, version: '0.0.1' } },
  logger: ((severity: LogSeverity, ...args: unknown[]) => {
    console[severity](`[${severity}] [server]`, ...args);
  }),
  isValidUsername: (username: string) => username.toLowerCase() === username, // TODO: should this be the default in Krmx?
});
monitorUsers(server);

server.on('authenticate', (username, isNewUser, reject) => {
  // TODO: you shouldn't verify username here (as that is part of isValidUsername too support server side joins), so do you really need it here?
  if (isNewUser && server.getUsers().length > 4) {
    reject('server is full');
  }
});

server.on('message', (username, message) => {
  console.debug(`[debug] [ancient] ${username} sent ${message.type}`);
});

server.listen(8082);
