import { Server } from '@krmx/server';

export const monitorUsers = (server: Server) => {
  let counter = 0;
  const printUsers = () => {
    counter += 1;
    const count = counter;
    setTimeout(() => {
      if (count !== counter) {
        return;
      }
      const users = server.getUsers();
      const userInfo = users.map(({ username, isLinked }) => `${isLinked ? '🟢' : '🔴'} ${username}`);
      console.info('[info] [monitor]', users.length, 'user(s):', userInfo);
    }, 20);
  };
  server.on('join', printUsers);
  server.on('link', printUsers);
  server.on('unlink', printUsers);
  server.on('leave', printUsers);
};

export const commands = (server: Server, from: NodeJS.ReadStream) => {
  from.on('data', data => {
    const words = data.toString().trim().replace('\r\n', '').split(' ');
    try {
      if (words[0] === 'kick' && words.length === 2) {
        server.kick(words[1]);
      } else if (words[0] === 'join' && words.length === 2) {
        server.join(words[1]);
      } else if (words[0] === 'unlink' && words.length === 2) {
        server.unlink(words[1]);
      } else if (words[0] === 'status' && words.length === 1) {
        console.info(server.getStatus());
      } else if (words[0] === 'users' && words.length === 1) {
        console.info(server.getUsers());
      } else {
        throw new Error('unknown command');
      }
    } catch (e) {
      console.error(`command '${words.join(' ')}' failed:`, e);
    }
  });
};
