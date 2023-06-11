# Ancient
A board game by [Simon Karman](https://www.simonkarman.nl) implemented using websockets in NodeJS and React with TypeScript.

## Modules
- **[server](./server)** - The NodeJS application containing the server-side logic
- **[client](./client)** - The React web application contain the ui and client-side logic
- **[krmx](./krmx)** - The custom websocket protocol shared by the server and client
- **[root](./README.md)** The root module is used to set up a pre-commit git hook that executes `npm run precommit` in every submodule

## Terminology
| name        | description                                                    |
|-------------|----------------------------------------------------------------|
| ancient     | name of the board game                                         |
| krmx        | protocol used to implement websocket logic                     |
| server      | an application running a krmx server                           |
| client      | an application (f.e. React App) that connects to a krmx server |
| matchmaking | creation and discovery of servers by clients                   |
| connection  | a websocket connection between a server and a client           |
| user        | an entity on the server that a connection can link to          |
 | (un)linking | the act of linking or unlinking a connection to or from a user |
| player      | an entity of the game middleware layer                         |
