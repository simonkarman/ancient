import { krmxSlice } from '@krmx/client';
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { cardsSlice } from './cards';
import { gameSlice } from './game';

export const store = configureStore({
  reducer: {
    krmx: krmxSlice.reducer,
    game: gameSlice.reducer,
    cards: cardsSlice.reducer,
  },
});

export type AppState = ReturnType<typeof store.getState>;
export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;

export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
