import { configureStore } from '@reduxjs/toolkit'
import { counterSlice } from './counterSlice'
import { userSlice } from './userSlice';

export const store = configureStore({ 
  reducer: {
    counter: counterSlice.reducer,
    user: userSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;