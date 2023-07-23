/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Server } from '@krmx/server';
import { Game } from '../game';
import { AxialCoordinate } from '../utils/AxialCoordinate';

const colors = [
  '#9FE2BF',
  '#FF7F50',
  '#DE3163',
  '#6495ED',
  '#40E0D0',
  '#CCCCFF',
];

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
  currentLocation?: {
    tileId: string;
    anchorId: number;
  }
}

export const hexlines = (game: Game, server: Server) => {
  const owners: Owner[] = [];
  const tiles: Tile[] = [];
  let turn = 0;

  const getNextTargetLocation = (currentLocation: Required<Owner>['currentLocation']): AxialCoordinate => {
    const fromTile = tiles.find(tile => tile.id === currentLocation.tileId)!;
    return fromTile.location.add(AxialCoordinate.Directions[Math.floor(currentLocation.anchorId / 2)]);
  };

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
  function spawnTile(location: AxialCoordinate, owner?: string): Tile {
    const anchorIdPool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (let i = anchorIdPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = anchorIdPool[i];
      anchorIdPool[i] = anchorIdPool[j];
      anchorIdPool[j] = temp;
    }

    const lines: Line[] = [];
    if (owner === undefined) {
      // TODO: ensure first 6 anchorIds are on different sides
      anchorIdPool.forEach(anchorId => {
        lines.push({
          fromAnchorId: anchorId,
          toAnchorId: anchorId,
        });
      });
    } else {
      while (anchorIdPool.length > 0) {
        lines.push({
          fromAnchorId: anchorIdPool.pop() || 0,
          toAnchorId: anchorIdPool.pop() || 0,
        });
      }
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
    if (owner === undefined) {
      owners.forEach((owner, lineIndex) => {
        tile.lines[lineIndex].owner = owner.player;
        owner.currentLocation = {
          tileId: tile.id,
          anchorId: tile.lines[lineIndex].toAnchorId,
        };
        server.broadcast({ type: 'hexlines/line-owner-updated', payload: {
          owner: owner.player,
          tileId: tile.id,
          lineIndex,
        } });
        server.broadcast({
          type: 'hexlines/owner-location-updated',
          payload: {
            player: owner.player,
            currentLocation: owner.currentLocation,
          },
        });
      });
    }
    // TODO: start with owner of tile, then loop through owners in same order
    owners.forEach(owner => {
      const getNext = (currentLocation: Owner['currentLocation']): { tile: Tile, anchorId: number } | undefined => {
        if (currentLocation === undefined) {
          return undefined;
        }
        const targetLocation = getNextTargetLocation(currentLocation);
        const nextTile = tiles.find(tile => tile.location.approximatelyEqual(targetLocation));
        if (nextTile === undefined) {
          return undefined;
        }
        return {
          tile: nextTile,
          anchorId: [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4][currentLocation.anchorId],
        };
      };
      const finishOwner = (player: string) => {
        const owner = owners.find(owner => owner.player === player)!;
        owner.currentLocation = undefined;
        server.broadcast({
          type: 'hexlines/owner-location-updated',
          payload: {
            player: owner.player,
            currentLocation: owner.currentLocation,
          },
        });
        // TODO: if all owners are now finished, game ends
      };
      let next = getNext(owner.currentLocation);
      while (next !== undefined) {
        const nextLineIndex = next.tile.lines.findIndex(line => line.toAnchorId === next?.anchorId || line.fromAnchorId === next?.anchorId)!;
        const nextLine = next.tile.lines[nextLineIndex];
        if (nextLine.owner === undefined) {
          // Update owner of line
          nextLine.owner = owner.player;
          server.broadcast({ type: 'hexlines/line-owner-updated', payload: { owner: owner.player, tileId: next.tile.id, lineIndex: nextLineIndex } });
          // Add score
          owner.score += 1;
          server.broadcast({ type: 'hexlines/score', payload: { owner: owner.player } });
          // Update location of owner
          owner.currentLocation = {
            tileId: next.tile.id,
            anchorId: nextLine.fromAnchorId === next.anchorId ? nextLine.toAnchorId : nextLine.fromAnchorId,
          };
          server.broadcast({
            type: 'hexlines/owner-location-updated',
            payload: {
              player: owner.player,
              currentLocation: owner.currentLocation,
            },
          });
          // Check if moved to start
          if (next.tile.location.approximatelyEqual(AxialCoordinate.Zero)) {
            finishOwner(owner.player);
          }
        } else {
          finishOwner(owner.player);
          finishOwner(nextLine.owner);
        }
        next = getNext(owner.currentLocation);
      }
    });
    return tile;
  }

  game.on('started', (players) => {
    console.info(`[info] [hexlines] starting game for ${players.length} players`);
    // TODO: randomize order
    players.forEach(addOwner);
    spawnTile(AxialCoordinate.Zero);
    const intervalId = setInterval(() => {
      let current = owners[turn];
      turn = (turn + 1) % owners.length;
      let deadPlayerCount = 0;
      while (current.currentLocation === undefined) {
        turn = (turn + 1) % owners.length;
        current = owners[turn];
        deadPlayerCount += 1;
        if (deadPlayerCount >= players.length) {
          clearInterval(intervalId);
          return;
        }
      }
      server.broadcast({ type: 'hexlines/turn', payload: { owner: current.player } });
      const next = getNextTargetLocation(current.currentLocation);
      spawnTile(next, current.player);
    }, 750);
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
