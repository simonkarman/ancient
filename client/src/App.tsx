import React, { useState } from 'react';
import { Game } from './Game';
import { KrmxProvider } from '@krmx/client';
import { AppState, useAppDispatch, useAppSelector } from './store/store';

const Header = (props: { reconnect: () => void }) => {
  const gameConfig = useAppSelector(state => state.game.config);
  return <header className={'container mx-auto px-4'}>
    <div className='flex justify-between'>
      <h1 className={'text-2xl font-bold'}>{gameConfig.name === 'none' ? 'Krmx Game' : `Game: ${gameConfig.name}`}</h1>
      <button
        className='border border-gray-100 px-2 py-1 text-gray-300 transition-colors hover:bg-red-400 hover:text-black'
        onClick={props.reconnect}
      >
        Reconnect
      </button>
    </div>
    {gameConfig.name === 'none'
      ? <p>
        Krmx Game is a test application for board games by{' '}
        <a className='text-blue-400' target='_blank' href='https://www.simonkarman.nl' rel="noreferrer">Simon Karman</a>.
        It has been implemented using websockets in NodeJS and React with TypeScript.
        Find more information on{' '}
        <a className='text-blue-400' target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">GitHub</a>.
      </p>
      : <></>}
  </header>;
};

export function App() {
  const [counter, setCounter] = useState(0);
  const serverUrl = `ws://home.simonkarman.com:8082/game?ancient&version=0.0.4&counter=${counter}`;
  const dispatch = useAppDispatch();
  return <div className='flex h-[100dvh] flex-col gap-y-2 pb-2 pt-4'>
    <Header reconnect={() => setCounter(counter + 1)} />
    <hr className={'border'} />
    <main className={'container mx-auto grow px-4'}>
      <KrmxProvider
        serverUrl={serverUrl}
        onMessage={dispatch}
        krmxStateSelector={(state: AppState) => state.krmx}
      >
        <Game />
      </KrmxProvider>
    </main>
    <hr className={'border-2 border-gray-100'} />
    <footer className='container mx-auto'>
      <p className='text-center text-xs'>
        <a className='text-blue-400' target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">Ancient</a> - Simon Karman 2023
      </p>
    </footer>
  </div>;
}
