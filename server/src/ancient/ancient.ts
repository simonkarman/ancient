import { Server } from '@krmx/server';
import { Game } from '../game';
import { AxialCoordinate } from '../utils/AxialCoordinate';

interface Tile {
  id: string;
  coord: AxialCoordinate;
}

export const ancient = (game: Game, server: Server) => {
  const tiles: { [id: string]: Tile } = {};

  const moveTileTo = (tileId: string, coord: AxialCoordinate) => {
    const tile = tiles[tileId];
    if (tile === undefined) {
      throw new Error(`tile ${tileId} not found`);
    }
    tile.coord = coord;
    server.broadcast({ type: 'ancient/tile-moved', payload: { id: tile.id, coord: coord.toString() } });
  };

  let numberOfSpawnedTiles = 0;
  const spawnTile = (coord: AxialCoordinate): Tile => {
    const tile: Tile = {
      id: `t-${numberOfSpawnedTiles}`,
      coord,
    };
    tiles[tile.id] = tile;
    server.broadcast({ type: 'ancient/tile-spawned', payload: {
      id: tile.id,
      coord: tile.coord.toString(),
    } });
    numberOfSpawnedTiles += 1;
    setInterval(() => {
      const direction = AxialCoordinate.Directions[Math.floor(Math.random() * AxialCoordinate.Directions.length)];
      if (Math.random() < 0.5) {
        moveTileTo(tile.id, tile.coord.add(direction));
      }
    }, 1500);
    return tile;
  };

  game.on('started', (players) => {
    console.info(`[info] [ancient] starting game for ${players.length} players`);
    for (let i = 0; i < 36; i++) {
      spawnTile(AxialCoordinate.Zero);
    }
  });

  game.on('relinked', (player) => {
    Object.entries(tiles).forEach(([, tile]) => {
      server.send(player, { type: 'ancient/tile-spawned', payload: {
        id: tile.id,
        coord: tile.coord.toString(),
      } });
    });
  });

  game.on('message', (player, message) => {
    console.debug(`[info] [ancient] ${player} sent ${message.type}`);
    if (message.type === 'ancient/restart') {
      Object.keys(tiles).map(tileId => moveTileTo(tileId, AxialCoordinate.Zero));
    }
  });
};
