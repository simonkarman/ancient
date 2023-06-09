import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { selectIsLinked, selectRejectionReason, userReset } from './app/karmaxSlice';

type Send = <TMessage extends { type: string }>(message: TMessage) => void;
type WebSocketContextProps = [string, Send];
const WebSocketContext = createContext<WebSocketContextProps>(['', () => {}]);
export const useWebSocket = function () { return useContext(WebSocketContext); };
export const WebSocketProvider: FC<PropsWithChildren<{
  username: string,
  backToConfiguring: () => void,
}>> = (props) => {
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const ws = useRef(null as unknown as WebSocket);
  const dispatch = useAppDispatch();
  const isLinked = useAppSelector(selectIsLinked);
  const rejectionReason = useAppSelector(selectRejectionReason);

  const send: Send = (message) => {
    ws.current?.send(JSON.stringify(message));
  };
  const authenticate = () => {
    dispatch(userReset({ username: props.username }));
    send({ type: 'user/authenticate', payload: { username: props.username } });
  };

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8082/game?ancient=true&version=0-0-1');
    socket.onopen = () => {
      setConnection('connected');
      authenticate();
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
    <WebSocketContext.Provider value={[props.username, send]}>
      {connection === 'connecting' && <p>
          Connecting to websocket server...
      </p>}
      {connection === 'connected' && <>
        Successfully connected to websocket server.<br/>
        <button onClick={() => ws.current.close()}>Disconnect</button>
        {isLinked ? <>
          <button onClick={() => send({ type: 'user/unlink' })}>Unlink</button>
          <button onClick={() => send({ type: 'user/leave' })}>Leave</button>
          {props.children}
        </> : <p>
          Your connection is not linked to a user...<br/>
          <button onClick={authenticate}>Link as {props.username}</button>
          {rejectionReason && <>You are rejected because: {rejectionReason}</>}
        </p>}
      </>}
      {connection === 'disconnected' && <p>
        Connection to the websocket server was lost...
        <button onClick={props.backToConfiguring}>Back</button>
      </p>}
    </WebSocketContext.Provider>
  );
};
