import { KarmanServer } from './karman-server';

type IncreaseCounterMessage = { type: 'counter/increase' };
type SetCounterMessage = { type: 'counter/set', payload: { counter: { [username: string] : number } } };
type AncientMessage = IncreaseCounterMessage | SetCounterMessage;

const counter: { [username: string] : number } = {};
const server = new KarmanServer<AncientMessage>();
server.on('join', (username: string) => {
  counter[username] = 0;
  server.broadcast({ type: 'counter/set', payload: { counter } });
});
server.on('leave', (username: string) => {
  delete counter[username];
  server.broadcast({ type: 'counter/set', payload: { counter } });
});
server.on('welcome', (_, addMessage) => {
  addMessage({ type: 'counter/set', payload: { counter } });
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
server.start(8082);
