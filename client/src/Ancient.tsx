import React from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { selectLatestLeaveReason, selectUsers, userResetLatestLeaveReason } from './app/karmaxSlice';
import { useWebSocket } from './WebSocketProvider';

export function Ancient() {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectUsers);
  const latestLeaveReason = useAppSelector(selectLatestLeaveReason);
  const [username, send] = useWebSocket();
  return (<>
    <p>
      Hello,
      {' '}
      <strong>
        {username}
      </strong>
    </p>
    <button onClick={() => send({ type: 'custom/hello' })}>Send custom/hello</button>
    <div>
      <hr />
      <h3>Users</h3>
      <ul>
        {users.map(user =>
          <li key={user.username}>
            {user.username}
            {' '}
            (is
            {' '}
            {user.isLinked ? 'online' : 'offline'}
            )
          </li>,
        )}
      </ul>
      {latestLeaveReason && (<p onClick={() => dispatch(userResetLatestLeaveReason())}>{latestLeaveReason}</p>)}
    </div>
  </>);
}
