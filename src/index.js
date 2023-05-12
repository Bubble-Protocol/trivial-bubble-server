/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const CONFIG = require('../config.json');
import { blockchainProviders } from '@bubble-protocol/core';
import { BubbleServer } from "./server.js";

console.trace = CONFIG.traceOn ? Function.prototype.bind.call(console.info, console, "[trace]") : function() {};
console.debug = CONFIG.debugOn ? Function.prototype.bind.call(console.info, console, "[debug]") : function() {};


main();

async function main() {
  try {
    const blockchainProvider = new blockchainProviders.Web3Provider(CONFIG.web3Url);
    const server = new BubbleServer(CONFIG.portNumber, CONFIG.bubblePath, blockchainProvider, CONFIG.https);

    process.on('SIGTERM', () => {
      server.close();
    });

    process.on('SIGINT', () => {
      server.close();
    });

  } catch (err) {
    console.error("fatal error: " + err);
  }
}
