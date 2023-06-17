import { useKrmx } from '@krmx/client';
import { Card } from './store/cards';
import { useAppSelector } from './store/store';

const cardToString = (card: Card): string => {
  const suite = {
    clubs: '♣',
    diamonds: '♦',
    hearts: '♥',
    spades: '♠',
  }[card.suite];
  return `${card.rank}${suite}`;
};

export const Cards = () => {
  const { send } = useKrmx();
  const cycle = useAppSelector(state => state.cards.cycle);
  const turn = useAppSelector(state => state.cards.turn);
  const self = useAppSelector(state => state.cards.self);
  const deckSize = useAppSelector(state => state.cards.deckSize);
  const handSizes = useAppSelector(state => state.cards.handSizes);
  const hand = useAppSelector(state => state.cards.hand);
  const pile = useAppSelector(state => state.cards.pile);
  const winner = useAppSelector(state => state.cards.winner);
  return <>
    <h2 className='text-lg'>Cards</h2>
    <p>
      Cycle: {cycle.join(' -> ')}<br/>
      Turn: <strong>{turn}</strong><br/>
      Deck size: {deckSize}<br />
      Hand sizes: {Object.entries(handSizes)
        .map(([username, numberOfCards]) => `${username}:${numberOfCards}`).join(', ')}<br />
    </p>
    <h2 className='text-lg'>Pile</h2>
    <p>
      Pile size: {pile.size}<br/>
      Pile card: <span className='text-2xl'>{cardToString(pile.card)}</span>
    </p>
    <h2 className='text-lg'>Your Hand</h2>
    <p>
      <ul className='flex'>
        {hand.map(card => <li key={cardToString(card)}>
          {cardToString(card)}
          <button
            onClick={() => send({ type: 'cards/play', payload: { card } })} disabled={turn !== self}
            className={'mt-2 mr-2 transition-colors border p-2 hover:bg-green-400 '
              + 'disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
          >Play</button>
        </li>)}
      </ul>
      <button
        onClick={() => send({ type: 'cards/draw' })} disabled={turn !== self}
        className={'mt-2 mr-2 transition-colors border p-2 hover:bg-green-400 '
          + 'disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
      >Draw a new card</button>
    </p>
  </>;
};
