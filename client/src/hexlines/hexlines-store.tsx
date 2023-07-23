import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Owner {
  player: string;
  score: number;
  color: string;
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
}

export const hexlinesSlice = createSlice({
  name: 'hexlines',
  initialState: {
    self: '',
    owners: {} as { [player: string]: Owner },
    tiles: {} as { [tileId: string]: Tile },
  },
  reducers: {
    reset: (state, action: PayloadAction<{ self: string }>) => {
      state.self = action.payload.self;
      state.owners = {};
      state.tiles = {};
    },
    owner: (state, action: PayloadAction<Owner>) => {
      state.owners[action.payload.player] = action.payload;
    },
    tile: (state, action: PayloadAction<Tile>) => {
      state.tiles[action.payload.id] = action.payload;
    },
  },
});
