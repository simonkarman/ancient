import { krmxSlice } from '@krmx/client';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const gameSlice = createSlice({
  name: 'game',
  initialState: {
    phase: 'lobby' as ('lobby' | 'started' | 'paused' | 'finished'),
    players: {} as { [username: string]: { isReady: boolean } },
  },
  reducers: {
    reset: () => {
      return { phase: 'lobby' as const, players: {} };
    },
    'ready-upped': (state, action: PayloadAction<{ username: string }>) => {
      state.players[action.payload.username].isReady = true;
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
    finished: (state) => {
      state.phase = 'finished';
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
