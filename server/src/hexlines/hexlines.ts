import { Server } from '@krmx/server';
import { Game } from '../game';
import { AxialCoordinate } from '../utils/AxialCoordinate';
import { HexDirection } from '../utils/HexDirection';

const colors = ['orange', 'purple'];

interface Line {
  fromAnchorId: number;
  toAnchorId: number;
  owner?: string;
}

interface Tile {
  id: string;
  location: AxialCoordinate;
  lines: Line[];
}

interface Owner {
  player: string;
  score: number;
  color: string;
}

export const hexlines = (game: Game, server: Server) => {
  const owners: Owner[] = [];
  const tiles: Tile[] = [];

  function addOwner(player: string) {
    const owner: Owner = {
      player,
      score: 0,
      color: colors[owners.length % colors.length],
    };
    owners.push(owner);
    server.broadcast({
      type: 'hexlines/owner',
      payload: owner,
    });
  }
  function spawnTile(location: AxialCoordinate) {
    const anchorIdPool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const pop = (): number => {
      return anchorIdPool.splice(Math.floor(Math.random() * anchorIdPool.length), 1)[0];
    };
    const lines: Line[] = [];
    while (anchorIdPool.length > 0) {
      lines.push({
        fromAnchorId: pop(),
        toAnchorId: pop(),
      });
    }
    const tile: Tile = {
      id: `t-${tiles.length}`,
      location,
      lines,
    };
    tiles.push(tile);
    server.broadcast({
      type: 'hexlines/tile',
      payload: {
        ...tile,
        location: tile.location.toString(),
      },
    });
  }

  game.on('started', (players) => {
    console.info(`[info] [hexlines] starting game for ${players.length} players`);
    players.forEach(addOwner);
    spawnTile(AxialCoordinate.Zero);
    AxialCoordinate.Directions.forEach(direction => {
      spawnTile(direction);
    });
  });

  game.on('relinked', (player) => {
    owners.forEach(owner => {
      server.send(player, { type: 'hexlines/owner', payload: owner });
    });
    tiles.forEach(tile => {
      server.send(player, { type: 'hexlines/tile', payload: {
        ...tile,
        location: tile.location.toString(),
      } });
    });
  });

  game.on('message', (player, message) => {
    console.debug(`[info] [hexlines] ${player} sent ${message.type}`);
  });
};
