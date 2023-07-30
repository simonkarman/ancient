/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Server, EventGenerator } from '@krmx/server';
import { Game } from '../game';
import { AxialCoordinate } from '../utils/AxialCoordinate';
import { approximatelyEqual } from '../utils/Math';
import { Random } from '../utils/Random';

const colors = [
  '#9FE2BF',
  '#FF7F50',
  '#6495ED',
  '#DE3163',
  '#CCCCFF',
  '#40E0D0',
];

interface Line {
  fromAnchorId: number;
  toAnchorId: number;
  ownerName?: string;
}

interface Tile {
  id: string;
  location: AxialCoordinate;
  lines: Line[];
  isEdge: boolean;
  debug: string;
}

interface Location {
  tileId: string;
  anchorId: number;
}

interface Owner {
  name: string;
  score: number;
  color: string;
  location?: Location
}

type HexlinesGameEvents = {
  started: [owners: Owner[]];
  tileSpawned: [tile: Tile];
  tileLineOwnerUpdated: [tile: Tile, lineIndex: number];
  ownerLocationUpdated: [owner: Owner];
  ownerScoreUpdated: [owner: Owner];
}

class HexlinesGame extends EventGenerator<HexlinesGameEvents> {
  private owners: ReadonlyArray<Owner> = [];
  private tiles: Tile[] = [];
  private readonly random: Random;

  public getOwners(): ReadonlyArray<Readonly<Owner>> { return this.owners; }
  public getTiles(): ReadonlyArray<Readonly<Tile>> { return this.tiles; }

  constructor(seed: string) {
    super();
    this.random = new Random(seed);
  }

  public start(players: string[]) {
    // Setup owners
    this.random.shuffleArrayInPlace(players);
    const owners: Owner[] = [];
    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
      owners.push({
        name: players[playerIndex],
        score: 1,
        color: colors[playerIndex % colors.length],
      });
    }
    this.emit('started', owners);
    this.owners = owners;

    // Spawn start and edge tiles
    this.spawnStartTile();
    const edgeTileCoordinates = AxialCoordinate.circle(AxialCoordinate.Zero, this.owners.length <= 2 ? 4 : 5, true);
    for (let i = 0; i < edgeTileCoordinates.length; i++) {
      const edgeTileCoordinate = edgeTileCoordinates[i];
      this.spawnEdgeTile(edgeTileCoordinate);
    }
  }

  private spawnStartTile() {
    // For the first tile we need 12 lines, these lines connect to their own anchorId.
    // Since these are the starting positions of players, and the first 6 are used for this,
    //  no two anchors in the first 6 should be on the same side.
    const lines: Line[] = [];
    const cornerId = [0, 1, 2, 3, 4, 5];
    this.random.shuffleArrayInPlace(cornerId);
    cornerId.forEach(cornerId => {
      // The anchors are added per side at once. One on the front of the list, the other at the end.
      const unshiftLower = this.random.bool();
      lines.unshift({
        fromAnchorId: (cornerId * 2) + (unshiftLower ? 0 : 1),
        toAnchorId: (cornerId * 2) + (unshiftLower ? 0 : 1),
      });
      lines.push({
        fromAnchorId: (cornerId * 2) + (unshiftLower ? 1 : 0),
        toAnchorId: (cornerId * 2) + (unshiftLower ? 1 : 0),
      });
    });
    const tile: Tile = {
      id: `t-${this.tiles.length}`,
      location: AxialCoordinate.Zero,
      lines,
      isEdge: false,
      debug: '',
    };
    this.tiles.push(tile);
    this.emit('tileSpawned', tile);
    for (let lineIndex = 0; lineIndex < this.owners.length; lineIndex++) {
      const owner = this.owners[lineIndex];

      tile.lines[lineIndex].ownerName = owner.name;
      this.emit('tileLineOwnerUpdated', tile, lineIndex);

      owner.location = {
        tileId: tile.id,
        anchorId: tile.lines[lineIndex].toAnchorId,
      };
      this.emit('ownerLocationUpdated', owner);
    }
  }

  private spawnEdgeTile(coordinate: AxialCoordinate) {
    // Only add lines on the one or two sides that face the center
    const angle = coordinate.toPixel(1).angle();
    const fractionalSide = (((270 - angle) % 360) / 60) % 6;
    const sides = approximatelyEqual(fractionalSide, Math.round(fractionalSide))
      ? [Math.round(fractionalSide) % 6]
      : [Math.floor(fractionalSide) % 6, Math.ceil(fractionalSide) % 6];
    const tile: Tile = {
      id: `t-${this.tiles.length}`,
      location: coordinate,
      lines: sides.map(side => ({ fromAnchorId: side * 2, toAnchorId: side * 2 + 1 })),
      isEdge: true,
      debug: '',
    };
    this.tiles.push(tile);
    this.emit('tileSpawned', tile);
  }

  public spawnTile(coordinate: AxialCoordinate) {
    const lines: Line[] = [];
    const anchorIdPool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    this.random.shuffleArrayInPlace(anchorIdPool);
    while (anchorIdPool.length > 0) {
      lines.push({
        fromAnchorId: anchorIdPool.pop() || 0,
        toAnchorId: anchorIdPool.pop() || 0,
      });
    }
    const tile: Tile = {
      id: `t-${this.tiles.length}`,
      location: coordinate,
      lines,
      isEdge: false,
      debug: '',
    };
    this.tiles.push(tile);
    this.emit('tileSpawned', tile);
  }

  public getNextTargetLocation(location: Location): AxialCoordinate {
    const fromTile = this.tiles.find(tile => tile.id === location.tileId)!;
    return fromTile.location.add(AxialCoordinate.Directions[Math.floor(location.anchorId / 2)]);
  }

  private finishOwner(name: string) {
    const owner = this.owners.find(owner => owner.name === name)!;
    owner.location = undefined;
    this.emit('ownerLocationUpdated', owner);
    // TODO: if all owners are now finished, game ends
  }

  private getAnchorDual(location: Location): Location | undefined {
    const targetLocation = this.getNextTargetLocation(location);
    const dualTile = this.tiles.find(tile => tile.location.approximatelyEqual(targetLocation, 0.1));
    if (dualTile === undefined) {
      return undefined;
    }
    return {
      tileId: dualTile.id,
      anchorId: [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4][location.anchorId],
    };
  }

  public updateOwnerPaths(ownerIndexWithPriority: number) {
    for (let ownerCounter = 0; ownerCounter < this.owners.length; ownerCounter++) {
      // Start with the owner that has the highest priority, then loop in reverse order through the remaining owners
      const ownerIndex = (ownerIndexWithPriority - ownerCounter + this.owners.length) % this.owners.length;
      const owner = this.owners[ownerIndex];
      let dualLocation = owner.location === undefined ? undefined : this.getAnchorDual(owner.location);
      while (dualLocation !== undefined) {
        const dualTile = this.tiles.find(tile => tile.id === dualLocation!.tileId)!;
        const dualLineIndex = dualTile.lines
          .findIndex(line => line.toAnchorId === dualLocation?.anchorId || line.fromAnchorId === dualLocation?.anchorId)!;
        const nextLine = dualTile.lines[dualLineIndex];
        if (nextLine.ownerName === undefined) {
          // Update owner of line
          nextLine.ownerName = owner.name;
          this.emit('tileLineOwnerUpdated', dualTile, dualLineIndex);

          // Add score
          owner.score += dualTile.isEdge ? 0 : 1;
          this.emit('ownerScoreUpdated', owner);

          // Update location of owner
          owner.location = {
            tileId: dualLocation.tileId,
            anchorId: nextLine.fromAnchorId === dualLocation.anchorId ? nextLine.toAnchorId : nextLine.fromAnchorId,
          };
          this.emit('ownerLocationUpdated', owner);

          // Check if moved to start
          if (dualTile.location.approximatelyEqual(AxialCoordinate.Zero)) {
            this.finishOwner(owner.name);
          }
        } else {
          // If moved into line of another owner
          this.finishOwner(owner.name);
          this.finishOwner(nextLine.ownerName);
        }
        dualLocation = owner.location === undefined ? undefined : this.getAnchorDual(owner.location);
      }
    }
  }
}

