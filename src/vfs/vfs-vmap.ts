// Keeps visitors in 100m x 100m buckets.
//
// Key: (lat, lon) with 100m accuracy, 10 bytes
// Value: list of (uid, tskey) pairs

import conf, { VFS_VMAP_DIR } from '../conf';
import FSS from '../fss';
import rlog from '../log';
import * as rttv from '../rttv';
import * as vfs from '../vfs';
import LRUCache from 'lru-cache';
import JsonFS from './vfs-file';

interface Visitors {
  [uid: string]: string;
}

const log = rlog.fork('vmap');
const fsdb = conf.memfs ?
  new JsonFS(null) :
  new FSS(conf.dirs.kvs.map);
const cache = new LRUCache<string, string[]>(
  conf.cache.vmap.maxsize);

@vfs.mount(VFS_VMAP_DIR, {
  path: rttv.str(/^\/[0-9a-f]{10}$/),
  data: rttv.keyval({
    key: rttv.uid,
    val: rttv.tskey,
  }),
})
class VfsVMap {
  async get(path: string) {
    let lines = await getRawPairs(path);
    if (!lines) return {};
    cache.set(path, lines);

    let visitors = parseRawPairs(lines);
    let uids2 = await findLeftVisitors(visitors);
    removeLeftVisitors(visitors, uids2);
    return visitors;
  }

  add(path: string, [uid, tskey]) {
    let pair = uid + '=' + tskey;
    let lines = cache.get(path) || [];
    lines.push(pair);
    cache.set(path, lines);

    fsdb.add(
      fspath(path),
      pair + '\n');
  }
}

async function getRawPairs(path: string) {
  let lines = cache.get(path);

  if (!lines) {
    let bytes = await fsdb.get(fspath(path));
    lines = bytes && bytes.toString('utf8')
      .trim().split('\n')
      .filter(line => !!line);
  }

  return lines;
}

function parseRawPairs(lines: string[]): Visitors {
  let visitors: Visitors = {};

  for (let entry of lines) {
    let [uid, tskey] = entry.split('=');
    if (tskey == 'null') {
      delete visitors[uid];
    } else {
      visitors[uid] = tskey;
    }
  }

  return visitors;
}

async function findLeftVisitors(visitors: Visitors) {
  let uids = Object.keys(visitors);
  let uids2: string[] = [];

  await Promise.all(
    uids.map(async uid => {
      let exists = await vfs.root.exists(
        `/users/${uid}/places/${visitors[uid]}/time`)
      if (!exists)
        uids2.push(uid);
    }));

  return uids2;
}

function removeLeftVisitors(visitors: Visitors, uids2: string[]) {
  if (!uids2.length)
    return;
  log.v(`${uids2.length} visitors left.`);
  for (let uid of uids2)
    delete visitors[uid];
}

function fspath(path: string) {
  return [
    path.slice(0, 3),
    path.slice(3, 5),
    path.slice(5),
  ].join('/')
}
