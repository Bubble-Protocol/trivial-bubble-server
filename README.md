# Trivial Bubble Server

## Description

Trivial implementation of a private Bubble server running the [Bubble Protocol](https://bubbleprotocol.com) as specified in [bubble-sdk](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/server).

Clone this repository to deploy your own Bubble server.

This simple implementation stores bubbles as directories on the server's local file system.  Security of those bubbles depends on both the security of the server and on the encryption strategy of each bubble owner.

### Features

- Dual http/websocket server.
- Websocket server supports subscriptions (real-time notifications of content updates).
- Supports multiple endpoints for hosting multiple chains.

## Dependencies

Requires access to an EVM-compatible blockchain via either a Web3 api service such as [Infura](https://www.infura.io/), a local blockchain node or a local [Ganache](https://trufflesuite.com/ganache/) instance.  See Configuration.


## Configuration

Use `config.json` to specify the server port and each chain's chain id, blockchain api, endpoint and bubble storage directory.

## Usage
```
npm install --omit=dev
npm start
```

## Test
```
npm install --include=dev
npm test
```

There are three test scripts:
- [unit.test.js](./test/v2/unit.test.js) runs the Bubble Protocol [data server compliance tests](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/server/test/DataServerTestSuite) directly against this server's [DataServer implementation](./src/v2/TrivialDataServer.js)

- [http-server.test.js](./test/http-server.test.js) runs the same compliance tests (without subscription tests, since subscriptions are only supported over ws) over http via an [HttpBubbleProvider](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/client/src/bubble-providers) instance.

- [ws-server.test.js](./test/ws-server.test.js) runs the same compliance tests over a websocket connection via a [WebsocketBubbleProvider](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/client/src/bubble-providers) instance.