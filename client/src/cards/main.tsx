import { useKrmx } from '@krmx/client';
import { twMerge } from 'tailwind-merge';
import { Card } from './cards-store';
import { useAppSelector } from '../store/store';

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
  const columns = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6'];
  const mediumColumns = ['', 'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4', 'md:grid-cols-5', 'md:grid-cols-6'];
  return <>
    <h2 className='mb-2 text-lg'>Players</h2>
    <ul className='flex items-center gap-2'>
      {cycle.map((player, index) => <>
        {player === turn && index !== 0 && <li className='text-sm' key='previous'>&gt;</li>}
        <li
          key={player}
          className={twMerge(
            'flex flex-col border px-4 py-2 transition-all duration-500',
            player === turn && 'grow border-gray-400',
          )}
        >
          {player}{player === self ? ' (you)' : ''}<br />
          {handSizes[player]} card{handSizes[player] === 1 ? '' : 's'}
        </li>
        {player === turn && index !== cycle.length - 1 && <li className='text-sm' key='next'>&gt;</li>}
      </>)}
    </ul>
    <div className='mt-4 flex gap-4'>
      <div>
        <h2 className='mb-2 text-lg'>Table</h2>
        <p className='border p-4 text-6xl md:text-8xl'>{cardToString(pile.card)}</p>
        <p className='mt-2 text-gray-400'>
          Pile: {pile.size} card{pile.size === 1 ? '' : 's'}<br/>
          Deck: {deckSize} card{deckSize === 1 ? '' : 's'}<br/>
        </p>
      </div>
      <div className='grow'>
        <h2 className='mb-2 text-lg'>Hand</h2>
        <ul className={`mb-1 grid ${columns[Math.min(hand.length, 4)]} ${mediumColumns[Math.min(hand.length, 6)]} gap-4`}>
          {hand.map(card => <li key={cardToString(card)}>
            <button
              onClick={() => send({ type: 'cards/play', payload: { card } })} disabled={
                turn !== self || (pile.card.suite !== card.suite && pile.card.rank !== card.rank)
              }
              className={'w-full transition-colors border p-2 bg-green-100 hover:bg-green-400 '
            + 'disabled:bg-transparent disabled:hover:bg-gray-200 disabled:border-gray-200 disabled:text-gray-500'}
            >{cardToString(card)}</button>
          </li>)}
        </ul>
        <button
          onClick={() => send({ type: 'cards/draw' })} disabled={turn !== self}
          className={'mt-2 w-full transition-colors border p-2 bg-green-100 hover:bg-green-400 '
            + 'disabled:bg-transparent disabled:hover:bg-gray-200 disabled:border-gray-200 disabled:text-gray-500'}
        >Draw</button>
        {turn === self && <p className='mt-2 animate-pulse'>It is your turn! Please play or draw a card.</p>}
        {winner ? <p className='my-2'>
            &gt; The game was won by <span className='font-bold'>{winner}</span>! As that player has no cards left in hand.
        </p> : <ul className='mt-2'>
          <li><strong>7 or K</strong>: if you play a seven or a king, you have to take another turn</li>
          <li><strong>8</strong>: if you play an eight, the next player skips a turn</li>
          <li><strong>A</strong>: if you play an ace, the turn cycle reverses order</li>
        </ul>}
      </div>
    </div>
  </>;
};
