import conf, { VFS_REPORTS_DIR } from './conf';
import FSS from './fss';
import * as rttv from './rttv';
import * as vfs from './vfs';

const fsdb = new FSS(conf.dirs.kvs.reports);

@vfs.mount(VFS_REPORTS_DIR, {
  path: rttv.ascii(),
  data: rttv.ascii(),
})
class VfsReports {
  set(path: string, data: string) {
    fsdb.set(path, data);
  }
}
