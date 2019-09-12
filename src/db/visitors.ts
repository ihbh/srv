// Keeps visitors in 100m x 100m buckets.
//
// Key: (lat, lon) with 100m accuracy, 10 bytes
// Value: list of (uid, ts) pairs

import conf from '../conf';
import KVS from '../kvs';

interface Entry {
  uid: string;
  tskey: string;
}

let db = new KVS(conf.dirs.kvs.map);

function writeLine(e: Entry) {
  return e.uid + ':' + e.tskey;
}

function parseLine(line: string) {
  let i = line.indexOf(':');
  let uid = line.slice(0, i);
  let tskey = line.slice(i + 1);
  return { uid, tskey };
}

export default new class {
  get(locptr: Buffer): Entry[] {
    let data = db.get(locptr);
    return !data ? [] :
      data.toString('utf8')
        .trim() // trailing \n
        .split('\n')
        .map(parseLine);
  }

  add(locptr: Buffer, entry: Entry) {
    db.append(locptr, writeLine(entry) + '\n');
  }
};
