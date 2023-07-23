import React, { useEffect, useState } from 'react';
import { useKrmx } from '@krmx/client';
import { Ancient } from './ancient/main';
import { ancientSlice } from './ancient/ancient-store';
import { Cards } from './cards/main';
import { cardsSlice } from './cards/cards-store';
import { hexlinesSlice } from './hexlines/hexlines-store';
import { Hexlines } from './hexlines/main';
import { gameSlice } from './store/game';
import { AppState, useAppDispatch, useAppSelector } from './store/store';

export function Game() {
  const { isConnected, isLinked, link, leave, send, users, rejectionReason, username } = useKrmx();
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!isLinked) {
      dispatch(gameSlice.actions.reset());
    }
  }, [dispatch, isConnected, isLinked]);
  const [joinUsername, setJoinUsername] = useState('');
  const phase = useAppSelector((state: AppState) => state.game.phase);
  const players = useAppSelector((state: AppState) => state.game.players);
  const config = useAppSelector((state: AppState) => state.game.config);
  useEffect(() => {
    document.title = (username.length === 0) ? 'Krmx Game' : `Game - ${username}`;
    dispatch(cardsSlice.actions.reset({ self: username }));
    dispatch(ancientSlice.actions.reset({ self: username }));
    dispatch(hexlinesSlice.actions.reset({ self: username }));
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
  const selfReady = players[username].isReady;
  const minPlayersReached = Object.entries(players).length >= config.minPlayers;
  const Lobby = () => {
    return <>
      <p className='mb-4'>
        Welcome <strong>{username}</strong>,
      </p>
      <p className='mb-4'>
        You&apos;re going to play <b>{config.name}</b>.
      </p>
      <button
        className={'mt-2 mr-2 transition-colors border p-2 hover:bg-green-400 '
          + 'disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
        onClick={() => send({ type: 'game/ready-up' })}
        disabled={!minPlayersReached || selfReady}
      >
        Ready Up!
      </button>
      <button
        className={'mt-2 mr-2 transition-colors border p-2 hover:bg-yellow-400 '
          + 'disabled:hover:bg-gray-200 disabled:border-gray-100 disabled:text-gray-500'}
        onClick={() => send({ type: 'game/unready-up' })}
        disabled={!selfReady}
      >
        Unready Up
      </button>
      <button
        className='border p-2 transition-colors hover:bg-red-400'
        onClick={leave}
      >
        Leave
      </button>
      <p className='mt-2 text-gray-400'>
        {minPlayersReached
          ? <>
            {!selfReady && <>Please press the ready up button, once you&apos;re ready to start the game.{' '}</>}
            The game will start once
            {' '}
            {Object.entries(players)
              .filter(([, { isReady }]) => !isReady)
              .map(([username], index, { length }) => <span key={username}>
                <span className="font-bold">{username}</span>
                {index !== length - 1 && (index !== length - 2 ? ', ' : ' and ')}
              </span>)}
            {' '}
            {Object.entries(players).filter(([, { isReady }]) => !isReady).length === 1 ? 'readies' : 'ready'}
            {' '}
            up.
          </>
          : <>Ask your friends to join! You need at least <span className="font-bold">{config.minPlayers}</span> players to play this game.</>
        }
      </p>
    </>;
  };
  const Paused = () => {
    return <>
      <h2 className='text-lg'>Game is paused...</h2>
      <p className='mb-4'>The game will continue once all players have reconnected.</p>
      <button
        className='border border-red-400 p-2 text-red-400 transition-colors hover:bg-red-400 hover:text-white'
        onClick={leave}
      >
        Abandon
      </button>
    </>;
  };
  const Finished = () => {
    return <>
      <h2 className='text-lg'>Finished</h2>
      <p className='mb-4'>The game has concluded, you can now leave the server.</p>
      <button
        className='border border-blue-400 p-2 text-blue-400 transition-colors hover:bg-blue-400 hover:text-white'
        onClick={leave}
      >
        Leave
      </button>
    </>;
  };
  const Game = () => {
    return <>
      {config.name === 'cards' && <Cards />}
      {config.name === 'ancient' && <Ancient />}
      {config.name === 'hexlines' && <Hexlines />}
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
