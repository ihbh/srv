import rlog from '../log';
import * as vfs from '../vfs';

const log = rlog.fork('feedbacks-watcher');

@vfs.watch('/users/*/feedbacks/*', {
  sync: true,
  process(changes: Set<string>, [, uid, time]) {
    changes = changes || new Set;
    changes.add(uid + ':' + time);
    return changes;
  },
})
class UserFeedbacksWatcher {
  onchanged(changes: Set<string>) {
    for (let key of changes) {
      let [uid, time] = key.split(':');
      let path = `/feedbacks/${time}`;
      log.v(`New feedback from ${uid} at ${time}`);
      vfs.root.set(path, uid);
    }
  }
}
