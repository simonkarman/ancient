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
    <h2 className='border-b text-lg'>Cards</h2>
    <p>
      Cycle: {cycle.join(' -> ')}<br/>
      Turn: <strong>{turn}</strong><br/>
      Deck size: {deckSize}<br />
      Hand sizes: {Object.entries(handSizes)
        .map(([username, numberOfCards]) => `${username}:${numberOfCards}`).join(', ')}<br />
    </p>
    <h2 className='border-b mt-4 text-lg'>Pile</h2>
    <p>
      Size: {pile.size}<br/>
      <span className='text-4xl'>{cardToString(pile.card)}</span>
    </p>
    {winner && <>
        The game was won by <strong>{winner}</strong>! As that player has no cards left in hand.
    </>}
    <h2 className='border-b mt-4 text-lg'>Hand</h2>
    <p>
      <ul className='mb-1 flex'>
        {hand.map(card => <li key={cardToString(card)}>
          <button
            onClick={() => send({ type: 'cards/play', payload: { card } })} disabled={
              turn !== self || (pile.card.suite !== card.suite && pile.card.rank !== card.rank)
            }
            className={'mt-2 mr-1 transition-colors border p-2 bg-green-100 hover:bg-green-400 '
              + 'disabled:bg-transparent disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
          >{cardToString(card)}</button>
        </li>)}
        <li>
          <button
            onClick={() => send({ type: 'cards/draw' })} disabled={turn !== self}
            className={'mt-2 mr-2 transition-colors border p-2 bg-green-100 hover:bg-green-400 '
              + 'disabled:bg-transparent disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
          >Draw</button>
        </li>
      </ul>
      {turn === self && <span className='animate-pulse'>It is your turn! Please play or draw a card.</span>}
    </p>
  </>;
};
