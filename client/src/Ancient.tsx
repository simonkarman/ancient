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
    if (!isLinked) {
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
    return <form>
      <input
        className='mt-1 border px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
        name='username'
        placeholder='username'
        value={joinUsername}
        onInput={(e) => setJoinUsername(e.currentTarget.value)}
      />
      <button
        className='ml-2 border p-2 transition-colors hover:bg-green-400'
        onClick={(e) => {
          link(joinUsername);
          e.preventDefault();
        }}>
        Join
      </button>
      <br/>
      {rejectionReason && <p className='p-2 text-red-900'>Rejected: {rejectionReason}</p>}
    </form>;
  }
  const Lobby = () => {
    return <>
      <p>
        Welcome <strong>{username}</strong>,<br/>
        Once you&apos;re ready, then please press the ready up button below. Then wait for all players to ready up.
      </p>
      <button
        className={'mt-2 mr-2 transition-colors border p-2 hover:bg-blue-400 '
          + 'disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
        onClick={() => send({ type: 'game/ready-up' })}
        disabled={players[username].isReady}
      >
        Ready Up!
      </button>
      <button
        className='border p-2 transition-colors hover:bg-red-400'
        onClick={leave}
      >
        Leave
      </button>
      <p className='mt-2 text-gray-500'>
        {Object.entries(players).length < 2
          ? <>You need at least <span className='font-bold'>two</span> players to play this game.</>
          : <>
            Waiting for
            {' '}
            {Object.entries(players)
              .filter(([, { isReady }]) => !isReady)
              .map(([username], index, { length }) => <span key={username}>
                <span className='font-bold'>{username}</span>
                {index !== length - 1 && (index !== length - 2 ? ', ' : ' and ')}
              </span>)}
            {' '}
            to ready up.
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
        className='border p-2 transition-colors hover:bg-red-400'
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
        className='mt-2 border p-2 transition-colors hover:bg-red-400'
        onClick={leave}
      >
        Leave
      </button>
    </>;
  };
  const Game = () => {
    return <>
      <Cards />
    </>;
  };
  return <div className='flex w-full'>
    <div className={'grow'}>
      <div className='my-2 mr-2'>
        {phase === 'lobby' && <Lobby />}
        {phase === 'started' && <Game />}
        {phase === 'paused' && <Paused />}
        {phase === 'finished' && <Finished />}
      </div>
    </div>
    {phase !== 'started' &&
      <div className={'ml-2 whitespace-nowrap border-l-2 px-4'}>
        <h2 className='text-lg'>Players</h2>
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
    }
  </div>;
}
