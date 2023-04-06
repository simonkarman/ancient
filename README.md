# Ancient
WebSocket board game by [Simon Karman](https://www.simonkarman.nl)

## Upcoming features
Next in line:
- Separate game logic from generic server logic and make sure that game logic has hooks for onJoin and sendExistingData
- Make the server use the same TypeScript interface definitions as the client
- Allow rejecting new users with a callback (with reason)
- Write websocket integration tests for generic server logic
- Make the server use a centralized state management tool

Further ahead:
- Add built in game version verification as part of the client acceptance protocol (or http headers before ws connection?)
- Add admin users + user::kick message only allowed by admins
- Write server state to disk on exit (and interval?), and load server state on startup (+ add option to reset)
- Use HTTPs
- Using credentials from signed JWT for username (AND instead of username use a User object to capture more user data)
- Show server output via a self updating user table such as k9s output
- Have a management server to which all game servers subscribe, so the clients can make a list of available servers + make ui being able to choose a server first
- Move websocket to a different http path, and have some paths for requesting server information without websockets
