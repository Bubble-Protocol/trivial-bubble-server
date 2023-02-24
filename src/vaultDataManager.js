/**
 * Copyright (c) 2023 Bubble Protocol
 * Distributed under the MIT software license, see the accompanying file COPYING or 
 * http://www.opensource.org/licenses/mit-license.php.
 *
 * Trivial Vault Data Manager
 *
 * Implements the VaultDataServer interface in datona-lib.  Bubbles are stored as directories named after the
 * bubble's smart contract address.  Files and directories within the bubble are named after their user-given
 * names.
 */

const datona = require('datona-lib');
const fs = require('fs');
const fsWriteFile = fs.promises.writeFile;
const fsAppendFile = fs.promises.appendFile;
const fsReadDir = fs.promises.readdir;
const fsMkdir = fs.promises.mkdir;
const fsRmdir = fs.promises.rm;
const fsAccess = fs.promises.access;
const fsReadFile = fs.promises.readFile;
const fsUnlink = fs.promises.unlink;
const dirname = require('path').dirname;

class TrivialVaultDataManager extends datona.vault.VaultDataServer {

  constructor(bubblePath) {
    super();
    this.bubblePath =
      (bubblePath.length > 0 && !bubblePath.endsWith('/')) ? bubblePath+'/' : bubblePath;
  }


  create(contract) { 
    const contractPath = this.bubblePath+contract;
    return fsMkdir(contractPath)
      .then( function() {
        return {message: "successfully created vault for contract " + contract, data: ""};
      })
      .catch( function(err){
        if (err.code === "EEXIST") {
          throw new datona.errors.VaultError("attempt to create a vault that already exists: " + contract);
        } else {
          throw new datona.errors.VaultError("failed to create the vault - try again later", "internal error creating vault: " + err);
        }
      });
  }


  write(contract, file, data) {
    const action = (data === '!!bubble-delete!!') ? fsUnlink : fsWriteFile;
    const contractPath = this.bubblePath+contract;
    const path = contractPath+"/"+file;
    return assertVaultExists(contractPath)
      .then( () => { return fsMkdir(dirname(path), {recursive: true}) } )
      .then( () => { return action(path, data) })
      .then( () => { return {message: "successfully wrote contract/file " + contract+"/"+file, data: ""}; })
      .catch(function(err) {
        if (err.code === 'ENOENTVAULT') throw new datona.errors.VaultError("Vault does not exist");
        throw new datona.errors.VaultError("failed to write to the vault - try again later", "failed to write the vault file: " + err);
      });
  };


  createFile(contract, file, data) {
    const contractPath = this.bubblePath+contract;
    const path = contractPath+"/"+file;
    const write = this.write.bind(this);
    return fsAccess(path)
      .then( () => { return true })
      .catch( () => { return false })
      .then( (fileExists) => {
        if (fileExists) throw new datona.errors.VaultError("attempt to create a file that already exists");
        else write(contract, file, data);
      });
  }


  append(contract, file, data) { 
    const contractPath = this.bubblePath+contract;
    const path = contractPath+"/"+file;
    return assertVaultExists(contractPath)
      .then( () => { return fsMkdir(dirname(path), {recursive: true}) } )
      .then( () => { return fsAppendFile(path, data) })
      .then( () => { return {message: "successfully appended contract/file " + contract+"/"+file, data: ""}; })
      .catch(function(err) {
        if (err instanceof datona.errors.DatonaError) throw err;
        if (err.code === 'ENOENTVAULT') throw new datona.errors.VaultError("Vault does not exist");
        throw new datona.errors.VaultError("failed to append to the vault - try again later", "failed to append the vault file: " + err);
      });
  };


  read(contract, file) {
    const contractPath = this.bubblePath+contract;
    const path = contractPath+"/"+file;
    return assertVaultExists(contractPath)
      .then( () => { return fsReadFile(path) })
      .then( (buffer) => { return buffer.toString(); })
      .catch( function(err){
        if (err.code === 'ENOENTVAULT') throw new datona.errors.VaultError("Vault does not exist");
        else if (err.code === 'ENOENT') throw new datona.errors.VaultError("File does not exist");
        else throw new datona.errors.VaultError("Vault is temporarily unavailable", err.message);
      });
  };


  readDir(contract, file, options) {
    const contractPath = this.bubblePath+contract;
    const path = contractPath+"/"+file;
    return assertVaultExists(contractPath)
      .then( () => { return fsReadDir(path) })
      .then( (fileList) => {
        if (options !== undefined && options.laterThan) {
          var newFileList = fileList.filter( file => {
            return fs.statSync(path+"/"+file).mtimeMs > options.laterThan;
          });
          fileList = newFileList;
        }
        if (options !== undefined && options.mtime === true) {
          var result = [];
          fileList.forEach( file => {
            const fileDetails = { file: file, mtime: fs.statSync(path+"/"+file).mtimeMs, btime: fs.statSync(path+"/"+file).birthtimeMs };
            result.push(fileDetails);
          });
          return result;
        }
        else return fileList.join('\n');
      })
      .catch( function(err){
        if (err.code === 'ENOENTVAULT') throw new datona.errors.VaultError("Vault does not exist");
        if (err.code === 'ENOENT') return "";  // resolve empty string if directory does not exist yet
        else throw new datona.errors.VaultError("Vault is temporarily unavailable", err.message);
      });
  };


  delete(contract) {
    const contractPath = this.bubblePath+contract;
    return assertVaultExists(contractPath)
      .then( () => { fsRmdir(contractPath, {recursive: true}) })
      .catch( function(err){
        if (err.code === 'ENOENT') throw new datona.errors.VaultError("Vault does not exist");
        else throw new datona.errors.VaultError("Vault is temporarily unavaiable", err.message);
      });
  };

}


function assertVaultExists(contractPath) {
  return fsAccess(contractPath)
    .catch(  function(err) {
      if (err.code === 'ENOENT') err.code = 'ENOENTVAULT';
      throw err;
    });
}


module.exports = {
  TrivialVaultDataManager: TrivialVaultDataManager
};
