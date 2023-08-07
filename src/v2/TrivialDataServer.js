import { BubbleError, BubbleFilename, ErrorCodes } from '@bubble-protocol/core';
import { ROOT_PATH } from '@bubble-protocol/core/src/index.js';
import { DataServer } from '@bubble-protocol/server';
import * as fs from 'node:fs/promises';

const INTERNAL_ERROR = -32040;
const MAX_UNIX_TIME_MS = 2147483647000;

const dirname = (path) => { return path.slice(0, path.lastIndexOf('/')) }

/**
 * Trivial file-based DataServer.  Each bubble is saved to a file named after the contract address.
 */
export class TrivialDataServer extends DataServer {

  constructor(rootPath) {
    super();
    this.rootPath = rootPath.slice(-1) === '/' ? rootPath : rootPath + '/';
    this.subscriptions = [];
    this.logStatus = this.logStatus.bind(this);
    this.logStatus();
  }

  logStatus() {
    console.debug(this.rootPath, 'subscription size:', this.subscriptions.length);
    setTimeout(this.logStatus, 4*3600*1000);
  }

  create(contract, options={}) {
    const bubblePath = this.rootPath+contract;
    return fs.mkdir(bubblePath)
    .catch(err => {
      if (err.code === "EEXIST") {
        if (options.silent) return;
        else throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_BUBBLE_ALREADY_EXISTS, 'Bubble already exists')
      } else {
        throw new BubbleError(INTERNAL_ERROR, "failed to create the bubble - try again later", {cause: err.message || err});
      }
    });
  }
  

  write(contract, file, data) {
    const bubblePath = this.rootPath+contract;
    return assertBubbleExists(bubblePath)
    .then(() => {
      const path = bubblePath+'/'+file;
      return fs.mkdir(dirname(path), {recursive: true})
      .then(() => fs.writeFile(path, data))
      .then(() => {
        this._notifySubscribers(path, contract, file, 'write', data);
      })
      .catch(err => {
        throw new BubbleError(INTERNAL_ERROR, "failed to write file - try again later", {cause: err.message || err});
      });
    });
  }


  append(contract, file, data) {
    const bubblePath = this.rootPath+contract;
    return assertBubbleExists(bubblePath)
    .then(() => {
      const path = bubblePath+'/'+file;
        return fs.mkdir(dirname(path), {recursive: true})
        .then(() => fs.appendFile(path, data))
        .then(() => {
          this._notifySubscribers(path, contract, file, 'append', data);
        })
        .catch(err => {
          throw new BubbleError(INTERNAL_ERROR, "failed to append file - try again later", {cause: err.message || err});
        });
    });
  }


  read(contract, file, options={}) {
    const bubblePath = this.rootPath+contract;
    return assertBubbleExists(bubblePath)
    .then(() => {
      return fs.readFile(bubblePath+'/'+file)
      .then((buf => {
        return buf.toString();
      }))
      .catch(err => {
        if (err.code === 'ENOENT') {
          if (options.silent) return '';
          throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_FILE_DOES_NOT_EXIST, 'file does not exist');
        }
        else throw new BubbleError(INTERNAL_ERROR, "failed to read file - try again later", {cause: err.message || err});
      });
    });
  }


  delete(contract, file, options={}) {
    const bubblePath = this.rootPath+contract;
    return assertBubbleExists(bubblePath)
    .then(() => {
      const path = bubblePath+'/'+file;
      return fs.stat(path)
      .then(stats => {
        return fs.rm(path, {recursive: stats.isDirectory()})
          .then(() => {
            this._notifySubscribers(path, contract, file, 'delete', undefined, stats.isDirectory() ? 'dir' : 'file');
          })
      })
      .catch(err => {
        if (err.code === 'ENOENT') {
          if (options.silent) return undefined;
          throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_FILE_DOES_NOT_EXIST, 'file does not exist');
        }
        else throw new BubbleError(INTERNAL_ERROR, "failed to delete file or directory - try again later", {cause: err.message || err});
      });
    });
  }


  mkdir(contract, file, options={}) {
    const bubblePath = this.rootPath+contract;
    return assertBubbleExists(bubblePath)
    .then(() => {
      return fs.mkdir(bubblePath+'/'+file)
      .catch(err => {
        if (err.code === 'EEXIST') {
          if (options.silent) return undefined;
          throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_DIR_ALREADY_EXISTS, 'directory already exists');
        }
        else throw new BubbleError(INTERNAL_ERROR, "failed to make directory - try again later", {cause: err.message || err});
      });
    })
    .then(() => { this._notifySubscribers(bubblePath+'/'+file, contract, file, 'mkdir') })
  }


  list(contract, file, options={}) { 
    const bubblePath = this.rootPath+contract;
    const isRoot = file === ROOT_PATH;
    const path = isRoot ? bubblePath : bubblePath+'/'+file
    return assertBubbleExists(bubblePath)
    .then(() => fs.stat(path))
    .then(stats => {
      if (stats.isDirectory()) return listDirectory(bubblePath, file, isRoot, options);
      else {
        const details = {
          name: file, 
          type: 'file',
          created: Math.trunc(stats.birthtimeMs),
          modified: Math.trunc(stats.mtimeMs),
          length: stats.size
        };
        return filterFileList([details], options);
      }
    })
    .catch(err => {
      if (err instanceof BubbleError) throw err;
      if (err.code === 'ENOENT') {
        if (options.silent) return [];
        throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_FILE_DOES_NOT_EXIST, 'file does not exist');
      }
      else throw new BubbleError(INTERNAL_ERROR, "failed to list file or directory - try again later", {cause: err.message || err});
    });
  }

  subscribe(contract, file, listener, options={}) {
    console.debug(this.rootPath, 'subscribe', contract, file, this.subscriptions.length);
    const bubblePath = this.rootPath+contract;
    const isRoot = file === ROOT_PATH;
    const path = isRoot ? bubblePath : bubblePath+'/'+file
    return assertBubbleExists(bubblePath)
      .then(() => {
        return getFileStats(path, file);
      })
      .then(stats => {
        this.subscriptions.push({contract, file, listener, options});
        const id = this.subscriptions.length-1;
        if (stats.type) {
          if (options.since !== undefined) return this.list(contract, file, {long: true, after: options.since}).then(list => { return {subscriptionId: id, file: stats, data: list} });
          if (options.list === true) return this.list(contract, file, {long: true}).then(list => { return {subscriptionId: id, file: stats, data: list} });
          if (options.read) return this.read(contract, file).then(data => { return {subscriptionId: id, file: stats, data: data} });
        }
        return {subscriptionId: id, file: stats};
      })
  }

  unsubscribe(subscriptionId) {
    if (typeof subscriptionId === 'number' && subscriptionId >= 0 && subscriptionId < this.subscriptions.length) this.subscriptions[subscriptionId] = {};
    return Promise.resolve();
  }

  unsubscribeClient(subs) {
    console.debug(this.rootPath, 'unsubscribeClient', subs);
    subs.forEach(subscriptionId => {
      if (typeof subscriptionId === 'number' && subscriptionId >= 0 && subscriptionId < this.subscriptions.length) this.subscriptions[subscriptionId] = {};
    })
  }

  terminate(contract, options={}) {
    const bubblePath = this.rootPath+contract;
    return assertBubbleExists(bubblePath)
    .then(() => {
      return fs.rm(bubblePath, {recursive: true})
      .catch(err => { 
          throw new BubbleError(INTERNAL_ERROR, "failed to delete bubble - try again later", {cause: err.message || err});
      });
    })
    .catch(err => { 
      if (options.silent && err.code === ErrorCodes.BUBBLE_SERVER_ERROR_BUBBLE_DOES_NOT_EXIST) return undefined;
      else throw err;
    })
  }

  _notifySubscribers(path, contract, file, event, data, type) {
    const promise = (event === 'delete') ? Promise.resolve({name: file, type: type}) : getFileStats(path, file);
    return promise
      .then(stats => {
        this.subscriptions.forEach((sub, i) => {
          if (sub.contract === contract && sub.file === file) {
            sub.listener({
              subscriptionId: i,
              event: event,
              file: stats,
              data: event === 'delete' || (type === 'file' && sub.options.list) ? undefined : data
            })
          }
        })
        return stats;
      })
      .then(stats => {
        if (file !== ROOT_PATH) {
          const bubblePath = this.rootPath+contract;
          const permissionedPart = new BubbleFilename(file).getPermissionedPart();
          if (permissionedPart === file) return this._notifySubscribers(bubblePath, contract, ROOT_PATH, 'update', [{event: event, ...stats}]);
          else return this._notifySubscribers(bubblePath+'/'+permissionedPart, contract, permissionedPart, 'update', [{event: event, ...stats}]);
        }
      })
  }

}


