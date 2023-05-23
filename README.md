# Ancient
WebSocket board game by [Simon Karman](https://www.simonkarman.nl)

## Upcoming features
There are different components that together form the Ancient board game. Each has its own upcoming features.

### Add additional Karman Server functionality
1. Karman Server: Add kick method on KarmanServer to make a client leave
2. Karman Server: Allow use of an existing http(s) server for the karman server and provide a path on that server
3. Karman Server: Add built in verification with http headers before ws connection is set up to validate server and client are running the same version
4. Karman Server: Identity management - Using credentials (from signed JWT) for username (AND instead of username use a User object to capture more user data)
5. Karman Server: Add password protection / or add custom credential verification mechanism (such as friend list) that can be used to not accept a new user
6. Karman Server: Close inactive connections (and users?)
7. Karman Server: Show server output (connected users) via a self updating user table such as k9s output
8. Karman Server: Add ping functionality with latency calculation

### Add game logic
1. Ancient Server: Move websocket to a different http path, and have some paths for requesting Ancient Server information
2. Ancient Client: Add ready up functionality
3. Ancient Server: Make use of a centralized state management tool, that broadcasts changes made to the state
4. Ancient Server: Match functionality - Add ready up functionality and don't allow players to join after the match is in progress
5. Ancient Server: Allow commandline to start server on specific port (and with specific password?) and with specific host user
6. Ancient Server: Write server state to disk on exit (and interval? or state change), and load server state on startup (+ add option to reset)
7. Ancient Client: Make the client use the same TypeScript interface definitions as the server

### Add matchmaking
1. Ancient MatchMaking Server: Have a serverless management system (in AWS) to which all ancient servers will subscribe
2. Ancient MatchMaking Server: Endpoint at which clients can list available servers
3. Ancient MatchMaking Server: Endpoint at which clients can start a new server
4. Ancient Client: Add ability to join or create a server
5. Ancient Server: Add an endpoint for the master server to check its health OR use websocket for this
