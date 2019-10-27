import conf, { VFS_FEEDBACKS_DIR } from '../conf';
import FSS from '../fss';
import * as rttv from '../rttv';
import * as vfs from '../vfs';

const fsdb = new FSS(conf.dirs.kvs.feedbacks);

@vfs.mount(VFS_FEEDBACKS_DIR, {
  path: rttv.anything,
  data: rttv.uid,
})
class VfsReports {
  async set(path: string, uid: string) {
    let time = path.slice(1);
    rttv.jsontime.verifyInput(time);
    let tday = time.slice(0, 10); // yyyy-dd-mm
    await fsdb.append(tday, time + ':' + uid + '\n');
  }
}
