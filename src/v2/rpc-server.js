import { blockchainProviders } from "@bubble-protocol/core";
import { Guardian } from "@bubble-protocol/server";
import { TrivialDataServer } from "./TrivialDataServer.js";
import Web3 from "web3";

export function RPCv2(CONFIG, endpointPrefix, hostname, options={}) {

  const web3 = new Web3(CONFIG.web3Url);
  const blockchainProvider = new blockchainProviders.Web3Provider(CONFIG.chainId, web3, '0.0.2');

  const dataServer = new TrivialDataServer(CONFIG.rootPath);

  const guardian = new Guardian(dataServer, blockchainProvider, hostname);

  function makeMethod(method) {
    return function(params, callback, subscriptionListener) { 
      guardian.post(method, params, subscriptionListener)
      .then(response => {
        callback(null, response);
      })
      .catch(error => {
        if (!error.code) console.log(error);
        callback({code: error.code, message: error.message, cause: error.cause});
      })
    }
  }

  const methods = {
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

  return {
    endpoint: endpointPrefix+CONFIG.endpoint,
    guardian: guardian,
    dataServer: dataServer,
    methods: methods
  }
  
}
