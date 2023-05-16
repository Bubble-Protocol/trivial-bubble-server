/**
 * Tests the Bubble Private Cloud via it's http api
 * 
 * run 'npm test' from the project's root directory.
*/

import Web3 from 'web3';
import { BubbleServer } from '../src/server.js';
import { blockchainProviders } from '@bubble-protocol/bubble-sdk';
import { startBlockchain, stopBlockchain } from '@bubble-protocol/bubble-sdk/test/mockups/test-blockchain.js';
import * as fs from 'node:fs/promises';
import { v2ServerTests } from './v2/v2-server-tests.js';

describe("Server", function() {

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
  const CONTRACT_ABI_VERSION = '0.0.2';
  const GANACHE_MNEMONIC = 'foil message analyst universe oval sport super eye spot easily veteran oblige';
  const GANACHE_PORT = 8545;
  const BLOCKCHAIN_SERVER_URL = 'http://127.0.0.1:'+GANACHE_PORT;

  // Web3 provider
  const web3 = new Web3(BLOCKCHAIN_SERVER_URL);

  // Server Config
  const BUBBLE_SERVER_CONFIG = {
    version: '1',
    port: SERVER_PORT,
    https: {
      active: false,
      key: '',
      cer: ''
    },
    v2: {
      chainId: CHAIN_ID,
      rootPath: V2_SERVER_BUBBLE_PATH,
      web3Url: BLOCKCHAIN_SERVER_URL
    }
  }


  //
  // Global vars
  //

  var testBubbleServer;


  //
  // Tests
  //
 
  beforeAll( async () => {
    await fs.mkdir(SERVER_BUBBLE_PATH, {recursive: true});
    const blockchainProvider = new blockchainProviders.Web3Provider(CHAIN_ID, web3, CONTRACT_ABI_VERSION);
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


  v2ServerTests(web3, BUBBLE_SERVER_URL, BUBBLE_SERVER_CONFIG.v2);

});
