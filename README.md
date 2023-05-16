# Trivial Bubble Server

## Description

Trivial implementation of a private Bubble server running the [Bubble Protocol](https://bubbleprotocol.com) as specified in [bubble-sdk](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/server).

Clone this repository to deploy your own Bubble server.

This simple implementation stores bubbles as directories on the server's local file system.  Security of those bubbles depends on both the security of the server and on the encryption strategy of each bubble owner.

Requires access to an EVM-compatible blockchain via either a Web3 api service such as [Infura](https://www.infura.io/), a local blockchain node or a local [Ganache](https://trufflesuite.com/ganache/) instance.  See Configuration.

## Configuration

Use `config.json` to specify the server's port number, chain id, url of the blockchain api and the bubble storage directory.

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
