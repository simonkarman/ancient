import React, { useEffect, useState } from 'react';
import { useKrmx } from '@krmx/client';
import { Cards } from './Cards';
import { cardsSlice } from './store/cards';
import { gameSlice } from './store/game';
import { AppState, useAppDispatch, useAppSelector } from './store/store';

export function Ancient() {
  const { isConnected, isLinked, link, leave, send, users, rejectionReason, username } = useKrmx();
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (isLinked === false) {
      dispatch(gameSlice.actions.reset());
    }
  }, [dispatch, isConnected, isLinked]);
  const [joinUsername, setJoinUsername] = useState('');
  const phase = useAppSelector((state: AppState) => state?.game.phase);
  const players = useAppSelector((state: AppState) => state?.game.players);
  useEffect(() => {
    document.title = username.length === 0 ? 'Ancient' : `Ancient - ${username}`;
    dispatch(cardsSlice.actions.reset({ self: username }));
  }, [username]);
  if (!isConnected) {
    return <p className='text-red-900'>No connection to server</p>;
  }
  if (!isLinked) {
    return <>
      <input
        className='mt-1 px-3 py-2 border focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
        name='username'
        placeholder='username'
        value={joinUsername}
        onInput={(e) => setJoinUsername(e.currentTarget.value)}
      />
      <button
        className='ml-2 transition-colors border p-2 hover:bg-green-400'
        onClick={() => link(joinUsername)}>
        Join
      </button>
      <br/>
      {rejectionReason && <p className='text-red-900 p-2'>Rejected: {rejectionReason}</p>}
    </>;
  }
  const Lobby = () => {
    return <>
      <h2 className='text-lg'>Lobby!</h2>
      <p>
        Welcome <strong>{username}</strong>,
      </p>
      <p>Once you&apos;re ready, then please press the ready up button below. Then wait for all players to ready up.</p>
      <button
        className={'mt-2 mr-2 transition-colors border p-2 hover:bg-blue-400 '
          + 'disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
        onClick={() => send({ type: 'game/ready-up' })}
        disabled={players[username].isReady}
      >
        Ready Up!
      </button>
      <button
        className='transition-colors border p-2 hover:bg-red-400'
        onClick={leave}
      >
        Leave
      </button>
      <p className='mt-2 text-gray-400'>
        {Object.entries(players).length < 2
          ? <>You need at least 2 players to play this game.</>
          : <>
            The following players are NOT ready:
            {' '}
            {Object.entries(players).filter(([, { isReady }]) => !isReady).map(([username]) => username).join(', ')}
          </>
        }
      </p>
    </>;
  };
  const Paused = () => {
    return <>
      <h2 className='text-lg'>Game is paused...</h2>
      <p>Please wait for all players to reconnect.</p>
      <button
        className='transition-colors border p-2 hover:bg-red-400'
        onClick={leave}
      >
        Abandon
      </button>
    </>;
  };
  const Finished = () => {
    return <>
      <h2 className='text-lg'>Finished</h2>
      <p>The game has concluded, you can now leave the server.</p>
      <button
        className='mt-2 transition-colors border p-2 hover:bg-red-400'
        onClick={leave}
      >
        Leave
      </button>
    </>;
  };
  const Game = () => {
    return <>
      <Cards />
      <button
        className='mt-2 transition-colors border p-2 hover:bg-red-400'
        onClick={leave}
      >
        Abandon
      </button>
    </>;
  };
  return <div className='w-full flex'>
    <div className={'grow'}>
      <div className='my-2'>
        {phase === 'lobby' && <Lobby />}
        {phase === 'started' && <Game />}
        {phase === 'paused' && <Paused />}
        {phase === 'finished' && <Finished />}
      </div>
    </div>
    <div className={'border-l-2 px-4'}>
      <h2 className='text-lg'>Users</h2>
      <ul>
        {Object.entries(users).map(([otherUsername, { isLinked }]) =>
          <li key={otherUsername}>
            {isLinked ? '🟢' : '🔴'} {
              otherUsername === username ? <strong>{username} (you)</strong> : otherUsername
            }
          </li>,
        )}
      </ul>
    </div>
  </div>;
}
