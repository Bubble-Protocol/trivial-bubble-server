import { BubbleError, ErrorCodes } from '@bubble-protocol/core';
import { TestPoint } from '@bubble-protocol/server/test/DataServerTestSuite/TestPoint';
import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';

export class UnitTestPoint extends TestPoint {

  constructor(basePath) {
    super();
    this.basePath = basePath;
  }

  _getPath(contract, file) {
    return this.basePath+'/'+contract+'/'+file;
  }

  async createBubble(contract) {
    // Return a `Promise` to create a bubble with the given id
    // DO NOT reject if the bubble already exists
    return new Promise((resolve, reject) => {
      exec(`mkdir -p ${this.basePath+'/'+contract}`, (error, _, stderr) => {
        if (error) reject(new Error(stderr));
        else resolve();
      });
    });
  }

  async deleteFile(contract, file) {
    // Return a `Promise` to delete the given file or directory, including any contents of the directory 
    // DO NOT reject if the file or directory does not exist
    // The `file` parameter is the `file` field from the file's `ContentId` - a string.
    return new Promise((resolve, reject) => {
      exec('rm -rf '+this._getPath(contract, file), (error, _, stderr) => {
        if (error) reject(new Error(stderr));
        else resolve();
      });
    });
  }

  async writeFile(contract, file, data) {
    // Return a `Promise` to write the given data string to the given file 
    // If the file is in a directory then create the directory if it doesn't already exist
    return new Promise((resolve, reject) => {
      function write() {
        fs.writeFile(this._getPath(contract, file), data)
        .then(resolve)
        .catch(reject);
      }
      write = write.bind(this);
      if (file.indexOf('/') > 0) this.mkdir(contract, file.slice(0, file.indexOf('/'))).then(write);
      else write();
    });
  }

  async readFile(contract, file) {
    // Return a `Promise` to resolve (as a string) the contents of the given file
    // Reject with a BubbleError with code BUBBLE_SERVER_ERROR_FILE_DOES_NOT_EXIST (see core/ErrorCodes) 
    // if the file does not exist.
    return new Promise((resolve, reject) => {
      exec('cat '+this._getPath(contract, file), (error, stdout, stderr) => {
        if (error) {
          if (stderr && (stderr.slice(-26) === 'No such file or directory\n')) 
            reject(new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_FILE_DOES_NOT_EXIST));
          else reject(new Error(stderr));
        }
        else resolve(stdout);
      });
    });
  }

  async mkdir(contract, file) {
    // Return a `Promise` to make the given directory 
    // DO NOT reject if the directory already exists
    return new Promise((resolve, reject) => {
      exec(`mkdir -p ${this._getPath(contract, file)}`, (error, _, stderr) => {
        if (error) reject(new Error(stderr));
        else resolve();
      });
    });
  }

  async assertExists(contract, file) {
    // Return a `Promise` to resolve if the file or directory exists or reject if it doesn't.
    return new Promise((resolve, reject) => {
      exec(`test -e ${this._getPath(contract, file)}`, (error, _, stderr) => {
        if (error) reject();
        else resolve();
      });
    });
  }

  async assertNotExists(contract, file) {
    // Return a `Promise` to resolve if the file or directory does not exist or reject if it does.
    return new Promise((resolve, reject) => {
      exec(`test -e ${this._getPath(contract, file)}`, (error, _, stderr) => {
        if (error && stderr) reject(new Error(stderr));
        else if (error) resolve();
        else reject();
      });
    });
  }

}