// FS within a file.

import FSS from '../fss';
import { VFS } from '../vfs';
import conf from '../conf';
import Task from '../task';
import rlog from '../log';

const B64_PREFIX = 'b:';
const NUM_PREFIX = 'n:';

const log = rlog.fork('jsonfs');

type CacheDir = Map<string, any>;

const isdir = node => node instanceof Map;

export default class JsonFS implements VFS {
  private fsdb: VFS | null;
  private fname: string;
  private cache: Map<string, any>;
  private files: Map<string, any>;
  private pending: string[] = [];
  private ptasks: Task<void>[] = [];
  private ptimer: NodeJS.Timeout;

  constructor(filepath: string | null) {
    if (!filepath) return;
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
    return (this[fsop] as any)(path, ...args);
  }

  async set(path: string, data) {
    checkpath(path);
    if (this.cache) {
      let prev = this.jsonget(path);
      if (prev === data) return;
    }
    let kvpair = path + '=' + serialize(data);
    this.cache && this.jsonset(path, data);
    await this.schedule(kvpair);
  }

  async get(path: string) {
    checkpath(path);
    await this.refresh();
    let node = this.jsonget(path);
    if (isdir(node))
      return null;
    return node;
  }

  async add(path: string, data) {
    let list = (await this.get(path)) || [];
    list.push(data);
    await this.set(path, list);
  }

  async dir(path: string) {
    if (path) checkpath(path);
    await this.refresh();
    if (!path) return [...this.cache.keys()];
    let node = this.jsonget(path);
    if (isdir(node))
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
    if (this.cache) return;
    await this.pflush();
    this.cache = new Map;
    this.files = new Map;
    let bytes = this.fsdb &&
      await this.fsdb.get(this.fname);
    if (!bytes) return;

    let kvpairs = bytes.toString('utf8')
      .split('\n');

    for (let kvpair of kvpairs) {
      try {
        if (!kvpair) continue;
        let i = kvpair.indexOf('=');
        if (i < 0) throw new Error('Missing =.');
        let path = kvpair.slice(0, i);
        let json = kvpair.slice(i + 1);
        let data = deserialize(json);
        this.jsonset(path, data);
      } catch (err) {
        throw new Error(
          'Failed to parse kv pair: ' + JSON.stringify(kvpair));
      }
    }
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
      this.fsdb &&
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

  private jsonleaf(path: string, create: boolean): [CacheDir, string] {
    checkpath(path);
    let i = 0, j = path.indexOf('/', 1);
    let node = this.cache;

    for (; j > 0; i = j, j = path.indexOf('/', i + 1)) {
      let key = path.slice(i + 1, j);
      let next = node.get(key);
      if (!next) {
        if (!create) return null;
        node.set(key, next = new Map);
        this.files.set(path.slice(0, j), next);
      }
      node = next;
    }

    let name = path.slice(i + 1);
    return [node, name];
  }

  private jsonset(path: string, data) {
    let [node, name] = this.jsonleaf(path, true);

    if (isdir(node.get(name)))
      throw new Error(`FileFS ${path} is already a dir.`);

    if (data === null)
      node.delete(name);
    else
      node.set(name, data);

    this.files.set(path, data);
  }

  private jsonget(path: string) {
    let data = this.files.get(path);
    return data === undefined ? null : data;
  }
}

function checkpath(path: string) {
  if (path[0] != '/' || path[path.length - 1] == '/')
    throw new Error('Invalid FileFS path: ' + path);
}

function serializeNum(x: number) {
  let a = new Float32Array([x]);
  let b = Buffer.from(a.buffer);
  return b.toString('hex');
}

function deserializeNum(s: string) {
  let b = Buffer.from(s, 'hex');
  let a = new Float32Array(b);
  return a[0];
}

function serialize(data) {
  if (data === undefined)
    throw new Error('FileFS: data=undefined');
  if (data instanceof Buffer)
    return B64_PREFIX + data.toString('base64');
  if (typeof data == 'number')
    return NUM_PREFIX + serializeNum(data);
  return JSON.stringify(data);
}

function deserialize(json: string) {
  if (json.startsWith(B64_PREFIX))
    return Buffer.from(json.slice(B64_PREFIX.length), 'base64');
  if (json.startsWith(NUM_PREFIX))
    return deserializeNum(json.slice(NUM_PREFIX.length));
  return JSON.parse(json);
}
