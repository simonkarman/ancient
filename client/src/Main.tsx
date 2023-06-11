import React, { useState } from 'react';
import { useKrmx } from '@krmx/client';

export function Main() {
  const { isConnected, isLinked, authenticate, leave, send, users, rejectionReason } = useKrmx();
  const [username, setUsername] = useState('');
  if (!isConnected) {
    return <p className='text-red-900'>No connection to server</p>;
  }
  if (!isLinked) {
    return <>
      <input
        className={'mt-1 px-3 py-2 border focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'}
        name="username"
        placeholder='username'
        value={username}
        onInput={(e) => setUsername(e.currentTarget.value)}
      />
      <button
        className='ml-2 transition-colors border p-2 hover:bg-green-400'
        onClick={() => authenticate(username)}>
        Join
      </button>
      <br/>
      {rejectionReason && <p
        className='text-red-900 p-2'
      >
          Rejected: {rejectionReason}
      </p>}
    </>;
  }
  return <div className='w-full flex'>
    <div className={'grow'}>
      <p>
        Welcome <strong>{`${username.toUpperCase()[0]}${username.slice(1)}`}</strong>,
        for now all you can do is take the following actions.
      </p>
      <div className='my-2'>
        <button
          className='mr-2 transition-colors border p-2 hover:bg-blue-400'
          onClick={() => send({ type: 'custom/hello' })}
        >
        Send custom/hello
        </button>
        <button
          className='transition-colors border p-2 hover:bg-red-400'
          onClick={leave}
        >
        Leave
        </button>
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
