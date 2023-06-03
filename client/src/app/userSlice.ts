import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

type UserState = {
  isAccepted: boolean;
  rejectionReason: string | undefined;
  users: { [username: string]: { isLinked: boolean}};
  latestLeaveReason: string | undefined;
}
const initialState: UserState = {
  isAccepted: false,
  rejectionReason: undefined,
  users: {},
  latestLeaveReason: undefined,
};

const newUser = () => ({ isLinked: true });

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    reset: () => {
      return { isAccepted: false, rejectionReason: undefined, users: {}, latestLeaveReason: undefined };
    },
    resetLatestLeaveReason: (state) => {
      state.latestLeaveReason = undefined;
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
    leave: (state, action: PayloadAction<{ username: string, reason: 'voluntary' | 'kicked' }>) => {
      const leaveReason = (action.payload.reason === 'kicked') ? ', because it was kicked' : ' voluntarily';
      state.latestLeaveReason = `User '${action.payload.username}' left the server${leaveReason}.`;
      delete state.users[action.payload.username];
    },
    unlinked: (state, action: PayloadAction<{ username: string }>) => {
      const username = action?.payload?.username;
      if (state.users[username] === undefined) {
        state.users[username] = newUser();
      }
      state.users[username].isLinked = false;
    },
    linked: (state, action: PayloadAction<{ username: string }>) => {
      const username = action?.payload?.username;
      if (state.users[username] === undefined) {
        state.users[username] = newUser();
      }
      state.users[username].isLinked = true;
    },
  },
});

export const { reset: userReset, resetLatestLeaveReason: userResetLatestLeaveReason } = userSlice.actions;
export const selectIsAccepted = (rootState: RootState) => rootState.user.isAccepted;
export const selectIsRejected = (rootState: RootState) => rootState.user.rejectionReason !== undefined;
export const selectRejectionReason = (rootState: RootState) => rootState.user.rejectionReason;
export const selectLatestLeaveReason = (rootState: RootState) => rootState.user.latestLeaveReason;
export const selectUsers = (rootState: RootState) => {
  return Object.entries(rootState.user.users).map(([username, user]) => ({ ...user, username }));
};

export default userSlice.reducer;
