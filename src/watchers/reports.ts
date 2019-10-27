import rlog from '../log';
import * as vfs from '../vfs';

const log = rlog.fork('reports-watcher');

@vfs.watch('/users/*/reports/*', {
  sync: true,
  process(changes: Set<string>, [, u1, u2]) {
    changes = changes || new Set;
    changes.add([u1, u2].join(':'));
    return changes;
  },
})
class UserReportsWatcher {
  async onchanged(changes: Set<string>) {
    for (let key of changes) {
      let [u1, u2] = key.split(':'); // u1 reported u2
      let path = `/reports/${u2}/${u1}`;
      let time = new Date().toJSON();
      log.v(`New report from ${u1} to ${u2} at ${time}`);
      await vfs.root.set(path, time);
    }
  }
}
