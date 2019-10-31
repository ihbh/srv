// FS within a file.

import FSS from '../fss';
import { VFS } from '../vfs';
import conf from '../conf';
import Task from '../task';
import rlog from '../log';

const BASE64 = 'base64:';

const log = rlog.fork('textfs');

export default class FileFS implements VFS {
  private fsdb: FSS;
  private fname: string;
  private cache: Map<string, any>;
  private pending: string[] = [];
  private ptasks: Task<void>[] = [];
  private ptimer: NodeJS.Timeout;

  constructor(filepath: string) {
    let i = filepath.lastIndexOf('/');
    if (i < 0) throw new Error(
      'Invalid FileFS filepath: ' + filepath);
    let dir = filepath.slice(0, i);
    this.fsdb = new FSS(dir);
    this.fname = filepath.slice(i + 1);
  }

  invoke(fsop: keyof VFS, path: string, ...args) {
    if (!this[fsop]) throw new Error(
      'FileFS.' + fsop + ' not supported');
    return this[fsop](path, ...args);
  }

  async set(path: string, data) {
    checkpath(path);
    if (this.cache) {
      let prev = jsonget(this.cache, path);
      if (prev === data) return;
    }
    let kvpair = path + '=' + serialize(data);
    this.cache && jsonset(this.cache, path, data);
    await this.schedule(kvpair);
  }

  async get(path: string) {
    checkpath(path);
    let root = await this.refresh();
    let node = jsonget(root, path);
    if (node instanceof Map)
      return null;
    return node;
  }

  async dir(path: string) {
    if (path) checkpath(path);
    let root = await this.refresh();
    if (!path) return [...root.keys()];
    let node = jsonget(root, path);
    if (node instanceof Map)
      return [...node.keys()];
    return null;
  }

  async exists(path: string) {
    let data = await this.get(path);
    return data !== null;
  }

  async rm(path: string) {
    await this.set(path, null);
  }

  private async refresh() {
    if (this.cache)
      return this.cache;
    await this.pflush();
    let root = new Map<string, any>();
    let bytes = await this.fsdb.get(this.fname);
    if (!bytes) return this.cache = root;

    let kvpairs = bytes.toString('utf8').split('\n');

    for (let kvpair of kvpairs) {
      try {
        if (!kvpair) continue;
        let i = kvpair.indexOf('=');
        if (i < 0) throw new Error('Missing =.');
        let path = kvpair.slice(0, i);
        let json = kvpair.slice(i + 1);
        let data = deserialize(json);
        jsonset(root, path, data);
      } catch (err) {
        throw new Error(
          'Failed to parse kv pair: ' + JSON.stringify(kvpair));
      }
    }

    return this.cache = root;
  }

  private async schedule(kvpair: string) {
    let task = new Task<void>();
    this.pending.push(kvpair);
    this.ptasks.push(task);
    this.ptimer = this.ptimer || setTimeout(
      () => this.pflush(),
      conf.vfs.batch.timeout);
    return task.promise;
  }

  private async pflush() {
    if (!this.ptimer)
      return;

    clearTimeout(this.ptimer);
    this.ptimer = null;

    if (!this.pending.length)
      return;

    let pairs = this.pending.splice(0);
    let tasks = this.ptasks.splice(0);

    log.v('pflush()', tasks.length);

    try {
      await this.fsdb.add(this.fname,
        pairs.join('\n') + '\n');
    } catch (err) {
      log.e('pflush()', tasks.length, err);
      for (let task of tasks)
        task.reject(err);
    }

    for (let task of tasks)
      task.resolve();
  }
}

function checkpath(path: string) {
  if (path[0] != '/' || path[path.length - 1] == '/')
    throw new Error('Invalid FileFS path: ' + path);
}

function jsonset(root: Map<string, any>, path: string, data) {
  let keys = path.split('/');
  let node = root;

  for (let key of keys.slice(1, -1)) {
    let next = node.get(key);
    if (!next) node.set(key, next = new Map);
    node = next;
  }

  let name = keys.pop();
  if (node.get(name) instanceof Map)
    throw new Error(`FileFS ${path} is already a dir.`);
  if (data === null)
    node.delete(name);
  else
    node.set(name, data);
}

function jsonget(root: Map<string, any>, path: string) {
  let keys = path.split('/');
  let node = root;

  for (let key of keys.slice(1, -1)) {
    let next = node.get(key);
    if (!next) return null;
    node = next;
  }

  let name = keys.pop();
  let data = node.get(name);
  return data === undefined ? null : data;
}

function serialize(data) {
  if (data === undefined)
    throw new Error('FileFS: data=undefined');
  return data instanceof Buffer ?
    BASE64 + data.toString('base64') :
    JSON.stringify(data);
}

function deserialize(json: string) {
  return json.startsWith(BASE64) ?
    Buffer.from(json.slice(BASE64.length), 'base64') :
    JSON.parse(json);
}