async function assertBubbleExists(bubblePath) {
  return fs.access(bubblePath)
  .catch(err => { 
    if (err.code === 'ENOENT')
      throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_BUBBLE_DOES_NOT_EXIST, 'Bubble does not exist');
    else throw new BubbleError(INTERNAL_ERROR, "failed to access bubble - try again later");
  });
}


async function listDirectory(basePath, dir, isRoot, options) {

  const path = isRoot ? basePath : basePath + '/' + dir;

  var fileList = 
    options.directoryOnly 
      ? [{name: dir, path: path, isDirectory: () => true}]
      : await fs.readdir(path, {withFileTypes: true});

  if (!isRoot) basePath = path;

  // filter based on matches regex
  if (options.matches) {
    var regex;
    try {
      regex = new RegExp(options.matches);
    }
    catch(_) {
      throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_INVALID_OPTION, 'matches option must be a regex');
    }
    fileList = fileList.filter(f => {
      const name = options.directoryOnly || isRoot ? f.name : dir+'/'+f.name;
      return regex.test(name)
    });
  }

  // if only name and type are needed then no need to stat each file
  if ( !( options.long || options.length || options.created || options.modified || 
    options.before || options.after || options.createdBefore || options.createdAfter))
  {
    return fileList.map(f => { 
      const name = options.directoryOnly || isRoot ? f.name : dir+'/'+f.name;
      return {
        name: name,
        type: f.isDirectory() ? 'dir' : 'file'
      }
    })
  }

  // Get all stats
  fileList = await Promise.all(
    fileList.map(async f => {
      const fPath = f.path || basePath+'/'+f.name
      return fs.stat(fPath)
        .then(stats => { 
          const name = options.directoryOnly || isRoot ? f.name : dir+'/'+f.name;
          const result = {
            name: name, 
            type: f.isDirectory() ? 'dir' : 'file',
            created: Math.trunc(stats.birthtimeMs),
            modified: Math.trunc(stats.mtimeMs),
            length: stats.size
          };
          if (!f.isDirectory() || !(options.length || options.long)) return result;
          else return fs.readdir(fPath)
            .then(d => {
              result.length = d.length;
              return result;
            })
        })
    })
  );

  return filterFileList(fileList, options);
}


