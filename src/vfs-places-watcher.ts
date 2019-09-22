import { getGpsPtr } from './gpsptr';
import { log } from './log';
import * as vfs from './vfs';

@vfs.watch('/users/*/places/*/*', {
  wpid: (path, uid, tskey, prop) =>
    /^(lat|lon)$/.test(prop) ? uid + ':' + tskey : null,
})
class UserPlacesWatcher {
  onchanged(uidtskey: string) {
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
