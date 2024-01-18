import fs from 'fs';

export class Wallet {

  constructor(provider, CONFIG) {
    const key = fs.readFileSync(CONFIG.key, 'utf8').slice(0,-1); 
    const web3Account = provider.web3.eth.accounts.privateKeyToAccount(key);
    provider.web3.eth.accounts.wallet.add(web3Account);
    this.account = web3Account.address;

    // cater for both standard Web3Providers and ThrottledWeb3Providers
    this.provider = provider.sendRequest 
      ? provider
      : { web3: provider.web3, sendRequest: request => Promise.resolve(request()) }
  }

  post(method, params) {
    let request;
    switch (method) {
      case 'deploy':  
        request = () => this.deploy(params.contract, params.abi, params.bytecode, params.params);
        break;
      case 'send':  
        request = () => this.send(params.contract, params.abi, params.method, params.params);
        break;
      case 'call':  
        request = () => this.call(params.contract, params.abi, params.method, params.params);
        break;
      case 'getCode':  
        request = () => this.getCode(params.contract);
        break;
      default:
        return Promise.reject(new Error('invalid wallet rpc method: '+method));
    }
    return this.provider.sendRequest(request);
  }

  deploy(contract, abi, bytecode, params) {
    const contractObj = new this.provider.web3.eth.Contract(abi, contract);
    return contractObj.deploy({
      data: bytecode,
      arguments: params
    })
    .send({
      from: this.account,
      gas: 1500000,
      gasPrice: '100000000',
    })
  }

  send(contract, abi, method, params) { console.debug('wallet.send', contract, method, params)

    const contractObj = new this.provider.web3.eth.Contract(abi, contract);
    return contractObj.methods[method](...params)
    .estimateGas({from: this.account, gas: 1500000})
    .catch(error => {
      throw new Error('Permission Denied', {cause: error.message});
    })
    .then(() => {
      return this.provider.web3.eth.getTransactionCount(this.account, "pending");
    })
    .then(nonce => {
      return contractObj.methods[method](...params).send({
        from: this.account,
	nonce: nonce, 
        gas: 1500000,
        gasPrice: '100000000',
      });
    })
  }

  call(contract, abi, method, params) {
    const contractObj = new this.provider.web3.eth.Contract(abi, contract);
    return contractObj.methods[method](...params).call({
      from: this.account
    });
  }

  getCode(contract) {
    return this.provider.web3.eth.getCode(contract);
  }

  getRpcMethods() {
    return {
      deploy: _makeRpcMethod(this, 'deploy'),
      send: _makeRpcMethod(this, 'send'),
      call: _makeRpcMethod(this, 'call'),
      getCode: _makeRpcMethod(this, 'getCode')
    }
  }

}


function _makeRpcMethod(wallet, method) {
  return function(params, callback) { 
    wallet.post(method, params)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      if (!error.code) console.log(error);
      callback({code: error.code, message: error.message, cause: error.cause});
    })
  }
}


