// Copyright (c) 2023 Bubble Protocol
// Distributed under the MIT software license, see the accompanying
// file LICENSE or http://www.opensource.org/licenses/mit-license.php.
//

import Web3 from "web3";
import { BlockchainProvider } from "../core/BlockchainProvider";
import jayson from 'jayson';
import { hash, recover } from "../core/crypto";

export class QuickNodeBlockchainProvider extends BlockchainProvider {

  url;
  client;
  chainId;


  constructor(_url, _chainId) {
    super();
    this.url = _url;
    this.chainId = _chainId;
    this.client = jayson.Client.https(this.url);
  }


  getPermissions(contract, account, file) {
    
    const contractObj = new Web3.eth.Contract(abi, contract);

    const params = [
        {
          "from": null,
          "to": contract,
          "data": contractObj.methods.getPermissions(account, file).encodeABI()
        },
        "latest"
      ];
    
    return new Promise((resolve, reject) => {
      this.client.request('eth_call', params, (err, response) => {
        if (err) reject(err);
        resolve(response.result);
      });
    });

  }


  getChainId() {
    return this.chainId;
  }


  recoverSignatory(message, signature) {
    return recover(hash(message), signature);
  }

}