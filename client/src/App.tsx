import React, { useState } from 'react';
import { Ancient } from './Ancient';
import { WebSocketProvider } from './WebSocketProvider';

export default function App() {
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [username, setUsername] = useState('');
  return (<>
    <h1>Ancient</h1>
    {isConfiguring ? <div>
      <p>Please choose an username!</p>
      <input name="username" value={username} onInput={(e) => setUsername(e.currentTarget.value)}/>
      <button disabled={username.length < 3} onClick={() => setIsConfiguring(false)}>Configure</button>
    </div> : <>
      <WebSocketProvider username={username} backToConfiguring={() => setIsConfiguring(true)}>
        <Ancient/>
      </WebSocketProvider>
    </>
    }
  </>);
}

