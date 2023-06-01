import { KarmanServer } from './karman-server';

type IncreaseCounterMessage = { type: 'counter/increase' };
type SetCounterMessage = { type: 'counter/set', payload: { counter: { [username: string] : number } } };
type AncientMessage = IncreaseCounterMessage | SetCounterMessage;

const counter: { [username: string] : number } = {};
const server = new KarmanServer<AncientMessage>({
  metadata: true,
});

server.on('accept', (username: string, reject: (reason: string) => void) => {
  if (username.length < 3) {
    reject('username is too short');
    return;
  }
  if (username.length > 10) {
    reject('username is too long');
    return;
  }
  if (server.getUsers().length > 2) {
    reject('server is full');
    return;
  }
});

server.on('join', (username: string) => {
  counter[username] = 0;

  server.broadcast({ type: 'counter/set', payload: { counter } });
  if (username.startsWith('kick:')) {
    server.kick(username.substring(5));
  }
});

// TODO: make clear that these connect and disconnect have nothing to do with the actual WebSocket connection
server.on('connect', (username: string) => {
  server.send(username, { type: 'counter/set', payload: { counter } });
});

// TODO: write test that disconnect is not called when someone leaves or is kicked
server.on('disconnect', (username: string) => {
  counter[username] += 10;
  server.broadcast({ type: 'counter/set', payload: { counter } });
});

server.on('leave', (username: string) => {
  delete counter[username];
  server.broadcast({ type: 'counter/set', payload: { counter } });
});

server.on('message', (username: string, message: AncientMessage) => {
  switch (message?.type) {
  case 'counter/increase':
    counter[username] += 1;
    server.broadcast({ type: 'counter/set', payload: { counter } });
    break;
  default:
    console.error(`[error] [ancient] received '${message.type}' message from ${username} which is a noop.`);
    return;
  }
});

// TODO: allow to add a user to the server (that is disconnected)
server.start(8082);
