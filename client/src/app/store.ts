import { configureStore } from '@reduxjs/toolkit';
import karmaxSlice from './karmaxSlice';

export const store = configureStore({
  reducer: {
    karmax: karmaxSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
