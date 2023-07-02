/**
 * Tests the Bubble Private Cloud via it's http api
 * 
 * run 'npm test' from the project's root directory.
*/

import Web3 from 'web3';
import { BubbleServer } from '../src/http-server.js';
import { GanacheServer } from "./GanacheServer.js";
import * as fs from 'node:fs/promises';
import { v2ServerTests } from './v2/v2-server-tests.js';

describe("HTTP Server", function() {

  //
  // Config
  //

  // Bubble Server
  const SERVER_PORT = 8546;
  const BUBBLE_SERVER_URL = 'http://127.0.0.1:'+SERVER_PORT;
  const SERVER_BUBBLE_PATH = "./test-bubbles";
  const V2_SERVER_BUBBLE_PATH = SERVER_BUBBLE_PATH+'/v2';

  // Blockchain Server
  const CHAIN_ID = 1;
  const GANACHE_MNEMONIC = 'foil message analyst universe oval sport super eye spot easily veteran oblige';
  const GANACHE_PORT = 8545;
  const BLOCKCHAIN_SERVER_URL = 'http://127.0.0.1:'+GANACHE_PORT;

  // Web3 provider
  const web3 = new Web3(BLOCKCHAIN_SERVER_URL);

  // Server Config
  const BUBBLE_SERVER_CONFIG = {
    version: '1',
    port: SERVER_PORT,
    hostname: "vault.bubbleprotocol.com",
    https: {
      active: false,
      key: '',
      cer: ''
    },
    v2: {
      "chains": [
        {
          endpoint: "ethereum",
          chainId: CHAIN_ID,
          rootPath: V2_SERVER_BUBBLE_PATH,
          web3Url: BLOCKCHAIN_SERVER_URL
        }
      ]
    }
  }


  //
  // Global vars
  //

  var testBubbleServer;


  //
  // Blockchain Server
  //

  var ganacheServer;

  function startBlockchain(port, options) {
    ganacheServer = new GanacheServer(port, options);
    return ganacheServer.start();
  }

  function stopBlockchain() {
    return new Promise(resolve => ganacheServer.close(resolve));
  }


  //
  // Tests
  //
 
  beforeAll( async () => {
    await fs.mkdir(SERVER_BUBBLE_PATH, {recursive: true});
    testBubbleServer = new BubbleServer(BUBBLE_SERVER_CONFIG);
    return startBlockchain(GANACHE_PORT, {mnemonic: GANACHE_MNEMONIC})
      .then(testBubbleServer.start.bind(testBubbleServer))
      .then(status => {
        expect(status.port).toBe(SERVER_PORT);
        expect(status.type).toBe('http');
      })
    }, 20000);


  afterAll( async () => {
    testBubbleServer.close();
    stopBlockchain();
    await fs.rmdir(SERVER_BUBBLE_PATH, {recursive: true, force: true});
  }, 20000);


  const chain = BUBBLE_SERVER_CONFIG.v2.chains[0];
  const serverURL = BUBBLE_SERVER_URL+'/v2/'+chain.endpoint;
  v2ServerTests(web3, serverURL, chain);

});
