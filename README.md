# Trivial Bubble Server

## Description
Trivial implementation of a private Bubble server running the [Bubble Protocol](https://bubbleprotocol.com) as specified in [datona-lib](https://github.com/Datona-Labs/datona-lib).

Clone this repository to deploy your own Bubble server.

This simple implementation stores bubbles as directories on the server's local file system.  Security of those bubbles depends on both the security of the server and on the encryption strategy of each bubble owner.

Requires access to an EVM-compatible blockchain via either a Web3 api service such as [Infura](https://www.infura.io/), a local blockchain node or a local [Ganache](https://trufflesuite.com/ganache/) instance.  See Configuration.

## Configuration
Use `config.json` to specify the server's private key, port number, url of the blockchain api and the bubble storage directory.

**Replace the private key with your own before you deploy your server publicly.**

To use over https, configure "https" to true and ensure your ssl key and certificate are in `~/.ssl/ssl.key` and `~/.ssl/ssl.cer`.

## Usage
```
npm install --omit=dev
npm start
```

## Test
### Dependencies
```
npm install --include=dev
```
Testing requires a local [Ganache](https://trufflesuite.com/ganache/) instance running.
```
ganache-cli --mnemonic "foil message analyst universe oval sport super eye spot easily veteran oblige"
```

(If using the Ganache UI, configure it to use port 8545 and the private key mnemonic above).

### Running
```
npm test
```

For coverage:
```
npm run test-cov
```