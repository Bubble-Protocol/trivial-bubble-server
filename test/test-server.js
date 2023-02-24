/**
 * Trivial Bubble Server tests
 * 
 * run 'npm test' or 'npm run test-cov' from the project's root directory.
 * 
 * Requires Ganache to be running at the host and port specified in config.json.
 * Ganache must be configured to use the following private key mnemonic:
 *   foil message analyst universe oval sport super eye spot easily veteran oblige
*/

const CONFIG = require('../config.json');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
chai.should();
const datona = require('datona-lib');
const BubbleServer = require('../src/server.js').TrivialBubbleServer;
const sdac = require("../node_modules/datona-lib/contracts/TestContract.json");
const fs = require('fs');
require('../src/log.js');
// console.enable("trace");
// console.enable("debug");

describe("Server", function() {

  const owner = { // taken from Ganache
    privateKey: "24802edc1eba0f578dcffd6ada3c5b954a8e76e55ba830cf19a3083d489a6063",
    address: "0xc16a409a39EDe3F38E212900f8d3afe6aa6A8929"
  };
  const ownerKey = new datona.crypto.Key(owner.privateKey);

  const requester = { // taken from Ganache
    privateKey: "e68e40257cfee330038c49637fcffff82fae04b9c563f4ea071c20f2eb55063c",
    address: "0x41A60F71063CD7c9e5247d3E7d551f91f94b5C3b"
  };
  const requesterKey = new datona.crypto.Key(requester.privateKey);

  const vaultOwner = { // taken from Ganache
    privateKey: "ae139af24306ecac804cfe974398d6d76361287d7b96d9e165d9bcb99a64b6ce",
    address: "0x288b32F2653C1d72043d240A7F938a114Ab69584"
  };
  const vaultKey = new datona.crypto.Key(vaultOwner.privateKey);

  // Server config
  var server;
  const portNumber = 8964;
  const bubblePath = "./test-bubbles";
  const serverScheme = "http";
  const serverUrl = "localhost";

  // From TestContract.sol...
  // Permissions are set to support a variety of tests:
  //   - Vault Root: owner:rwa, requester:r
  //   - File 1: owner:wa, requester:r
  //   - File 2: owner:r, requester:w
  //   - File 3: owner:r, requester:a
  //   - File 4: owner:da, requester:dr
  //   - File 5: owner:dr, requester:dwa
  //   - File 6: owner:rwa, requester:-
  const file1 = "0x0000000000000000000000000000000000000001";
  const file2 = "0x0000000000000000000000000000000000000002";
  const file3 = "0x0000000000000000000000000000000000000003";
  const file4 = "0x0000000000000000000000000000000000000004";
  const file5 = "0x0000000000000000000000000000000000000005";
  const file6 = "0x0000000000000000000000000000000000000006";


  before( function() {
    if (!fs.existsSync(bubblePath)) fs.mkdirSync(bubblePath);
    datona.blockchain.setProvider(CONFIG.blockchainURL, CONFIG.blockchain);
    server = new BubbleServer(portNumber, "./test-bubbles", vaultKey, false);
  });


  describe("Scenario 1: Normal use", function(){

    const contract = new datona.blockchain.Contract(sdac.abi);

    it( "deploy contract", function(){
      return contract.deploy(ownerKey, sdac.bytecode, [requester.address, 10])
        .then( function(contractAddress){
          expect(contractAddress).to.match(/^0x[0-9a-fA-F]{40}$/);
        });
    });

    it( "[attempt to access a non-existent vault fails]", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read()
        .should.eventually.be.rejectedWith(datona.errors.VaultError, "does not exist");
    });

    it( "create vault", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.create()
        .then( function(response){
          if (response.txn.responseType === "error") console.log(response);  // debug
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "[create the same vault again fails]", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.create()
        .should.eventually.be.rejectedWith(datona.errors.VaultError, "attempt to create a vault that already exists");
    });

    it( "[attempt to read before the data has been written fails]", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read()
        .should.eventually.be.rejectedWith(datona.errors.VaultError, "does not exist");
    });

    it( "write to the vault", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.write("Hello World!")
        .then( function(response){
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "reading the vault returns the data", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read()
        .then( function(data){
          expect(data).to.equal("Hello World!");
        });
    });

    it( "reading an empty vault directory returns the empty string", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4)
        .then( function(data){
          expect(data).to.equal("");
        });
    });

    it( "append a file to a directory", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.append("Hello 4.1", file4+"/f1")
        .then( function(response){
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "[attempt to append to an existing file within a directory that only has append permissions fails with VaultError]", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.append("Hello 4.1.1", file4+"/f1")
        .should.eventually.be.rejectedWith(datona.errors.VaultError, "attempt to create a file that already exists");
    });

    it( "reading the directory returns the newly appended file", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4)
        .then( function(data){
          expect(data).to.equal("f1");
        });
    });

    it( "reading the newly appended file returns its contents", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4+"/f1")
        .then( function(data){
          expect(data).to.equal("Hello 4.1");
        });
    });

    it( "append another file to the directory", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.append("Hello 4.2", file4+"/f2")
        .then( function(response){
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "reading the newly appended file returns its contents", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4+"/f2")
        .then( function(data){
          expect(data).to.equal("Hello 4.2");
        });
    });

    it( "reading the directory returns the newly appended file", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4)
        .then( function(data){
          expect(data).to.equal("f1\nf2");
        });
    });

    it( "writing a file to a directory with write permissions", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.write("Hello 5.1", file5+"/f1")
        .then( function(response){
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "reading the newly written file returns its contents", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.read(file5+"/f1")
        .then( function(data){
          expect(data).to.equal("Hello 5.1");
        });
    });

    it( "appending a file to an existing file within a directory with write permissions", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.append("Hello 5.1.1", file5+"/f1")
        .then( function(response){
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "reading the appended file returns its contents", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.read(file5+"/f1")
        .then( function(data){
          expect(data).to.equal("Hello 5.1Hello 5.1.1");
        });
    });

    it( "reading the directory with the mtime option returns the timestamps too", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4, {mtime: true})
        .then( function(data){
          expect(data.length).to.equal(2);
          expect(data[0].file).to.equal("f1");
          expect(data[0].mtime).to.be.greaterThan(0);
          expect(data[1].file).to.equal("f2");
          expect(data[1].mtime).to.be.greaterThan(0);
        });
    });

    it( "reading the directory with the laterThan f1 option returns just f2", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read(file4, {mtime: true})
        .then( function(data){
          expect(data.length).to.equal(2);
          return data[0].mtime;
        })
        .then( f1Mtime => {
          return vault.read(file4, {mtime: true, laterThan: f1Mtime});
        })
        .then( function(data){
          expect(data.length).to.equal(1);
          expect(data[0].file).to.equal("f2");
          expect(data[0].mtime).to.be.greaterThan(0);
        });
    });

    it( "[attempt to read by non-permitted address fails with PermissionError]", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, vaultKey, vaultOwner.address);
      return vault.read()
        .should.eventually.be.rejectedWith(datona.errors.PermissionError, "permission denied");
    });

    it( "update the vault with new data", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.write("Greasy chips")
        .then( function(response){
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

    it( "access the vault returns the new data", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read()
        .then( function(data){
          expect(data).to.equal("Greasy chips");
        });
    });

    it( "[trying to terminate the vault before the contract has expired fails]", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.delete()
        .should.eventually.be.rejectedWith(datona.errors.ContractExpiryError, "contract has not expired");
    });

    it( "owner terminates the contract", function(){
      return contract.terminate(ownerKey)
        .then( function(receipt){
          expect(receipt.status).to.equal(true);
        });
    });

    it( "can no longer access the vault", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, requesterKey, vaultOwner.address);
      return vault.read()
        .should.eventually.be.rejectedWith(datona.errors.PermissionError, "permission denied");
    });

    it( "owner succesfully deletes the vault", function(){
      const vault = new datona.vault.RemoteVault({scheme: serverScheme, host: serverUrl, port: portNumber}, contract.address, ownerKey, vaultOwner.address);
      return vault.delete()
        .then( function(response){
          if (response.txn.responseType === "error") console.log(response);  // debug
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("success");
        });
    });

  });

  describe("Scenario 2: Attacks", function(){

    var axios = require('axios');

    const vaultUrlStr = serverScheme+"://"+serverUrl+":"+portNumber;

    class HttpClient {

      constructor(connectionTimeout = 3000) {
        this.socket = axios.create({ baseURL: vaultUrlStr });
        this.connectionTimeout = connectionTimeout;
      }

      send(method, txn) {
        let source = axios.CancelToken.source();
        const timer = setTimeout(() => { source.cancel() }, this.connectionTimeout);
        return this.socket.put(method, txn, {cancelToken: source.token})
          .then( (response) => {
            clearTimeout(timer);
            return JSON.stringify(response.data);
          });
      }
    }

    const httpClient = new HttpClient();

    it( "sending an empty request resolves with error VaultResponse", function(){
      return httpClient.send("", "")
        .then( function(responseStr){
          const response = datona.comms.decodeTransaction(responseStr);
          expect(response.signatory.toLowerCase()).to.equal(vaultOwner.address.toLowerCase());
          expect(response.txn.txnType).to.equal("VaultResponse");
          expect(response.txn.responseType).to.equal("error");
        });
    });


  });

  after( function(){
    server.close();
    fs.rmSync(bubblePath, { recursive: true, force: true });
  });

});
