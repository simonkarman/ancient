# @krmx/client
The client side implementation of krmx (the custom websocket protocol for session based message sharing) in React. Works in combination with [@krmx/server](https://www.npmjs.com/package/@krmx/server).

> Used by [Ancient](https://github.com/simonkarman/ancient).

## Getting Started
First install the `@krmx/client` package using npm or yarn.
```bash
npm install @krmx/client
// or
yarn add @krmx/client
```

Then, you can create a simple React client using the following setup.
```typescript jsx
import { Krmx, useKrmx } from '@krmx/client';

function MyApp() {
  const [serverUrl] = useState('ws://localhost:8082');
  return <Krmx
    serverUrl={serverUrl}
    onMessage={(message) => console.info(message)}
  >
    <MyComponent/>
  </Krmx>;
}

function MyComponent() {
  const {
    isConnected, isLinked, authenticate, leave, send, users, rejectionReason,
  } = useKrmx();
  if (!isConnected) {
    // Your logic for when you're not connected to the server goes here!
    return <p>No connection to the server...</p>;
  }
  if (!isLinked) {
    // Your logic for authenticating with the server goes here!
    return <div>
      <button onClick={() => authenticate('simon')}>Join!</button>
      {rejectionReason && <p>Rejected: {rejectionReason}</p>}
    </div>;
  }
  // Your logic for when you're ready to go goes here!
  return (<div>
    <p>
      Welcome <strong>simon</strong>!
    </p>
    <button onClick={() => send({ type: 'custom/hello' })}>Send custom/hello</button>
    <button onClick={leave}>Leave</button>
    <h2>Users</h2>
    <ul>
      {Object.entries(users).map(([otherUsername, { isLinked }]) => <li key={otherUsername}>{isLinked ? '🟢' : '🔴'} {otherUsername}</li>)}
    </ul>
  </div>);
}
```

## Issues
If you find any issues when using `@krmx/client`, then please create a ticket here: [ancient/issues](https://github.com/simonkarman/ancient/issues).
