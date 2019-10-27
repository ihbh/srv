import rlog from '../log';
import * as vfs from '../vfs';

const log = rlog.fork('chats-watcher');

@vfs.watch('/users/*/chats/*/*/text', {
  sync: true,
  process(keys: Set<string>, [, u1, u2, time]) {
    keys = keys || new Set;
    keys.add([u1, u2, time].join(':'));
    return keys;
  },
})
class UserChatsWatcher {
  async onchanged(keys: Set<string>) {
    for (let key of keys) {
      let [u1, u2, time] = key.split(':');
      let path = `/users/${u2}/unread/${u1}`;
      let prev = await vfs.root.get(path);
      if (!prev || prev < time) {
        log.v(`New unread message from ${u1} to ${u2} at ${time}.`);
        await vfs.root.set(path, time);
      }
    }
  }
}
