import React, { useEffect, useState, Dispatch, SetStateAction } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

const WS_URL = 'ws://127.0.0.1:8082';

function App() {
  const [username, setUsername] = useState('');
  const { lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    share: true,
    retryOnError: true,
    shouldReconnect: () => true,
  });

  type UserJoinMessage = { type: 'user::join', username: string };
  type UserLeaveMessage = { type: 'user::leave', username: string };
  type UserReconnectedMessage = { type: 'user::reconnected', username: string };
  type UserDisconnectedMessage = { type: 'user::disconnected', username: string };
  type UserMessage = UserJoinMessage | UserLeaveMessage | UserReconnectedMessage | UserDisconnectedMessage;
  const createUser = () => ({ isConnected: true });
  const [users, setUsers] = useState<{ [username: string]: { isConnected: Boolean }}>({});
  useEffect(() => {
    if (lastJsonMessage != null) {
      const { type, username } = lastJsonMessage as UserMessage;
      setUsers(_users => {
        const users = { ..._users };
        console.info('handling', type, 'of', username);
        switch (type) {
          case 'user::join':
            users[username] = createUser();
            break;
          case 'user::leave':
            delete users[username];
            break;
          case 'user::reconnected':
            if (users[username] === undefined) {
              users[username] = createUser();
            }
            users[username].isConnected = true;
            break;
          case 'user::disconnected':
            if (users[username] === undefined) {
              users[username] = createUser();
            }
            users[username].isConnected = false;
            break;
        }
        return users;
      })
    }
  }, [lastJsonMessage, setUsers])

  useEffect(() => {
    if (readyState === ReadyState.CLOSED || readyState === ReadyState.CLOSING) {
      setUsername('');
      setUsers({});
    }
  }, [readyState, setUsername, setUsers])

  // TODO: wait with showing content until we get confirmation that our connection id was actually granted to join as this user...
  return (
    <div style={{ margin: '10px' }}>
      <h1>Ancient</h1>
      <div style={{float: 'right', padding: '1em', border: 'solid gray 1px' }}>
        {Object.entries(users).map(([username, { isConnected }]) =>
          <div key={username} style={{color: isConnected ? 'green' : 'gray'}}>
            {username} is {isConnected ? 'online' : 'offline'}
          </div>
        )}
      </div>
      {username
          ? <ContentSection username={username}/>
          : <JoinSection onLogin={setUsername}/> }
    </div>
  );
}

function JoinSection({ onLogin: onJoin }: { onLogin: Dispatch<SetStateAction<string>> }) {
  const [username, setUsername] = useState('');
  function join() {
    if(!username.trim()) {
      return;
    }
    onJoin && onJoin(username);
  }
  return (
    <div>
      <h3>Welcome</h3>
      <p>Please choose a username:</p>
      <input name="username" onInput={(e) => setUsername((e.target as any).value)} />
      <button onClick={() => join()}>Join</button>
    </div>
  );
}

function LeaveSection({ username }: { username: string }) {
  const { sendJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: () => false
  });
  function leave() {
    sendJsonMessage({ type: 'user::leave', username })
  }

  return (
    <div>
      <button onClick={() => leave()}>Leave</button>
    </div>
  );
}

function ContentSection({ username }: { username: string }) {
  const { sendJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: () => false
  });
  useEffect(() => {
    sendJsonMessage({
      type: 'user::join',
      username,
    });
  }, [sendJsonMessage, username]);
  return (
    <>
      <p>Hey, <strong>{username}</strong>!</p>
      <LeaveSection username={username} />
    </>
  );
}

export default App;
