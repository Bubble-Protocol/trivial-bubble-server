import { Guardian, blockchainProviders } from "@bubble-protocol/server";
import { TrivialDataServer } from "./TrivialDataServer.js";
import { ThrottledWeb3Provider } from "./ThrottledWeb3Provider.js";
import { Wallet } from "./wallet.js";
import { JsonRpcProvider } from 'ethers';

export function RPCv2(CONFIG, endpointPrefix, hostname, options={}) {

  const contractProvider = new JsonRpcProvider(CONFIG.web3Url);
	
  const blockchainProvider = CONFIG.throttling !== undefined
    ? new ThrottledWeb3Provider('1.0', CONFIG.chainId, contractProvider, hostname, CONFIG.throttling.maxRequests, CONFIG.throttling.window)
    : new blockchainProviders.EVMProvider('1.0', CONFIG.chainId, contractProvider, hostname);

  const dataServer = new TrivialDataServer(CONFIG.rootPath);

  const guardian = new Guardian(dataServer, blockchainProvider);

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
    methods: methods
  }
  
}
