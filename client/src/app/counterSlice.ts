import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

interface CounterState {
  value: number
}
const initialState: CounterState = {
  value: 0,
}

const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    reset: () => ({ value: 0 }),
    set: (state, action: PayloadAction<{ value: number }>) => {
      state.value = action.payload.value;
    },
  },
})

export const { reset: counterReset } = counterSlice.actions
export const selectCount = (rootState: RootState) => rootState.counter.value
export default counterSlice.reducer
