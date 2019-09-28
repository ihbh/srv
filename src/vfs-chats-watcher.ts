import rlog from './log';
import * as vfs from './vfs';

const log = rlog.fork('chats-watcher');

@vfs.watch('/users/*/chats/*/*/text', {
  sync: true,
  wpid: (path, u1, u2, time) =>
    [u1, u2, time].join(':'),
})
class UserChatsWatcher {
  onchanged(key: string) {
    let [u1, u2, time] = key.split(':');
    let path = `/users/${u2}/unread/${u1}`;
    let prev = vfs.root.get(path);
    if (!prev || prev < time) {
      log.v(`New unread message from ${u1} to ${u2} at ${time}.`);
      vfs.root.set(path, time);
    }
  }
}
