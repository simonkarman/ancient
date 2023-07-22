import { Server } from '@krmx/server';
import { Game } from '../game';

// -- messages from server --
// cards/shuffled [deckSize: number, pileCard: Card]
// cards/drawn [player: string, card?: Card]
// cards/played [player: string, card: Card]
// cards/turn [player: string]
// cards/cycle [cycle: string[]]
// cards/won [player: string]

// -- messages from client --
// cards/play [card: Card]
// cards/draw []

export const cards = (game: Game, server: Server, rules: { startingHandSize: number }) => {
  const getSuites = () => ['hearts', 'spades', 'diamonds', 'clubs'] as const;
  const getRanks = () => ['A', 'K', 'Q', 'J', 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  type Suite = ReturnType<typeof getSuites> extends readonly (infer T)[] ? T : never;
  type Rank = ReturnType<typeof getRanks> extends readonly (infer T)[] ? T : never;
  type Card = {
    suite: Suite;
    rank: Rank
  }
  const cardToString = (card: Card): string => {
    const suite = {
      clubs: '♣',
      diamonds: '♦',
      hearts: '♥',
      spades: '♠',
    }[card.suite];
    return `${card.rank}${suite}`;
  };
  function shuffle<T>(inArr: T[]): T[] {
    const arr = structuredClone(inArr);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }
  const getDeck = (): Card[] => {
    return getSuites().flatMap((suite: Suite) => getRanks().map((rank: Rank) => ({ suite, rank })));
  };

  let deck: Card[] = [];
  let pile: Card[] = [];
  let hands: { [player: string]: Card[] | undefined } = {};
  let cycle: string[] = [];
  let turn = 0;
  let winner: string | undefined = undefined;
  const drawCard = (player: string): boolean => {
    if (!cycle.includes(player)) {
      // cannot draw a card for a player that is not in the turn cycle
      return false;
    }
    let card = deck.pop();
    if (card === undefined) {
      if (pile.length < 2) {
        // cannot draw a card if the deck is empty and there is not enough cards in the pile to reshuffle
        return false;
      }
      const single = pile.pop();
      deck = shuffle(pile);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      pile = [single!];
      server.broadcast({ type: 'cards/shuffled', payload: { deckSize: deck.length, pileCard: pile[0] } });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      card = deck.pop()!;
    }
    let hand = hands[player];
    if (hand === undefined) {
      hand = [card];
    } else {
      hand.push(card);
    }
    hands[player] = hand;
    server.broadcast({ type: 'cards/drawn', payload: { player } }, player);
    server.send(player, { type: 'cards/drawn', payload: { player, card } });
    return true;
  };
  const playCard = (player: string, card: Card): boolean => {
    const hand = hands[player];
    if (hand === undefined) {
      // cannot play a card of a player without a hand
      return false;
    }
    const cardIndexInHand = hand.findIndex((handCard) => handCard.suite === card.suite && handCard.rank === card.rank);
    if (cardIndexInHand === -1) {
      // cannot play a card if the player doesn't have the card in hand
      return false;
    }
    const cardOnTopOfPile = pile[pile.length - 1];
    if (cardOnTopOfPile.rank !== card.rank && cardOnTopOfPile.suite !== card.suite) {
      // cannot play a card if it isn't allowed to be put on top of the pile
      return false;
    }
    const [cardFromHand] = hand.splice(cardIndexInHand, 1);
    pile.push(cardFromHand);
    server.broadcast({ type: 'cards/played', payload: { player, card: cardFromHand } });
    return true;
  };
  const nextTurn = () => {
    turn = (turn + 1) % cycle.length;
    server.broadcast({ type: 'cards/turn', payload: { player: cycle[turn] } });
  };
  game.on('started', (players) => {
    console.info(`[info] [cards] starting game for ${players.length} players`);
    // players
    cycle = shuffle(players);
    server.broadcast({ type: 'cards/cycle', payload: { cycle } });
    turn = -1;
    nextTurn();

    // cards
    deck = shuffle(players.length > 5 ? getDeck().concat(getDeck()) : getDeck());
    hands = {};
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    pile = [deck.pop()!];
    server.broadcast({ type: 'cards/shuffled', payload: { deckSize: deck.length, pileCard: pile[0] } });
    for (let i = 0; i < rules.startingHandSize; i += 1) {
      for (const player of players) {
        drawCard(player);
      }
    }

    // logging
    console.info(Object.entries(hands).map(([player, hand]) => `${player}: ${hand?.map(cardToString).join(', ')}`));
  });
  game.on('relinked', (player) => {
    const handSizes: { [player: string]: number } = {};
    for (const entry of Object.entries(hands)) {
      const [player, hand] = entry;
      handSizes[player] = hand === undefined ? 0 : hand.length;
    }
    const cardsSetMessage = {
      type: 'cards/set',
      payload: {
        cycle,
        turn: cycle[turn],
        deckSize: deck.length,
        handSizes,
        pile: { size: pile.length, card: pile[pile.length - 1] },
        hand: hands[player],
        winner,
      },
    };
    console.info(cardsSetMessage);
    server.send(player, cardsSetMessage);
  });
  game.on('message', (player, message) => {
    console.debug(`[info] [cards] ${player} sent ${message.type}`);
    if (cycle[turn] === player) {
      if (message.type === 'cards/play') {
        const card: Card | undefined = (message as unknown as { payload?: { card: Card | undefined } }).payload?.card;
        if (card !== undefined && playCard(player, card)) {
          if (hands[player]?.length === 0) {
            turn = -1;
            winner = player;
            server.broadcast({ type: 'cards/won', payload: { player } });
          } else {
            if (card.rank === 'A') {
              cycle = cycle.reverse();
              turn = cycle.length - 1 - turn;
              server.broadcast({ type: 'cards/cycle', payload: { cycle } });
            }
            if (card.rank !== 'K' && card.rank !== 7) {
              nextTurn();
            }
            if (card.rank === 8) {
              nextTurn();
            }
          }
        } else {
          console.info(`[info] [cards] ${player} cannot play ${card && cardToString(card)}`);
        }
      } else if (message.type === 'cards/draw') {
        if (drawCard(player)) {
          nextTurn();
        } else {
          console.info(`[info] [cards] ${player} cannot draw a card`);
        }
      }
    }
  });
};
