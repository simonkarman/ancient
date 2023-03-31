import React, { useEffect, useState, Dispatch, SetStateAction } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { DefaultEditor } from 'react-simple-wysiwyg';

const WS_URL = 'ws://127.0.0.1:8082';

function isUserEvent(message: { data: string }) {
  let evt = JSON.parse(message.data);
  return evt.type === 'userevent';
}

function isDocumentEvent(message: { data: string }) {
  let evt = JSON.parse(message.data);
  return evt.type === 'contentchange';
}

function App() {
  const [username, setUsername] = useState('');
  const { sendJsonMessage, readyState } = useWebSocket(WS_URL, {
    share: true,
    retryOnError: true,
    shouldReconnect: () => true
  });

  useEffect(() => {
    if(username && readyState === ReadyState.OPEN) {
      sendJsonMessage({
        username,
        type: 'userevent'
      });
    }
  }, [username, sendJsonMessage, readyState]);

  return (
    <>
      <h1>Document Editor</h1>
      <div>
        {username
            ? <EditorSection/>
            : <LoginSection onLogin={setUsername}/> }
      </div>
    </>
  );
}

function LoginSection({ onLogin }: { onLogin: Dispatch<SetStateAction<string>> }) {
  const [username, setUsername] = useState('');
  useWebSocket(WS_URL, {
    share: true,
    filter: () => false
  });
  function logInUser() {
    if(!username.trim()) {
      return;
    }
    onLogin && onLogin(username);
  }

  return (
    <div>
      <h1>Hello, user!</h1>
      <p>Join to edit the document</p>
      <input name="username" onInput={(e) => setUsername((e.target as any).value)} className="form-control" />
          <button
            type="button"
            onClick={() => logInUser()}
            className="btn btn-primary account__btn">Join</button>
    </div>
  );
}

function History() {
  console.log('history');
  const { lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: isUserEvent
  });
  const activities = (lastJsonMessage as any)?.data.userActivity || [];
  return (
    <ul>
      {activities.map((activity: string, index: number) => <li key={`activity-${index}`}>{activity}</li>)}
    </ul>
  );
}

function Users() {
  const { lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: isUserEvent
  });
  const users: { username: string }[] = Object.values((lastJsonMessage as any)?.data.users || {});
  return (
    <>
      {users.map(user => (
        <div key={user.username}>
          {user.username}
        </div>
      ))}
    </>
  );
}

function EditorSection() {
  return (
    <div className="main-content">
      <Users/>
      <Document/>
      <History />
    </div>
  );
}

function Document() {
  const { lastJsonMessage, sendJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: isDocumentEvent
  });

  let html: string = (lastJsonMessage as any)?.data.editorContent || '';

  return (
    <DefaultEditor value={html} onChange={(e) => sendJsonMessage({
        type: 'contentchange',
        content: e.target.value
    })} />
  );
}

export default App;
