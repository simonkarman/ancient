import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

type UserState = {
  isAccepted: boolean;
  rejectionReason: string | undefined;
  users: { [username: string]: { isConnected: boolean}}
}
const initialState: UserState = {
  isAccepted: false,
  rejectionReason: undefined,
  users: {},
};

const newUser = () => ({ isConnected: true });

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    reset: () => {
      return { isAccepted: false, rejectionReason: undefined, users: {} };
    },
    accepted: (state) => {
      state.isAccepted = true;
    },
    rejected: (state, action: PayloadAction<{ reason: string }>) => {
      state.rejectionReason = action.payload?.reason;
    },
    join: (state, action: PayloadAction<{ username: string }>) => {
      state.users[action.payload.username] = newUser();
    },
    leave: (state, action: PayloadAction<{ username: string }>) => {
      delete state.users[action.payload.username];
    },
    disconnected: (state, action: PayloadAction<{ username: string }>) => {
      const username = action?.payload?.username;
      if (state.users[username] === undefined) {
        state.users[username] = newUser();
      }
      state.users[username].isConnected = false;
    },
    reconnected: (state, action: PayloadAction<{ username: string }>) => {
      const username = action?.payload?.username;
      if (state.users[username] === undefined) {
        state.users[username] = newUser();
      }
      state.users[username].isConnected = true;
    },
  },
});

export const { reset: userReset } = userSlice.actions;
export const selectIsAccepted = (rootState: RootState) => rootState.user.isAccepted;
export const selectIsRejected = (rootState: RootState) => rootState.user.rejectionReason !== undefined;
export const selectRejectionReason = (rootState: RootState) => rootState.user.rejectionReason;
export const selectUsers = (rootState: RootState) => {
  return Object.entries(rootState.user.users).map(([username, user]) => ({ ...user, username }));
};

export default userSlice.reducer;
