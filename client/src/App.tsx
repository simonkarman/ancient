import React, { useState, useEffect, useRef, createContext, useContext, FC, PropsWithChildren } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { reset, selectUsers } from './app/userSlice';

type WebSocketContextProps = [string, WebSocket['send']];
const WebSocketContext = createContext<WebSocketContextProps>(['', () => {}]);
const useWebSocket = function () { return useContext(WebSocketContext) };

const WebSocketProvider: FC<PropsWithChildren<{
  username: string,
  setUnReady: () => void,
}>> = (props) => {
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const ws = useRef(null as unknown as WebSocket);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = new WebSocket('ws://127.0.0.1:8082');

    socket.onopen = () => {
      setConnection('connected');
      dispatch(reset());
      socket.send(JSON.stringify({ type: 'user/join', username: props.username }));
    };
    socket.onclose = () => {
      setConnection('disconnected');
    };
    socket.onmessage = (message) => {
      dispatch(JSON.parse(message.data));
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, [dispatch, props]);
  return ( 
    <WebSocketContext.Provider value={[props.username, ws.current?.send.bind(ws.current)]}>
      {connection === 'connected' && <>
        {props.children}
        <button onClick={() => ws.current.send(JSON.stringify({ type: 'user/leave', username: props.username }))}>
          Leave
        </button>
      </>}
      {connection === 'connecting' && <p>
        Trying to connect to server as <strong>{props.username}</strong>.
      </p>}
      {connection === 'disconnected' && <p>
        Whoops! Your connection was lost, <strong>{props.username}</strong>.<br/>
        <button onClick={props.setUnReady}>Leave</button>
      </p>}
    </WebSocketContext.Provider>
  );
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState('');
  return (<>
    <h1>Ancient</h1>
    {isReady
      ? <>
          <WebSocketProvider username={username} setUnReady={() => setIsReady(false)}>
            <Ancient />
          </WebSocketProvider>
        </>
      : <div>
          <p>Please choose an username!</p>
          <input name="username" onInput={(e) => setUsername((e.target as any).value)} />
          <button onClick={() => setIsReady(true)}>Join</button>
        </div>
    }
  </>)
}

function Ancient() {
  const users = useAppSelector(selectUsers);
  const [username, send] = useWebSocket();
  return (<>
    <p>Hello, <strong>{username}</strong></p>
    <button onClick={() => send('this is not json, omg!')}>Send bad formatted message to server!</button>
    <ul>
      {users.map(user =>
        <li>{user.username} (is {user.isConnected ? 'online' : 'offline'})</li>
      )}
      </ul>
  </>)
}
