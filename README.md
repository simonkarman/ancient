# Ancient
WebSocket board game by [Simon Karman](https://www.simonkarman.nl)

## Upcoming features
There are different components that together form the Ancient board game. Each has its own upcoming features.

### Add additional base karmax functionality
1. Karmax Server: Identity management - Using credentials (from signed JWT) for username (AND instead of username use a User object to capture more user data)
2. Karmax Server: Add password protection / or add custom credential verification mechanism (such as friend list) that can be used to not accept a new user
3. Karmax Server: Close unresponsive and not accepted connections
4. Karmax Server: Add ping functionality with latency calculation
5. Karmax Client: Add client for karmax that also emits events in the same way as the server
6. Karmax Server: Show server output (connected users) via a self updating user table such as k9s output

### Add karmax game server functionality
1. React Client (+ Karmax Client): Add ready up functionality
2. Karmax Game: Add match functionality (ready up, pause, play, ect and don't allow new users after the game has started)
3. Karmax Game: Kick inactive users

### Add ancient logic
1. Karmax Server: Move websocket to a different http path, and have some paths for requesting game status information
2. Server: Make use of a centralized state management tool, that broadcasts changes made to the state
3. Server: Allow commandline to start server on specific port (and with specific password?) and with specific host user
4. Server: Write server state to disk on exit (and interval? or state change), and load server state on startup (+ add option to reset)
5. React Client: Make the client use the same TypeScript interface definitions as the server

### Add serverless matchmaking
1. MatchMaking Server: Have a serverless management system (in AWS) to which all ancient servers will subscribe
2. MatchMaking Server: Endpoint at which clients can list available servers
3. MatchMaking Server: Endpoint at which clients can start a new server
4. React Client: Add ability to join or create a server
5. Server: Add an endpoint for the master server to check its health (polling)
