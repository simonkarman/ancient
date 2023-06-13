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
