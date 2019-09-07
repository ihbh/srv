import conf from '../conf';
import KVS from '../kvs';

type Record = any; // json
let kvsdb = new KVS(conf.dirs.kvs.map);

export default new class MapDB {
  get(locptr: Buffer): Record[] {
    let data = kvsdb.get(locptr);
    return !data ? [] :
      data.toString('utf8')
        .trim()
        .split('\n')
        .map(json => JSON.parse(json));
  }

  add(locptr: Buffer, rec: Record) {
    let json = JSON.stringify(rec);
    kvsdb.append(locptr, json + '\n');
  }
};
