import { blockchainProviders } from "@bubble-protocol/core";
import { Guardian } from "@bubble-protocol/server";
import { TrivialDataServer } from "./TrivialDataServer.js";
import Web3 from "web3";

export function RPCv2(CONFIG) {

  const web3 = new Web3(CONFIG.web3Url);
  const blockchainProvider = new blockchainProviders.Web3Provider(CONFIG.chainId, web3, '0.0.2');

  const guardian = new Guardian(new TrivialDataServer(CONFIG.rootPath), blockchainProvider);

  function post(method, params, callback) {
    guardian.post(method, params)
      .then(response => {
        callback(null, response);
      })
      .catch(error => {
        if (!error.code) console.log(error);
        callback({code: error.code, message: error.message, cause: error.cause});
      })
  }


  return {
    ping: (_, callback) => { callback(null, 'pong') },
    create: (params, callback) => { post('create', params, callback) },
    write:  (params, callback) => { post('write', params, callback) },
    append:  (params, callback) => { post('append', params, callback) },
    read:  (params, callback) => { post('read', params, callback) },
    delete:  (params, callback) => { post('delete', params, callback) },
    mkdir:  (params, callback) => { post('mkdir', params, callback) },
    list:  (params, callback) => { post('list', params, callback) },
    getPermissions:  (params, callback) => { post('getPermissions', params, callback) },
    terminate:  (params, callback) => { post('terminate', params, callback) },
  };

  
}