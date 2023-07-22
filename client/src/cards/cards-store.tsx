import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const getSuites = () => ['hearts', 'spades', 'diamonds', 'clubs'] as const;
const getRanks = () => ['A', 'K', 'Q', 'J', 10, 9, 8, 7, 6, 5, 4, 3, 2 ] as const;
export type Suite = ReturnType<typeof getSuites> extends readonly (infer T)[] ? T : never;
export type Rank = ReturnType<typeof getRanks> extends readonly (infer T)[] ? T : never;
export type Card = {
  suite: Suite;
  rank: Rank
}
export const cardsSlice = createSlice({
  name: 'cards',
  initialState: {
    self: '' as string,
    cycle: [] as string[],
    turn: '' as string,
    deckSize: 0,
    handSizes: {} as { [player: string]: number },
    pile: { size: 0, card: { suite: 'hearts', rank: 'A' } as Card },
    hand: [] as Card[],
    winner: undefined as (string | undefined),
  },
  reducers: {
    reset: (state, action: PayloadAction<{ self: string }>) => {
      state.self = action.payload.self;
      state.cycle = [];
      state.turn = '';
      state.deckSize = 0;
      state.handSizes = {};
      state.pile = { size: 0, card: { suite: 'hearts', rank: 'A' } };
      state.hand = [];
      state.winner = undefined;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set: (state, action: PayloadAction<any>) => {
      state.cycle = action.payload.cycle;
      state.turn = action.payload.turn;
      state.deckSize = action.payload.deckSize;
      state.handSizes = action.payload.handSizes;
      state.pile = action.payload.pile;
      state.hand = action.payload.hand;
      state.winner = action.payload.winner;
    },
    cycle: (state, action: PayloadAction<{ cycle: string[] }>) => {
      state.cycle = action.payload.cycle;
      for (const player of action.payload.cycle) {
        state.handSizes[player] = state.handSizes[player] ?? 0;
      }
    },
    shuffled: (state, action: PayloadAction<{ deckSize: number, pileCard: Card }>) => {
      state.deckSize = action.payload.deckSize;
      state.pile = { size: 1, card: action.payload.pileCard };
    },
    turn: (state, action: PayloadAction<{ player: string }>) => {
      state.turn = action.payload.player;
    },
    drawn: (state, action: PayloadAction<{ player: string, card?: Card }>) => {
      state.deckSize -= 1;
      state.handSizes[action.payload.player] += 1;
      if (action.payload.card) {
        state.hand.push(action.payload.card);
      }
    },
    played: (state, action: PayloadAction<{ player: string, card: Card }>) => {
      state.handSizes[action.payload.player] -= 1;
      state.pile = { size: state.pile.size + 1, card: action.payload.card };
      if (action.payload.player === state.self) {
        const cardIndexInHand = state.hand.findIndex(handCard =>
          handCard.suite === action.payload.card.suite
          && handCard.rank === action.payload.card.rank);
        if (cardIndexInHand !== -1) {
          state.hand.splice(cardIndexInHand, 1);
        }
      }
    },
    won: (state, action: PayloadAction<{ player: string }>) => {
      state.turn = '';
      state.winner = action.payload.player;
    },
  },
});
