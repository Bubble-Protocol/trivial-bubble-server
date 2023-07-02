/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const CONFIG = require('../config.json');
import { BubbleServer as HttpBubbleServer} from "./http-server.js";
import { BubbleServer as WebsocketBubbleServer } from "./ws-server.js";

console.trace = CONFIG.traceOn ? Function.prototype.bind.call(console.info, console, "[trace]") : function() {};
console.debug = CONFIG.debugOn ? Function.prototype.bind.call(console.info, console, "[debug]") : function() {};


main();

async function main() {
  try {
    const server = CONFIG.protocol === 'ws:' ? new WebsocketBubbleServer(CONFIG) : new HttpBubbleServer(CONFIG);

    process.on('SIGTERM', () => {
      server.close();
    });

    process.on('SIGINT', () => {
      server.close();
    });

    server.start()
      .then(status => {
        console.log(status.type, 'server running on port', status.port);
      })
      .catch(console.error);

  } catch (err) {
    console.error("fatal error: " + err);
  }
}