export const hexlines = (game: Game, server: Server) => {
  let highestSecond = 0;
  let turn = -1;
  let next: AxialCoordinate | undefined = undefined;
  const hexlinesGame = new HexlinesGame('1234');

  hexlinesGame.on('started', (owners) => server.broadcast({
    type: 'hexlines/started',
    payload: owners,
  }));
  hexlinesGame.on('tileSpawned', (tile) => server.broadcast({
    type: 'hexlines/tileSpawned',
    payload: { ...tile, location: tile.location.toString() },
  }));
  hexlinesGame.on('tileLineOwnerUpdated', (tile: Tile, lineIndex: number) => server.broadcast({
    type: 'hexlines/tileLineOwnerUpdated',
    payload: { tileId: tile.id, lineIndex, ownerName: tile.lines[lineIndex].ownerName },
  }));
  hexlinesGame.on('ownerLocationUpdated', (owner) => server.broadcast({
    type: 'hexlines/ownerLocationUpdated',
    payload: { ownerName: owner.name, location: owner.location },
  }));
  hexlinesGame.on('ownerScoreUpdated', (owner) => server.broadcast({
    type: 'hexlines/ownerScoreUpdated',
    payload: { ownerName: owner.name, score: owner.score },
  }));

  game.on('started', (players) => {
    console.info(`[info] [hexlines] starting game for ${players.length} players`);
    hexlinesGame.start(players);
  });
  game.on('tick', (totalElapsedMs: number) => {
    const totalElapsedSeconds = Math.floor(totalElapsedMs / 1000);
    if (totalElapsedSeconds > highestSecond) {
      highestSecond = totalElapsedSeconds;
      const owners = hexlinesGame.getOwners();
      if (next) {
        hexlinesGame.spawnTile(next);
        hexlinesGame.updateOwnerPaths(turn);
        server.broadcast({ type: 'hexlines/turn', payload: { ownerName: undefined } });
        next = undefined;
        return;
      }
      turn = (turn + 1) % owners.length;
      let currentOwner = owners[turn];
      let deadPlayerCount = 0;
      while (currentOwner.location === undefined) {
        turn = (turn + 1) % owners.length;
        currentOwner = owners[turn];
        deadPlayerCount += 1;
        if (deadPlayerCount >= owners.length) {
          return;
        }
      }
      server.broadcast({ type: 'hexlines/turn', payload: { ownerName: currentOwner.name } });
      next = hexlinesGame.getNextTargetLocation(currentOwner.location);
    }
  });
  game.on('relinked', (player) => {
    server.send(player, {
      type: 'hexlines/started',
      payload: hexlinesGame.getOwners(),
    });
    hexlinesGame.getTiles().forEach(tile => server.send(player, {
      type: 'hexlines/tileSpawned',
      payload: { ...tile, location: tile.location.toString() },
    }));
    if (turn !== undefined) {
      const owner = hexlinesGame.getOwners()[turn];
      server.send(player, { type: 'hexlines/turn', payload: { ownerName: owner.name } });
    }
  });
  game.on('message', (player, message) => {
    console.debug(`[info] [hexlines] ${player} sent ${message.type}`);
  });
};
