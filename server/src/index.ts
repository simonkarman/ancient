import { KarmanServer } from './karman-server';

type IncreaseCounterMessage = { type: 'counter/increase' };
type SetCounterMessage = { type: 'counter/set', payload: { value: number } };
type AncientMessage = IncreaseCounterMessage | SetCounterMessage;

let counter = 0;
const karmanServer = new KarmanServer<AncientMessage>({
  onUserMessage: (username: string, message: AncientMessage) => {
    switch (message?.type) {
    case 'counter/increase':
      counter += 1;
      karmanServer.broadcast({ type: 'counter/set', payload: { value: counter } });
      break;
    default:
      console.error(`[ancient] received noop message: ${message.type} from ${username}`);
      return;
    }
  },
  getExistingInformationMessages: () => [{ type: 'counter/set', payload: { value: counter } }],
});
karmanServer.start();