function filterFileList(fileList, options) {

  if (options.before !== undefined && typeof options.before !== 'number') 
    throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_INVALID_OPTION, "invalid before option");
  if (options.after !== undefined && typeof options.after !== 'number') 
    throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_INVALID_OPTION, "invalid after option");
  if (options.createdBefore !== undefined && typeof options.createdBefore !== 'number') 
    throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_INVALID_OPTION, "invalid createdBefore option");
  if (options.createdAfter !== undefined && typeof options.createdAfter !== 'number') 
    throw new BubbleError(ErrorCodes.BUBBLE_SERVER_ERROR_INVALID_OPTION, "invalid createdAfter option");


  // Filter based on time options
  if (options.before || options.after || options.createdBefore || options.createdAfter) {
    const mBefore = options.before || MAX_UNIX_TIME_MS;
    const mAfter = options.after || 0;
    const cBefore = options.createdBefore || MAX_UNIX_TIME_MS;
    const cAfter = options.createdAfter || 0;
    fileList = fileList.filter(f => {
      return f.modified > mAfter && f.modified < mBefore && f.created > cAfter && f.created < cBefore
    });
  }

  return fileList.map(f => {
    const details = {
      name: f.name,
      type: f.type
    }
    if (options.long || options.length) details.length = f.length;
    if (options.long || options.created) details.created = f.created;
    if (options.long || options.modified) details.modified = f.modified;
    return details;
  });
  
}


function getFileStats(path, file, options={}) { 
  return fs.stat(path)
  .then(stats => {
    if (stats.isDirectory()) return fs.readdir(path).then(files => { stats.size = files.length; return stats })
    else return stats;
  })
  .then(stats => {
    return {
      name: file, 
      type: stats.isDirectory() ? 'dir' : 'file',
      created: Math.trunc(stats.birthtimeMs),
      modified: Math.trunc(stats.mtimeMs),
      length: stats.size
    };
  })
  .catch(err => {
    if (err.code === 'ENOENT') return {name: file}
    if (err instanceof BubbleError) throw err;
    throw new BubbleError(INTERNAL_ERROR, "failed to stat file or directory - try again later", {cause: err.message || err});
  });
}

