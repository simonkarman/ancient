import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Provider, TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

const karmaxSlice = createSlice({
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
const karmaxStore = configureStore({
  reducer: karmaxSlice.reducer,
});
export type KarmaxState = ReturnType<typeof karmaxStore.getState>;
export type KarmaxDispatch = typeof karmaxStore.dispatch;
export const useKarmaxDispatch: () => KarmaxDispatch = useDispatch;
export const useKarmaxSelector: TypedUseSelectorHook<KarmaxState> = useSelector;

type MessageConsumer = <TMessage extends { type: string }>(message: TMessage) => void;
type KarmaxContextProps = {
  isConnected: boolean,
  authenticate: (username: string) => void,
  send: MessageConsumer,
  unlink: () => void,
  leave: () => void,
} & KarmaxState;
const KarmaxContext = createContext<KarmaxContextProps>({
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
export const useKarmax = function () {
  return useContext(KarmaxContext);
};

const KarmaxProvider: FC<PropsWithChildren<{
  serverUrl: string,
  onMessage: MessageConsumer,
}>> = (props) => {
  const ws = useRef(null as unknown as WebSocket);
  const [status, setStatus] = useState<'waiting' | 'open' | 'closed'>('waiting');
  const karmanDispatch = useKarmaxDispatch();

  const send: MessageConsumer = useCallback((message) => {
    if (status !== 'open') { return; }
    ws.current?.send(JSON.stringify(message));
  }, [status, ws]);

  const authenticate = useCallback((username: string) => {
    if (status !== 'open') { return; }
    karmanDispatch(karmaxSlice.actions.reset({ username }));
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
    socket.onopen = () => {
      setStatus('open');
    };
    socket.onclose = () => {
      karmanDispatch(karmaxSlice.actions.reset({ username: '' }));
      setStatus('closed');
    };
    socket.onmessage = (rawMessage) => {
      const message: unknown = JSON.parse(rawMessage.data);
      if (typeof message === 'object' && message !== null && message && 'type' in message && typeof message.type === 'string') {
        if (message.type.startsWith('user/')) {
          karmanDispatch(message);
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

  const username = useKarmaxSelector((state) => state.username);
  const rejectionReason = useKarmaxSelector((state) => state.rejectionReason);
  const isLinked = useKarmaxSelector((state) => state.isLinked);
  const users = useKarmaxSelector((state) => state.users);
  const latestLeaveReason = useKarmaxSelector((state) => state.latestLeaveReason);
  return <KarmaxContext.Provider value={{
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
  </KarmaxContext.Provider>;
};

export const Karmax: FC<PropsWithChildren<{
  serverUrl: string,
  onMessage: MessageConsumer,
}>> = (props) => {
  return(<Provider store={karmaxStore}>
    <KarmaxProvider {...props}>
      {props.children}
    </KarmaxProvider>
  </Provider>);
};
