/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 */

import { RPCv2 } from './v2/rpc-server.js';
import WebSocketServer from 'ws';

export class BubbleServer {

  constructor(CONFIG) {
    console.log('Bubble Server v'+CONFIG.version);

    this.port = CONFIG.port;

    //
    // construct the endpoints for this server
    //

    function promisifyRPCMethod(endpoint) {
      return function(params, listener) {
        return new Promise((resolve, reject) => {
          endpoint(params, (error, response) => { if (error) reject(error); else resolve(response) }, listener);
        });
      }
    }
    
    this.endpoints = {};

    CONFIG.v2.chains.forEach(chain => {
      const path = '/v2/'+chain.endpoint;
      this.endpoints[path] = RPCv2(chain, CONFIG.hostname, {subscriptions: true});
      for (const method in this.endpoints[path].methods) {
        this.endpoints[path].methods[method] = promisifyRPCMethod(this.endpoints[path].methods[method]);
      }
    })


    //
    // construct the server
    //

    this.wsServer = new WebSocketServer.Server({ port: this.port });

    this.wsServer.on('connection', (ws, req) => {

      const url = new URL(req.url, `http://${req.headers.host}`);

      if (!this.endpoints[url.pathname]) ws.close(1002, 'Unsupported endpoint');
      else {

        ws.bubbleServer = {
          endpoint: url.pathname,
          subscriptions: []
        }

        ws.on('message', msg => { 
          this.handleRequest(ws, msg)
            .then(response => {
              ws.send(JSON.stringify(response));
            })
            .catch(error => {
              ws.send(JSON.stringify({id: undefined, error: {code: error.code, message: error.message, cause: error.cause}}));
            })
        });
  
        ws.on('close', () => {
          if (ws.bubbleServer.subscriptions.length > 0)
            this.endpoints[ws.bubbleServer.endpoint].dataServer.unsubscribeClient(ws.bubbleServer.subscriptions);
        });
        
      }

    });

  }


  handleRequest(ws, msg) {
    try {
      const { id, method, params } = JSON.parse(msg);
      return this.serviceValidRequest(ws, method, params)
        .then(result => {
          return {id: id, result: result}
        })
        .catch(error => {
          return {id: id, error: {code: error.code, message: error.message, cause: error.cause}}
        })
    }
    catch(error) {
      return Promise.reject({
        code: error.code || -32700,
        message: "Parse error",
        cause: error.message
      });
    }
  }


  serviceValidRequest(ws, method, params) {
    const endpoint = this.endpoints[ws.bubbleServer.endpoint].methods[method]; 
    if (!endpoint) return Promise.reject({code: -32601, message: 'unknown method: '+method})
    switch(method) {
      case 'subscribe':
        return endpoint(params, (msg) => this.notifySubscriber(ws, msg))
          .then(subscription => {
            ws.bubbleServer.subscriptions.push(subscription.subscriptionId);
            return subscription;
          })
      default:
        return endpoint(params);
    }
    
  }


  notifySubscriber(ws, params) {
    const alive = ws.readyState === WebSocketServer.OPEN;
    if (alive) {
      ws.send(JSON.stringify({ method: "subscription", params: params }));
    }
    return alive;
  }  


  start() {
    return Promise.resolve({port: this.port, type: 'ws'});
  }


  close(callback) {
    this.wsServer.close(callback);
  }

}
