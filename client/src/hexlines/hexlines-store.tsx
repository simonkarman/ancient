import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Owner {
  player: string;
  score: number;
  color: string;
  currentLocation?: {
    tileId: string;
    anchorId: number;
  }
}

export interface Line {
  fromAnchorId: number;
  toAnchorId: number;
  owner?: string;
}

interface Tile {
  id: string;
  location: string;
  lines: Line[];
  isEdge: boolean;
  debug: string;
}

export const hexlinesSlice = createSlice({
  name: 'hexlines',
  initialState: {
    self: '',
    owners: {} as { [player: string]: Owner },
    tiles: {} as { [tileId: string]: Tile },
    turn: '',
  },
  reducers: {
    reset: (state, action: PayloadAction<{ self: string }>) => {
      state.self = action.payload.self;
      state.owners = {};
      state.tiles = {};
      state.turn = '';
    },
    owner: (state, action: PayloadAction<Owner>) => {
      state.owners[action.payload.player] = action.payload;
    },
    tile: (state, action: PayloadAction<Tile>) => {
      state.tiles[action.payload.id] = action.payload;
    },
    'owner-location-updated': (state, action: PayloadAction<Pick<Owner, 'player' | 'currentLocation'>>) => {
      state.owners[action.payload.player].currentLocation = action.payload.currentLocation;
    },
    score: (state, action: PayloadAction<{ owner: string }>) => {
      state.owners[action.payload.owner].score += 1;
    },
    'line-owner-updated': (state, action: PayloadAction<{ owner: string, tileId: string, lineIndex: number }>) => {
      state.tiles[action.payload.tileId].lines[action.payload.lineIndex].owner = action.payload.owner;
    },
    turn: (state, action: PayloadAction<{ owner: string }>) => {
      state.turn = action.payload.owner;
    },
  },
});
