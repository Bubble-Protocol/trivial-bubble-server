/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 */

const CONFIG = require('../config.json');
const TrivialBubbleServer = require('./server.js').TrivialBubbleServer;
const datona = require('datona-lib');

require('./log.js');
console.enable("timestamp");
if (CONFIG.traceOn) console.enable("trace");
if (CONFIG.debugOn) console.enable("debug");
console.trace("Trace enabled");
console.debug("Debug enabled")

main();

async function main() {
  try {
    datona.blockchain.setProvider(CONFIG.blockchainURL, CONFIG.blockchain);
    const key = new datona.crypto.Key(CONFIG.privateKey);
    const server = new TrivialBubbleServer(CONFIG.portNumber, CONFIG.bubblePath, key, CONFIG.https);

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
