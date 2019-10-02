// Keeps visitors in 100m x 100m buckets.
//
// Key: (lat, lon) with 100m accuracy, 10 bytes
// Value: list of (uid, tskey) pairs

import conf, { VFS_VMAP_DIR } from './conf';
import FSS from './fss';
import rlog from './log';
import * as rttv from './rttv';
import * as vfs from './vfs';

const log = rlog.fork('vfs-map');
const fsdb = new FSS(conf.dirs.kvs.map);

@vfs.mount(VFS_VMAP_DIR, {
  path: rttv.str(/^\/[0-9a-f]{10}$/),
  data: rttv.keyval({
    key: rttv.uid,
    val: rttv.tskey,
  }),
})
class VfsVMap {
  get(path: string) {
    let bytes = fsdb.get(fspath(path));
    if (!bytes) return {};

    let entries = bytes.toString('ascii')
      .trim().split('\n');

    let visitors: { [uid: string]: string } = {};

    for (let entry of entries) {
      let [uid, tskey] = entry.split('=');
      if (tskey == 'null') {
        delete visitors[uid];
      } else {
        visitors[uid] = tskey;
      }
    }

    let everybody = Object.keys(visitors);
    let hidden = everybody.filter(uid =>
      !vfs.root.exists(
        `/users/${uid}/places/${visitors[uid]}/time`));

    if (hidden.length > 0) {
      log.v(`${hidden.length}/${everybody.length} visitors left.`);
      for (let uid of hidden)
        delete visitors[uid];
    }

    return visitors;
  }

  add(path: string, [uid, tskey]) {
    fsdb.append(
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
