import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const hexlinesSlice = createSlice({
  name: 'hexlines',
  initialState: {
    self: '',
  },
  reducers: {
    reset: (state, action: PayloadAction<{ self: string }>) => {
      state.self = action.payload.self;
    },
  },
});
