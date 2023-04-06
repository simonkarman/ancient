# Ancient
WebSocket board game by [Simon Karman](https://www.simonkarman.nl)

## Upcoming features
Next in line:
- (in progress) make the client use a centralized state management tool for the websocket data
   - remove now unused dependencies in server and client
- write server state to disk on exit, and load server state on startup (+ add option to reset)
- add TypeScript linting to client and server
- make the server use the same TypeScript interface definitions as the client
- separate game logic from generic server logic and make sure that game logic has hooks for onJoin and sendExistingData
- write websocket integration tests for generic server logic
- make the server also use a centralized state management tool
- use HTTPs
- using credentials from signed JWT for username (AND instead of username use a User object to capture more user data)
- show server output via a self updating user table such as k9s output
- add game name and game version verification as part of the client acceptance protocol 
- have a management server to which all game servers subscribe, so the clients can make a list of available servers + make ui being able to choose a server first
- move websocket to a different http path, and have some paths for requesting server information without websockets

Further ahead:
- game/version handshake
- allow rejecting new users (with reason)
- add admin users + user::kick message only allowed by admins
