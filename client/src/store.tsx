import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { krmxSlice } from '@krmx/client';

const gameSlice = createSlice({
  name: 'game',
  initialState: {
    phase: 'lobby' as ('lobby' | 'started' | 'paused' | 'finished'),
    players: {} as { [username: string]: { isReady: boolean }},
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
export const store = configureStore({
  reducer: {
    krmx: krmxSlice.reducer,
    game: gameSlice.reducer,
  },
});

export type AppState = ReturnType<typeof store.getState>;
export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;

export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
