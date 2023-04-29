import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

interface CounterState {
  counter: { [username: string] : number };
}
const initialState: CounterState = {
  counter: {},
};

const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    reset: () => ({ counter: {} }),
    set: (state, action: PayloadAction<{ counter: { [username: string] : number } }>) => {
      state.counter = action.payload.counter;
    },
  },
});

export const { reset: counterReset } = counterSlice.actions;
export const selectCounter = (rootState: RootState) => rootState.counter.counter;
export default counterSlice.reducer;
