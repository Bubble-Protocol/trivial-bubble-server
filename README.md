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

Requires access to an EVM-compatible blockchain via either a Web3 api service such as [Infura](https://www.infura.io/), a local blockchain node or a local [Ganache](https://trufflesuite.com/ganache/) instance. Setup your Infura api or local Ganache.


# Bubble Server Installation

Use `config.json` to specify the server port and each chain's chain id, blockchain api, endpoint and bubble storage directory.

This guide explains the settings available in `config.json` for configuring the Bubble server with multiple blockchain networks.

## Configuration Options

### Server Port (`serverPort`)
The main server port that your Bubble server will listen on, such as `3000`.

### Chains (`chains`)
Define each blockchain network with the following options:

- **endpoint**: The endpoint path for this blockchain, used for routing requests (e.g., `ethereum`).
- **chainId**: The unique chain ID for the blockchain network (e.g., `1` for Ethereum mainnet, `1337` for a local Ganache network).
- **web3Url**: The URL for the Web3 provider:
  - For Infura or another Web3 API provider, use the respective URL with an API key (e.g., `https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID`).
  - For a local Ethereum node, use its RPC endpoint (e.g., `http://localhost:8545`).
  - For a local Ganache instance, use `http://127.0.0.1:8545`.
- **rootPath**: The path for local storage of bubbles on this blockchain network.
### Throttling (`throttling`) Optional
Manage request rates to protect against abuse and API rate limits.

---

### Example `config.json`

```json
{
    "version": "0.2.0",
    "port": 3000,
    "hostname": "localhost",
    "https": {
        "active": false,
        "key": "<PATH_TO_PRIVATE_KEY>",
        "cer": "<PATH_TO_CERTIFICATE>"
    },
    "debugOn": false,
    "traceOn": true,
    "v2": {
        "chains": [
            {
                "endpoint": "ethereum",
                "chainId": 1,
                "rootPath": "./bubbles/ethereum",
                "web3Url": "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID"
            },
            {
                "endpoint": "polygon",
                "chainId": 137,
                "rootPath": "./bubbles/polygon",
                "web3Url": "https://polygon-amoy.infura.io/v3/YOUR_INFURA_PROJECT_ID"
            },
            {
                "endpoint": "avalanche",
                "chainId": 43114,
                "rootPath": "./bubbles/avalanche",
                "web3Url": "https://avalanche-fuji.infura.io/v3/YOUR_INFURA_PROJECT_ID"
            },
            {
                "endpoint": "sepolia",
                "chainId": 11155111,
                "rootPath": "./bubbles/sepolia",
                "web3Url": "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID"
            },
            {
                "endpoint": "ganache",
                "chainId": 1337,
                "web3Url": "http://127.0.0.1:8545",
                "endpoint": "/ganache",
                "rootPath": "./storage/ganache"
            }
        ],
        "throttling": {
            "enabled": true,
            "maxRequests": 10,
            "window": 1000
        },
    }
}
```

## Install dependencies (excluding development dependencies)
```
npm install --omit=dev
```
## Start the Bubble server
```
npm start
```

# Bubble Server Tests

This repository includes a suite of test scripts designed to verify compliance with the Bubble Protocol standards for `DataServer` implementations. These tests ensure the server’s functionality and reliability across different communication protocols: direct access, HTTP, and WebSocket.

## Test Scripts Overview

The following test scripts provide comprehensive validation of the server’s `DataServer` implementation, simulating various real-world client interactions.

### Test Scripts

#### 1. Unit Tests: [unit.test.js](./test/v2/unit.test.js)

- **Purpose**: Executes the Bubble Protocol [Data Server Compliance Tests](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/server/test/DataServerTestSuite) directly against the core [DataServer implementation](./src/v2/TrivialDataServer.js).
- **Details**: This test script bypasses HTTP and WebSocket layers, focusing exclusively on the core data operations provided by the `DataServer` class (e.g., create, read, write, delete, list). The script checks that data handling functionality is correct and aligned with protocol standards.
- **Importance**: These direct tests ensure that the core data-handling layer of the server is reliable and compliant, forming a solid foundation for the rest of the server's functionality.

#### 2. HTTP Server Tests: [http-server.test.js](./test/http-server.test.js)

- **Purpose**: Validates the `DataServer` implementation over HTTP by using an [HttpBubbleProvider](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/client/src/bubble-providers).
- **Details**: This script runs the same compliance tests as the unit tests, excluding subscription-related functionality (available only over WebSocket). It confirms that core methods (create, read, write, delete, list) are correctly exposed and accessible through HTTP endpoints, ensuring data integrity and proper functionality across HTTP.
- **Importance**: Testing over HTTP mirrors actual client-server communication, verifying that the server’s HTTP layer is properly configured and performs as expected in real-world HTTP-based scenarios.

#### 3. WebSocket Server Tests: [ws-server.test.js](./test/ws-server.test.js)

- **Purpose**: Runs compliance tests over WebSocket, using a [WebsocketBubbleProvider](https://github.com/Bubble-Protocol/bubble-sdk/tree/main/packages/client/src/bubble-providers) to interact with the server.
- **Details**: This script verifies that WebSocket-based communication and data operations function correctly, with additional testing for subscription-related methods (e.g., subscribe, unsubscribe) unique to WebSocket. The tests ensure that real-time, bidirectional interactions with the server are fully functional and compliant.
- **Importance**: WebSocket support is essential for real-time updates and subscription-based interactions. This test ensures that WebSocket functionality is reliable, suitable for clients requiring continuous data streams or dynamic data interactions.

---

Each test script is designed to verify a specific access method, offering thorough, protocol-specific validation of the Bubble server’s compliance and robustness.

## Test
### Install all dependencies, including development dependencies
```
npm install --include=dev
```
#### Run the test suite
```
npm test
```