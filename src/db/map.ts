import conf from '../conf';
import KVS from '../kvs';

type Record = any; // json
let kvsdb = new KVS(conf.dirs.kvs.map);

export default new class MapDB {
  get(key: string): Record[] {
    let text = kvsdb.get(key);
    if (!text) return [];
    let json = '[' + text.trim().replace(/\n/gm, ',') + ']';
    return JSON.parse(json);
  }

  add(key: string, rec: Record) {
    let json = JSON.stringify(rec);
    kvsdb.append(key, json + '\n');
  }
};
