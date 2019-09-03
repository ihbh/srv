import conf from './conf';
import KVS from './kvs';

interface UserDetails {
  name: string;
  info: string;
  photo: string;
  pubkey: string;
}

let kvsdb = new KVS(conf.dirs.kvs.user);

export default new class {
  get(uid: string): UserDetails {
    let json = kvsdb.get(uid);
    return JSON.parse(json);
  }

  set(uid: string, details: UserDetails) {
    let json = JSON.stringify(details);
    kvsdb.set(uid, json);
  }
};
