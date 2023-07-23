import { Server } from '@krmx/server';
import { Game } from '../game';

export const hexlines = (game: Game, server: Server) => {
  game.on('started', (players) => {
    console.info(`[info] [hexlines] starting game for ${players.length} players`);
  });

  game.on('message', (player, message) => {
    console.debug(`[info] [hexlines] ${player} sent ${message.type}`);
  });
};
