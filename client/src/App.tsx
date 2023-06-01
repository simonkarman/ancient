import React, { useState, useEffect, useRef, createContext, useContext, FC, PropsWithChildren } from 'react';
import { counterReset, selectCounter } from './app/counterSlice';
import { useAppDispatch, useAppSelector } from './app/hooks';
import {
  userReset,
  selectIsAccepted,
  selectIsRejected,
  selectRejectionReason,
  selectUsers,
  selectLatestLeaveReason,
  userResetLatestLeaveReason,
} from './app/userSlice';

type WebSocketContextProps = [string, WebSocket['send']];
const WebSocketContext = createContext<WebSocketContextProps>(['', () => {}]);
const useWebSocket = function () { return useContext(WebSocketContext); };

const WebSocketProvider: FC<PropsWithChildren<{
  username: string,
  setUnReady: () => void,
}>> = (props) => {
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const ws = useRef(null as unknown as WebSocket);
  const dispatch = useAppDispatch();
  const isAccepted = useAppSelector(selectIsAccepted);
  const isRejected = useAppSelector(selectIsRejected);
  const rejectionReason = useAppSelector(selectRejectionReason);

  useEffect(() => {
    const socket = new WebSocket('ws://192.168.1.108:8082');

    socket.onopen = () => {
      setConnection('connected');
      dispatch(userReset());
      dispatch(counterReset());
      socket.send(JSON.stringify({ type: 'user/join', payload: { username: props.username } }));
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
  // TODO: should not be based on connection, but based on state of negotiation with server (accept, reject, join, leave, ...)
  return (
    <WebSocketContext.Provider value={[props.username, ws.current?.send.bind(ws.current)]}>
      {connection === 'connecting' && <p>
        {/* eslint-disable-next-line react/jsx-one-expression-per-line */}
        Trying to connect to server as <strong>{props.username}</strong>.
      </p>}
      {connection === 'connected' && <>
        {!isAccepted && !isRejected && <p>
          Waiting on server acceptance or rejection as <strong>{props.username}</strong>.
        </p>}
        {isAccepted && <>
          {props.children}
        </>}
        {isRejected && <>
          <p>Server rejected you ({props.username}) because of: {rejectionReason}</p>
          <button onClick={() => {
            ws.current.send(JSON.stringify({ type: 'user/join', payload: { username: props.username } }));
          }}>
                Retry
          </button>
        </>}
        <button onClick={() => {
          ws.current.send(JSON.stringify({ type: 'user/leave', payload: { username: props.username, reason: 'voluntary' } }));
        }}>
          Leave
        </button>
      </>}
      {connection === 'disconnected' && <p>
        Whoops! Your connection was lost,
        {' '}
        <strong>
          {props.username}
        </strong>
        .
        <br/>
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
        <input name="username" value={username} onInput={(e) => setUsername(e.currentTarget.value)} />
        <button disabled={username.length < 3} onClick={() => setIsReady(true)}>Join</button>
      </div>
    }
  </>);
}

function Ancient() {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectUsers);
  const latestLeaveReason = useAppSelector(selectLatestLeaveReason);
  const counter = useAppSelector(selectCounter);
  const [username, send] = useWebSocket();
  return (<>
    <div style={{ float: 'right' }}>
      <ul>
        {users.map(user =>
          <li key={user.username}>
            {user.username}
            {' '}
          (is
            {' '}
            {user.isConnected ? 'online' : 'offline'}
          )
          </li>,
        )}
      </ul>
      {latestLeaveReason && (<p onClick={() => dispatch(userResetLatestLeaveReason())}>{latestLeaveReason}</p>)}
    </div>
    <p>
      Hello,
      {' '}
      <strong>
        {username}
      </strong>
    </p>
    <h2>Counter</h2>
    {Object.keys(counter).map((key) => (<p key={key}>
      {key}: {counter[key]}
    </p>))}
    <button onClick={() => send(JSON.stringify({ type: 'counter/increase' }))}>+</button>
  </>);
}
