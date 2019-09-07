import conf from '../conf';
import KVS from '../kvs';

interface UserDetails {
  name: string;
  info: string;
  photo: string;
  pubkey: string;
}

let kvsdb = new KVS(conf.dirs.kvs.user);

export default new class UsersDB {
  get(uid: Buffer): UserDetails {
    let data = kvsdb.get(uid);
    if (!data) return null;
    let json = data.toString('utf8');
    return JSON.parse(json);
  }

  set(uid: Buffer, details: UserDetails) {
    let json = JSON.stringify(details);
    kvsdb.set(uid, json);
  }
};
