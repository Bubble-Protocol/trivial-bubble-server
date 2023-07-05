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

  constructor(CONFIG, options) {

    console.log('Bubble Server v'+CONFIG.version);

    this.port = CONFIG.port;

    const app = express();
    app.use(jsonParser.json({limit: '50mb'}));

    this.endpoints = {};

    CONFIG.v2.chains.forEach(chain => {
      const endpoint = '/v2/'+chain.endpoint;
      this.endpoints[endpoint] = RPCv2(chain, '/v2/', CONFIG.hostname, options);
      app.post(endpoint, jayson.server(this.endpoints[endpoint].methods).middleware());
    })

    if (CONFIG.https && CONFIG.https.active) {
      const privateKey  = fs.readFileSync(CONFIG.https.key, 'utf8');
      const certificate = fs.readFileSync(CONFIG.https.cer, 'utf8');
      const credentials = {key: privateKey, cert: certificate};
      this.server = https.createServer(credentials, app);
      this.type = 'https';
    }
    else {
      this.server = http.createServer(app);
      this.type = 'http';
    }

    this.on = this.server.on.bind(this.server);
    this.off = this.server.off.bind(this.server);
    this.removeListener = this.server.removeListener.bind(this.server);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.server.listen(this.port, error => {
        if (error) reject(error);
        else resolve({port: this.port, type: this.type});
      });
    });
  }

  close(callback) {
    this.server.close(callback);
  }

}
