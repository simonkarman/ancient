# Ancient
A board game by [Simon Karman](https://www.simonkarman.nl) implemented using websockets in NodeJS and React with TypeScript.

## Modules
- **[server](./server)** - The NodeJS application containing the server-side logic
- **[client](./client)** - The React web application contain the ui and client-side logic
- **[karmax](./karmax)** - The custom websocket protocol shared by the server and client
- **[root](./README.md)** The root module is used to set up a pre-commit git hook that executes `npm run precommit` in every submodule

## Terminology
| name        | description                                                      |
|-------------|------------------------------------------------------------------|
| Ancient     | name of the board game                                           |
| Karmax      | custom protocol used to implement websocket logic                |
| Server      | an application running a karmax server                           |
| Client      | an application (f.e. React App) that connects to a karmax server | 
| Matchmaking | creation and discovery of servers by clients                     | 
| Connection  | a websocket connection between a server and a client             |
| User        | an entity on the server that a connection can link to            |
 | (Un)Linking | the act of linking or unlinking a connection to or from a user   |
| Player      | an entity of the game middleware layer                           |
