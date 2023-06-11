import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Provider, TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import WebSocket from 'isomorphic-ws';

const krmxSlice = createSlice({
  name: 'user',
  initialState: {
    username: '',
    rejectionReason: undefined,
    isLinked: false,
    users: {},
    latestLeaveReason: undefined,
  } as {
    username: string;
    rejectionReason: string | undefined;
    isLinked: boolean;
    users: { [username: string]: { isLinked: boolean}};
    latestLeaveReason: string | undefined;
  },
  reducers: {
    reset: (_, action: PayloadAction<{ username: string }>) => {
      return {
        username: action.payload.username,
        rejectionReason: undefined,
        isLinked: false,
        users: {},
        latestLeaveReason: undefined,
      };
    },
    resetLatestLeaveReason: (state) => {
      state.latestLeaveReason = undefined;
    },
    accepted: (state) => {
      state.rejectionReason = undefined;
    },
    rejected: (state, action: PayloadAction<{ reason: string }>) => {
      state.rejectionReason = action.payload.reason;
    },
    joined: (state, action: PayloadAction<{ username: string }>) => {
      state.users[action.payload.username] = ({ isLinked: false });
    },
    linked: (state, action: PayloadAction<{ username: string }>) => {
      const username = action.payload.username;
      if (state.username === username) {
        state.isLinked = true;
      }
      state.users[username].isLinked = true;
    },
    unlinked: (state, action: PayloadAction<{ username: string }>) => {
      const username = action.payload.username;
      if (state.username === username) {
        state.isLinked = false;
      }
      state.users[username].isLinked = false;
    },
    left: (state, action: PayloadAction<{ username: string, reason: string }>) => {
      state.latestLeaveReason = `User '${action.payload.username}' left the server, reason: ${action.payload.reason}.`;
      delete state.users[action.payload.username];
    },
  },
});
const krmxStore = configureStore({
  reducer: krmxSlice.reducer,
});
type KrmxState = ReturnType<typeof krmxStore.getState>;
type KrmxDispatch = typeof krmxStore.dispatch;
const useKrmxDispatch: () => KrmxDispatch = useDispatch;
const useKrmxSelector: TypedUseSelectorHook<KrmxState> = useSelector;

type MessageConsumer = <TMessage extends { type: string }>(message: TMessage) => void;
type KrmxContextProps = {
  isConnected: boolean,
  authenticate: (username: string) => void,
  send: MessageConsumer,
  unlink: () => void,
  leave: () => void,
} & KrmxState;
const KrmxContext = createContext<KrmxContextProps>({
  isConnected: false,
  isLinked: false,
  username: '',
  rejectionReason: undefined,
  latestLeaveReason: undefined,
  users: {},
  authenticate: () => {},
  send: () => {},
  unlink: () => {},
  leave: () => {},
});
export const useKrmx = function () {
  return useContext(KrmxContext);
};

const KrmxProvider: FC<PropsWithChildren<{
  serverUrl: string,
  onMessage: MessageConsumer,
}>> = (props) => {
  const ws = useRef(null as unknown as WebSocket);
  const [status, setStatus] = useState<'waiting' | 'open' | 'closed'>('waiting');
  const krmxDispatch = useKrmxDispatch();

  const send: MessageConsumer = useCallback((message) => {
    if (status !== 'open') { return; }
    ws.current?.send(JSON.stringify(message));
  }, [status, ws]);

  const authenticate = useCallback((username: string) => {
    if (status !== 'open') { return; }
    krmxDispatch(krmxSlice.actions.reset({ username }));
    send({ type: 'user/authenticate', payload: { username } });
  }, [status, send]);

  const unlink = useCallback(() => {
    if (status !== 'open') { return; }
    send({ type: 'user/unlink' });
  }, [status, send]);

  const leave = useCallback(() => {
    if (status !== 'open') { return; }
    send({ type: 'user/leave' });
  }, [status, send]);

  useEffect(() => {
    const socket = new WebSocket(props.serverUrl);
    socket.onerror = () => setStatus('closed');
    socket.onopen = () => {
      setStatus('open');
    };
    socket.onclose = () => {
      krmxDispatch(krmxSlice.actions.reset({ username: '' }));
      setStatus('closed');
    };
    socket.onmessage = (rawMessage: { data: string }) => {
      const message: unknown = JSON.parse(rawMessage.data);
      if (typeof message === 'object' && message !== null && message && 'type' in message && typeof message.type === 'string') {
        if (message.type.startsWith('user/')) {
          krmxDispatch(message);
        } else {
          props.onMessage(message as { type: string });
        }
      }
    };
    ws.current = socket;
    return () => {
      socket.close();
    };
  }, [props]);

  const username = useKrmxSelector((state) => state.username);
  const rejectionReason = useKrmxSelector((state) => state.rejectionReason);
  const isLinked = useKrmxSelector((state) => state.isLinked);
  const users = useKrmxSelector((state) => state.users);
  const latestLeaveReason = useKrmxSelector((state) => state.latestLeaveReason);
  return <KrmxContext.Provider value={{
    isConnected: status === 'open',
    username,
    rejectionReason,
    isLinked,
    users,
    latestLeaveReason,
    authenticate,
    send,
    unlink,
    leave,
  }}>
    {props.children}
  </KrmxContext.Provider>;
};

export const Krmx: FC<PropsWithChildren<{
  serverUrl: string,
  onMessage: MessageConsumer,
}>> = (props) => {
  return(<Provider store={krmxStore}>
    <KrmxProvider {...props}>
      {props.children}
    </KrmxProvider>
  </Provider>);
};
