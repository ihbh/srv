import FSS from '../fss';
import { VFS } from '../vfs';

const BASE64 = 'base64:';

export default class FileFS implements VFS {
  private fsdb: FSS;
  private fname: string;
  private cache: Map<string, any>;

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

  set(path: string, data) {
    checkpath(path);
    if (this.cache) {
      let prev = jsonget(this.cache, path);
      if (prev === data) return;
    }
    let kvpair = path + '=' + serialize(data);
    this.fsdb.append(this.fname, kvpair + '\n');
    this.cache && jsonset(this.cache, path, data);
  }

  get(path: string) {
    checkpath(path);
    let root = this.refresh();
    let node = jsonget(root, path);
    if (node instanceof Map)
      return null;
    return node;
  }

  dir(path: string) {
    if (path) checkpath(path);
    let root = this.refresh();
    if (!path) return [...root.keys()];
    let node = jsonget(root, path);
    if (node instanceof Map)
      return [...node.keys()];
    return null;
  }

  exists(path: string) {
    let data = this.get(path);
    return data !== null;
  }

  rm(path: string) {
    this.set(path, null);
  }

  private refresh() {
    if (this.cache) return this.cache;
    let root = new Map<string, any>();
    let bytes = this.fsdb.get(this.fname);
    if (!bytes) return this.cache = root;
    let kvpairs = bytes.toString('utf8').split('\n');

    for (let kvpair of kvpairs) {
      try {
        let i = kvpair.indexOf('=');
        if (i < 0) throw new Error('Missing =.');
        let path = kvpair.slice(0, i);
        let json = kvpair.slice(i + 1);
        let data = deserialize(json);
        jsonset(root, path, data);
      } catch (err) {
        throw new Error('Failed to parse kv pair: ' + kvpair);
      }
    }

    return this.cache = root;
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
