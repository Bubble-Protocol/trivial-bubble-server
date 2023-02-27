/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 *
 * Trivial Bubble Server
 *
 * Stores bubbles on the local file system in the path specified in config.json.  Bubble files are 
 * named after their smart contract address.
 */

const datona = require("datona-lib");
const TrivialVaultDataManager = require("./vaultDataManager").TrivialVaultDataManager;
const fs = require('fs');


// Constants
const version = "0.0.1";

/**
 * Server
 */
class TrivialBubbleServer{

  constructor(portNumber, bubblePath, key, https = true){
    console.log("Trivial Bubble Server v" + version);
    console.log("Bubble Protocol v" + datona.protocolVersion);
    this.key = key;
    const vaultManager = new TrivialVaultDataManager(bubblePath);
    this.vaultKeeper = new datona.vault.VaultKeeper(vaultManager, this.key);
    var serverFactory = https ? require('https') : require('http');
    var privateKey  = https ? fs.readFileSync('~/.ssl/ssl.key', 'utf8') : null;
    var certificate = https ? fs.readFileSync('~/.ssl/ssl.cer', 'utf8') : null;
    var credentials = {key: privateKey, cert: certificate};
    this.server = serverFactory.createServer(credentials, this.connection.bind(this));
    this.server.listen(portNumber);

    this.server.on('error', (err) => {
      console.error("server error: " + err)
    });

    console.log('Listening on port ' + portNumber + " over " + (https ? "HTTPS" : "HTTP"));
  }


  connection(request, response){
    console.trace(request.connection.remoteAddress+'\tconnected');

    var data = "";
    const key = this.key;

    request.on('data', (chunk) => { data += chunk.toString() });

    request.on('end', () => {
      if (data.length === 0) {
        console.error(request.connection.remoteAddress+"\tno data");
        const txn = datona.comms.createErrorResponse(new datona.errors.TransactionError("Transaction has no data"), "VaultResponse");
        sendResponse(request, response, datona.comms.encodeTransaction(txn, key));
      }
      else {
        const logPostfix = data.length > 1024 ? "... (>1kb truncated)" : '';
        console.trace(request.connection.remoteAddress+"\ttransaction "+data.substring(0, 1024) + logPostfix);
        this.vaultKeeper.handleSignedRequest(data)
          .then( function(responseTxn){ sendResponse(request, response, responseTxn); }  )
          .catch( console.error ); // should never happen
      }
    });

    request.on('close', () => {
      console.trace(request.connection.remoteAddress+'\tdisconnected');
    });

  }

  close(){
    datona.blockchain.close();
    this.server.close(() => { console.log("Server shutdown"); })
  }
}

function sendResponse(c, r, responseTxn){
  const logPostfix = responseTxn.length > 1024 ? "... (>1kb truncated)" : '';
  console.trace(c.connection.remoteAddress+"\tresponse "+responseTxn.substring(0, 1024) + logPostfix);
  r.setHeader('Access-Control-Allow-Origin', '*');
  r.setHeader('Access-Control-Allow-Headers', '*');
  r.writeHead(200);
  r.end(responseTxn);
}

module.exports.TrivialBubbleServer = TrivialBubbleServer;
