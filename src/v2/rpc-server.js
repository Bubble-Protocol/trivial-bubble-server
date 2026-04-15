import { Guardian, blockchainProviders } from "@bubble-protocol/server";
import { NotificationManager } from "@bubble-protocol/server/src/NotificationManager.js";
import { TrivialDataServer } from "./TrivialDataServer.js";
import { ThrottledWeb3Provider } from "./ThrottledWeb3Provider.js";
import { Wallet } from "./wallet.js";
import { JsonRpcProvider } from 'ethers';
import http from 'http';
import https from 'https';

export function RPCv2(CONFIG, endpointPrefix, hostname, options={}) {

  const contractProvider = new JsonRpcProvider(CONFIG.web3Url);
	
  const blockchainProvider = CONFIG.throttling !== undefined
    ? new ThrottledWeb3Provider('1.0', CONFIG.chainId, contractProvider, hostname, CONFIG.throttling.maxRequests, CONFIG.throttling.window)
    : new blockchainProviders.EVMProvider('1.0', CONFIG.chainId, contractProvider, hostname);

  const dataServer = new TrivialDataServer(CONFIG.rootPath);
  const providerUrl = `${getProtocol(CONFIG)}://${hostname}${endpointPrefix}${CONFIG.endpoint}`;
  const notificationManager = new NotificationManager(dataServer, providerUrl, postNotification);

  const guardian = new Guardian(dataServer, blockchainProvider, [notificationManager.validateRequest]);

  function postNotification(target, notification) {
    if (target.transport?.type !== 'webhook' || !target.transport?.url) {
      console.log('notification target not supported:', target.id, target.transport?.type);
      return;
    }
    postJson(target.transport.url, notification)
      .catch((error) => {
        console.log('notification delivery failed:', target.id, error.message || error);
      });
  }

  function makeMethod(method) {
    return function(params, callback, subscriptionListener) {
      const serviceRequest = NOTIFICATION_METHODS.includes(method) ? guardian.postWithMetadata : guardian.post;
      serviceRequest.call(guardian, method, params, subscriptionListener)
      .then(response => {
        if (NOTIFICATION_METHODS.includes(method)) {
          callback(null, response.response);
          notificationManager.notify(method, params, response.file, response.signatory);
        }
        else {
          callback(null, response);
        }
      })
      .catch(error => {
        if (!error.code) console.log(error);
        callback({code: error.code, message: error.message, cause: error.cause});
      })
    }
  }

  let methods = {
    ping: (_, callback) => { callback(null, 'pong') },
    create: makeMethod('create'),
    write: makeMethod('write'),
    append: makeMethod('append'),
    read: makeMethod('read'),
    delete: makeMethod('delete'),
    mkdir: makeMethod('mkdir'),
    list: makeMethod('list'),
    getPermissions: makeMethod('getPermissions'),
    terminate: makeMethod('terminate'),
  };

  if (options.subscriptions) {
    methods.subscribe = makeMethod('subscribe');
    methods.unsubscribe = makeMethod('unsubscribe');
  }

  if (CONFIG.wallet) {
    const wallet = new Wallet(blockchainProvider, CONFIG.wallet);
    methods = {...methods, ...wallet.getRpcMethods()}
  }

  return {
    endpoint: endpointPrefix+CONFIG.endpoint,
    guardian: guardian,
    dataServer: dataServer,
    methods: methods,
    close: () => {
      if (typeof blockchainProvider.close === 'function') blockchainProvider.close();
      if (typeof contractProvider.destroy === 'function') contractProvider.destroy();
    }
  }
  
}


const NOTIFICATION_METHODS = ['write', 'append', 'delete', 'mkdir', 'terminate'];


function getProtocol(CONFIG) {
  return CONFIG.https?.active ? 'https' : 'http';
}


function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(url);
    const payload = JSON.stringify(body);
    const request = (targetUrl.protocol === 'https:' ? https : http).request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (response) => {
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
        response.resume();
        resolve();
      }
      else {
        response.resume();
        reject(new Error(`status ${response.statusCode}`));
      }
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}
