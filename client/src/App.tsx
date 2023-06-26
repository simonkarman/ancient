import React, { useState } from 'react';
import { Ancient } from './Ancient';
import { KrmxProvider } from '@krmx/client';
import { AppState, useAppDispatch } from './store/store';

export function App() {
  const [counter, setCounter] = useState(0);
  const serverUrl = `ws://localhost:8082/game?ancient&version=0.0.3&counter=${counter}`;
  const dispatch = useAppDispatch();
  return <div className='flex h-screen flex-col gap-y-4 pt-4'>
    <header className={'container mx-auto px-4'}>
      <div className='flex justify-between'>
        <h1 className={'text-2xl font-bold'}>Ancient</h1>
        <button
          className='border border-gray-100 px-2 py-1 text-gray-300 transition-colors hover:bg-red-400 hover:text-black'
          onClick={() => setCounter(counter + 1)}
        >
        Reconnect
        </button>
      </div>
      <p>
        A board game by <a target='_blank' href='https://www.simonkarman.nl' rel="noreferrer">Simon Karman</a> implemented
        using websockets in NodeJS and React with TypeScript.
        Find more information on <a target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">GitHub</a>.
      </p>
    </header>
    <hr className={'border'} />
    <main className={'container mx-auto grow px-4'}>
      <KrmxProvider
        serverUrl={serverUrl}
        onMessage={dispatch}
        krmxStateSelector={(state: AppState) => state.krmx}
      >
        <Ancient />
      </KrmxProvider>
    </main>
    <hr className={'border-2 border-gray-100'} />
    <footer className={'container mx-auto px-4 pb-4'}>
      <p className='text-center'>
        <a target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">Ancient</a> - 2023
      </p>
    </footer>
  </div>;
}
