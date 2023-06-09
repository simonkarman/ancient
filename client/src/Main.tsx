import React, { useState } from 'react';
import { useKarmax } from './karmax';

export function Main() {
  const { isConnected, isLinked, authenticate, leave, send, users, rejectionReason } = useKarmax();
  const [username, setUsername] = useState('');
  if (!isConnected) {
    return <b style={{ color: 'darkred' }}>No connection to server</b>;
  }
  if (!isLinked) {
    return <>
      <input name="username" value={username} onInput={(e) => setUsername(e.currentTarget.value)}/>
      <button onClick={() => authenticate(username)}>Join</button><br/>
      {rejectionReason && <p>Rejected due too: {rejectionReason}</p>}
    </>;
  }
  return <div>
    <ul>
      {Object.entries(users).map(([otherUsername, { isLinked }]) =>
        <li key={otherUsername}>
          {isLinked ? '🟢' : '🔴'} {
            otherUsername === username ? <strong>{username} (you)</strong> : otherUsername
          }
        </li>,
      )}
    </ul>
    <button onClick={() => send({ type: 'custom/hello' })}>Send custom/hello</button>
    <button onClick={leave}>Leave</button>
  </div>;
}
