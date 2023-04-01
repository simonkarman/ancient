# Ancient
WebSocket Boardgame by [Simon Karman](https://www.simonkarman.nl)

## Upcoming freatures
Next in line:
- add TypeScript linting to client and server
- make the clients use the same TypeScript interface definitions as the server
- separate game logic from generic server logic
- make sure that game logic has hooks for onJoin and sendExistingData
- use HTTPs
- using credentials from signed JWT for username AND instead of username use a User object to capture more user data
- show server output via a self updating user table such as k9s output
- write websocket integration tests for generic server logic

Further ahead:
- game/version handshake
- allow rejecting new users (with reason)
- add admin users + user::kick message only allowed by admins