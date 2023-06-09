import React, { useState } from 'react';
import { Main } from './Main';
import { Karmax } from './karmax';

export function Ancient() {
  const [serverUrl] = useState('ws://localhost:8082/game?ancient&version=0.0.1');
  return <div style={{ padding: '1rem' }}>
    <h1>Ancient</h1>
    <p>
      A board game by <a target='_blank' href='https://www.simonkarman.nl' rel="noreferrer">Simon Karman</a> implemented
      using websockets in NodeJS and React with TypeScript.
      Find more information on <a target='_blank' href='https://github.com/simonkarman/ancient' rel="noreferrer">GitHub</a>.
    </p>
    <hr style={{ marginBottom: '1rem', marginTop: '0.5rem' }} />
    <Karmax
      serverUrl={serverUrl}
      onMessage={(message) => console.info(message)}
    >
      <Main />
    </Karmax>
  </div>;
}
