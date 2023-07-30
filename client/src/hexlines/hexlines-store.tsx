import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Location = {
  tileId: string;
  anchorId: number;
};

interface Owner {
  name: string;
  score: number;
  color: string;
  location?: Location
}

export interface Line {
  fromAnchorId: number;
  toAnchorId: number;
  ownerName?: string;
}

interface Tile {
  id: string;
  location: string;
  lines: Line[];
  isEdge: boolean;
  debug: string;
}

interface Turn {
  ownerName: string;
  location: string;
  lines: Line[];
  rotation: number;
}

export const hexlinesSlice = createSlice({
  name: 'hexlines',
  initialState: {
    self: '',
    owners: {} as { [player: string]: Owner },
    tiles: {} as { [tileId: string]: Tile },
    turn: undefined as (Turn | undefined),
  },
  reducers: {
    reset: (state, action: PayloadAction<{ self: string }>) => {
      state.self = action.payload.self;
      state.owners = {};
      state.tiles = {};
      state.turn = undefined;
    },
    started: (state, action: PayloadAction<Owner[]>) => {
      for (let i = 0; i < action.payload.length; i++) {
        const owner = action.payload[i];
        state.owners[owner.name] = owner;
      }
    },
    tileSpawned: (state, action: PayloadAction<Tile>) => {
      state.tiles[action.payload.id] = action.payload;
    },
    tileLineOwnerUpdated: (state, action: PayloadAction<{ tileId: string, lineIndex: number, ownerName: string }>) => {
      state.tiles[action.payload.tileId].lines[action.payload.lineIndex].ownerName = action.payload.ownerName;
    },
    ownerLocationUpdated: (state, action: PayloadAction<{ ownerName: string, location: Location }>) => {
      state.owners[action.payload.ownerName].location = action.payload.location;
    },
    ownerScoreUpdated: (state, action: PayloadAction<{ ownerName: string, score: number }>) => {
      state.owners[action.payload.ownerName].score = action.payload.score;
    },
    turn: (state, action: PayloadAction<Turn | undefined>) => {
      state.turn = action.payload;
    },
    turnRotation: (state, action: PayloadAction<number>) => {
      if (state.turn !== undefined) {
        state.turn.rotation = action.payload;
      }
    },
  },
});
