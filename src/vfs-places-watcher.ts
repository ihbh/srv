import { getGpsPtr } from './gpsptr';
import * as vfs from './vfs';
import { log } from './log';

@vfs.watch('/users/*/places/*/*')
class UserPlacesWatcher {
  onchanged(path: string, [uid, tskey, prop]: string[]) {
    if (!/^(lat|lon|time)$/.test(prop))
      return;
    let base = `/users/${uid}/places/${tskey}`;
    let lat = vfs.root.get(base + '/lat');
    let lon = vfs.root.get(base + '/lon');
    let time = vfs.root.get(base + '/time');
    if (!lat || !lon || !time) return;
    let key = getGpsPtr(lat, lon).toString('hex');
    log.v('Adding a visitor to gps ptr:', key);
    vfs.root.add('/vmap/' + key, [uid, tskey]);
  }
}
