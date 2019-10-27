// Keeps visitors in 100m x 100m buckets.
//
// Key: (lat, lon) with 100m accuracy, 10 bytes
// Value: list of (uid, tskey) pairs

import conf, { VFS_VMAP_DIR } from '../conf';
import FSS from '../fss';
import rlog from '../log';
import * as rttv from '../rttv';
import * as vfs from '../vfs';
import Sync from '../sync';
import LRUCache from 'lru-cache';

interface Visitors {
  [uid: string]: string;
}

const cs = new Sync('vmap');
const log = rlog.fork('vmap');
const fsdb = new FSS(conf.dirs.kvs.map);
const cache = new LRUCache<string, Visitors>(1e4);

@vfs.mount(VFS_VMAP_DIR, {
  path: rttv.str(/^\/[0-9a-f]{10}$/),
  data: rttv.keyval({
    key: rttv.uid,
    val: rttv.tskey,
  }),
})
class VfsVMap {
  async get(path: string) {
    let visitors = cache.get(path);
    if (visitors) return visitors;
    visitors = {};

    let bytes = await fsdb.get(fspath(path));
    if (!bytes) return;

    let entries = bytes.toString('ascii')
      .trim().split('\n').filter(line => !!line);

    for (let entry of entries) {
      let [uid, tskey] = entry.split('=');
      if (tskey == 'null') {
        delete visitors[uid];
      } else {
        visitors[uid] = tskey;
      }
    }

    let everybody = Object.keys(visitors);
    let hidden: string[] = [];

    try {
      await Promise.all(
        everybody.map(async uid => {
          let exists = await vfs.root.exists(
            `/users/${uid}/places/${visitors[uid]}/time`)
          if (!exists)
            hidden.push(uid);
        }));
    } catch (err) {
      log.e('vmap.get() failed:', path);
      throw err;
    }

    if (hidden.length > 0) {
      log.v(`${hidden.length}/${everybody.length} visitors left.`);
      for (let uid of hidden)
        delete visitors[uid];
    }

    cache.set(path, visitors);
    return visitors;
  }

  async add(path: string, [uid, tskey]) {
    let visitors = cache.get(path);

    if (visitors) {
      let tprev = visitors[uid];
      if (!tprev || tprev < tskey)
        visitors[uid] = tskey;
      cache.set(path, visitors);
    }

    await fsdb.append(
      fspath(path),
      uid + '=' + tskey + '\n');
  }
}

function fspath(path: string) {
  return [
    path.slice(0, 3),
    path.slice(3, 5),
    path.slice(5),
  ].join('/')
}
