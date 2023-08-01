import { krmxSlice } from '@krmx/client';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const gameSlice = createSlice({
  name: 'game',
  initialState: {
    phase: 'lobby' as ('lobby' | 'started' | 'paused' | 'abandoned'),
    config: {
      name: 'none',
      minPlayers: 2,
      maxPlayers: 4,
    },
    players: {} as { [username: string]: { isReady: boolean } },
  },
  reducers: {
    reset: () => {
      return { phase: 'lobby' as const, config: { name: 'none', minPlayers: 2, maxPlayers: 4 }, players: {} };
    },
    config: (state, action: PayloadAction<{ name: string, minPlayers: number, maxPlayers: number }>) => {
      state.config = action.payload;
    },
    'ready-upped': (state, action: PayloadAction<{ username: string }>) => {
      state.players[action.payload.username].isReady = true;
    },
    'unready-upped': (state, action: PayloadAction<{ username: string }>) => {
      state.players[action.payload.username].isReady = false;
    },
    started: (state) => {
      state.phase = 'started';
    },
    paused: (state) => {
      state.phase = 'paused';
    },
    resumed: (state) => {
      state.phase = 'started';
    },
    abandoned: (state) => {
      state.phase = 'abandoned';
    },
  },
  extraReducers: builder => {
    builder.addCase(krmxSlice.actions.joined, (state, action) => {
      state.players[action.payload.username] = { isReady: false };
    });
    builder.addCase(krmxSlice.actions.unlinked, (state, action) => {
      state.players[action.payload.username].isReady = false;
    });
    builder.addCase(krmxSlice.actions.left, (state, action) => {
      delete state.players[action.payload.username];
    });
  },
});
