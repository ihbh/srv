import conf, { VFS_USERS_DIR } from '../conf';
import RPool from '../rpool';
import * as rttv from '../rttv';
import * as vfs from '../vfs';
import JsonFS from './vfs-file';

const fsdbpool = new RPool('users',
  conf.cache.maxUserDbSize, createJsonFS);

const tSchema = rttv.keyval({
  key: rttv.uid,
  val: rttv.subset({
    profile: rttv.subset({
      id: rttv.uid,
      name: rttv.str(/^\w{3,20}$/),
      info: rttv.ascii(0, 1024),
      img: rttv.dataurl('image/jpeg'),
      pubkey: rttv.pubkey,
    }),
    places: rttv.keyval({
      key: rttv.tskey,
      val: rttv.subset({
        time: rttv.timesec,
        lat: rttv.lat,
        lon: rttv.lon,
      }),
    }),
    // Feedbacks from /users/<uid>/<ts> are mapped to /feedbacks/<day>/<sec>=<uid>
    feedbacks: rttv.keyval({
      key: rttv.jsontime,
      val: rttv.ascii(0, 1024),
    }),
    // Abuse reports from u1 to u2 go to /users/<u1>/reports/<u2>.
    reports: rttv.keyval({
      key: rttv.uid, // remote user id
      val: rttv.ascii(0, 1024),
    }),
    // Messages from u1 to u2 go to /users/<u1>/chats/<u2>/<time>/text.
    // However u2 can read this dir too to get incoming messages.
    chats: rttv.keyval({
      key: rttv.uid, // remote user id
      val: rttv.keyval({
        key: rttv.jsontime,
        val: rttv.dict({
          text: rttv.ascii(),
        }),
      }),
    }),
    // Timestamp of the last unread message from u2 goes to /users/<u1>/unread/<u2>.
    // Once message is seen, this entry is deleted.
    unread: rttv.keyval({
      key: rttv.uid,
      val: rttv.nullor(rttv.jsontime),
    }),
  }),
});

@vfs.mount(VFS_USERS_DIR, {
  path: rttv.str(/^\/[\da-f]{16}(\/.+)?$/),
  data: rttv.json,
  schema: tSchema,
})
class VfsUser implements vfs.VFS {
  invoke(fsop: keyof vfs.VFS, path: string, ...args) {
    let { uid, key } = parsePath(path);
    let fsdb = fsdbpool.get(uid);
    return fsdb.invoke(fsop, key, ...args);
  }
}

function parsePath(vfspath: string) {
  let uid = vfspath.slice(1, 17);
  let key = vfspath.slice(17); // e.g. "/profile/name"
  return { uid, key };
}

function createJsonFS(uid: string) {
  let path = [
    conf.dirs.kvs.user,
    uid.slice(0, 3),
    uid.slice(3, 6),
    uid.slice(6),
  ].join('/');
  return new JsonFS(conf.memfs ? null : path);
}
