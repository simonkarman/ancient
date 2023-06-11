import React, { useState } from 'react';
import { Main } from './Main';
import { Karmax } from './karmax';

export function Ancient() {
  const [serverUrl] = useState('ws://localhost:8082/game?ancient&version=0.0.1');
  return <div className='h-screen flex flex-col gap-y-4 pt-4'>
    <header className={'container mx-auto px-4'}>
      <h1 className={'font-bold text-2xl'}>Ancient</h1>
      <p>
        A board game by <a target='_blank' href='https://www.simonkarman.nl' rel="noreferrer">Simon Karman</a> implemented
        using websockets in NodeJS and React with TypeScript.
        Find more information on <a target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">GitHub</a>.
      </p>
    </header>
    <hr className={'border'} />
    <main className={'container mx-auto grow px-4'}>
      <Karmax
        serverUrl={serverUrl}
        onMessage={(message) => console.info(message)}
      >
        <Main />
      </Karmax>
    </main>
    <hr className={'border-2 border-gray-100'} />
    <footer className={'container mx-auto px-4 pb-4'}>
      <p className='text-center'>
        <a target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">Ancient</a> - 2023
      </p>
    </footer>
  </div>;
}
