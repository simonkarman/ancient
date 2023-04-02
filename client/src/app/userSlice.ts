import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

type UserState = {
  [username: string]: { isConnected: boolean}
}
const initialState: UserState = {}

const newUser = () => ({ isConnected: true });

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    reset: () => {
      return {};
    },
    join: (state, action: PayloadAction<string>) => {
      state[(action as any).username] = newUser();
    },
    leave: (state, action: PayloadAction<string>) => {
      delete state[(action as any).username]
    },
    disconnected: (state, action: PayloadAction<string>) => {
      if (state[(action as any).username] === undefined) {
        state[(action as any).username] = newUser();
      }
      state[(action as any).username].isConnected = false;
    },
    reconnected: (state, action: PayloadAction<string>) => {
      if (state[(action as any).username] === undefined) {
        state[(action as any).username] = newUser();
      }
      state[(action as any).username].isConnected = true;
    },
  },
})

export const { reset } = userSlice.actions;
export const selectUsers = (state: RootState) => {
  return Object.entries(state.user).map(([username, user]) => ({ ...user, username }));
};
export const selectIsConnected = (state: RootState) => state.user.isConnected;
export default userSlice.reducer;