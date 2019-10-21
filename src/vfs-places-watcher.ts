import { getGpsPtr } from './gpsptr';
import rlog from './log';
import * as vfs from './vfs';

const log = rlog.fork('places-watcher');

@vfs.watch('/users/*/places/*/*', {
  process(changes: Set<string>, [, uid, tskey, prop]) {
    changes = changes || new Set;
    if (/^(lat|lon)$/.test(prop))
      changes.add(uid + ':' + tskey);
    return changes;
  }
})
class UserPlacesWatcher {
  onchanged(changes: Set<string>) {
    for (let uidtskey of changes) {
      let [uid, tskey] = uidtskey.split(':');
      let base = `/users/${uid}/places/${tskey}`;
      let lat = vfs.root.get(base + '/lat');
      let lon = vfs.root.get(base + '/lon');
      if (!lat || !lon) return;
      let key = getGpsPtr(lat, lon).toString('hex');
      log.v('Adding a visitor to gps ptr:', key);
      vfs.root.add('/vmap/' + key, [uid, tskey]);
    }
  }
}
