/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 */

import express from 'express';
import jayson from 'jayson';
import jsonParser from 'body-parser';
import http from 'http';
import https from 'https';
import { RPCv2 } from './v2/rpc-server.js';
import fs from 'fs';

export class BubbleServer {

  constructor(CONFIG) {

    console.log('Bubble Server v'+CONFIG.version);

    this.port = CONFIG.port;

    const framework = express();
    framework.use(jsonParser.json());

    CONFIG.v2.chains.forEach(chain => {
      framework.post('/v2/'+chain.endpoint, jayson.server(RPCv2(chain)).middleware());
    })

    if (CONFIG.https && CONFIG.https.active) {
      const privateKey  = fs.readFileSync(CONFIG.https.key, 'utf8');
      const certificate = fs.readFileSync(CONFIG.https.cer, 'utf8');
      const credentials = {key: privateKey, cert: certificate};
      this.app = https.createServer(credentials, framework);
      this.type = 'https';
    }
    else {
      this.app = http.createServer(framework);
      this.type = 'http';
    }

  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, error => {
        if (error) reject(error);
        else resolve({port: this.port, type: this.type});
      });
    });
  }

  close(callback) {
    this.server.close(callback);
  }

}
