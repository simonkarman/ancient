import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Tile {
  id: string;
  coord: string;
  color: string;
}

export const ancientSlice = createSlice({
  name: 'ancient',
  initialState: {
    self: '',
    tiles: {} as { [id: string]: Tile },
  },
  reducers: {
    reset: (state, action: PayloadAction<{ self: string }>) => {
      state.self = action.payload.self;
      state.tiles = {};
    },
    'tile-spawned': (state, action: PayloadAction<Tile>) => {
      state.tiles[action.payload.id] = action.payload;
    },
    'tile-moved': (state, action: PayloadAction<{ id: string, coord: string }>) => {
      state.tiles[action.payload.id].coord = action.payload.coord;
    },
  },
});
