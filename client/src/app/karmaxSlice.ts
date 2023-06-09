import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

type KarmaxState = {
  username: string;
  isLinked: boolean;
  rejectionReason: string | undefined;
  users: { [username: string]: { isLinked: boolean}};
  latestLeaveReason: string | undefined;
}
const initialState: KarmaxState = {
  username: '',
  isLinked: false,
  rejectionReason: undefined,
  users: {},
  latestLeaveReason: undefined,
};

const newUser = () => ({ isLinked: false });

const karmaxSlice = createSlice({
  name: 'user', // TODO: should this be karmax?
  initialState,
  reducers: {
    reset: (_, action: PayloadAction<{ username: string }>) => {
      return {
        username: action.payload.username,
        isLinked: false,
        rejectionReason: undefined,
        users: {},
        latestLeaveReason: undefined,
      };
    },
    resetLatestLeaveReason: (state) => {
      state.latestLeaveReason = undefined;
    },
    accepted: (state) => {
      state.rejectionReason = undefined;
    },
    rejected: (state, action: PayloadAction<{ reason: string }>) => {
      state.rejectionReason = action.payload.reason;
    },
    joined: (state, action: PayloadAction<{ username: string }>) => {
      state.users[action.payload.username] = newUser();
    },
    linked: (state, action: PayloadAction<{ username: string }>) => {
      const username = action.payload.username;
      if (state.username === username) {
        state.isLinked = true;
      }
      state.users[username].isLinked = true;
    },
    unlinked: (state, action: PayloadAction<{ username: string }>) => {
      const username = action.payload.username;
      if (state.username === username) {
        state.isLinked = false;
      }
      state.users[username].isLinked = false;
    },
    left: (state, action: PayloadAction<{ username: string, reason: string }>) => {
      state.latestLeaveReason = `User '${action.payload.username}' left the server, reason: ${action.payload.reason}.`;
      delete state.users[action.payload.username];
    },
  },
});

export const { reset: userReset, resetLatestLeaveReason: userResetLatestLeaveReason } = karmaxSlice.actions;
export const selectIsLinked = (rootState: RootState) => rootState.karmax.isLinked;
export const selectRejectionReason = (rootState: RootState) => rootState.karmax.rejectionReason;
export const selectLatestLeaveReason = (rootState: RootState) => rootState.karmax.latestLeaveReason;
export const selectUsers = (rootState: RootState) => {
  return Object.entries(rootState.karmax.users).map(([username, user]) => ({ username, ...user }));
};

export default karmaxSlice.reducer;
