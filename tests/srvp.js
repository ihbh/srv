const cp = require('child_process');
const fs = require('fs');
const mkdirp = require('mkdirp');
const cmd = require('./cmdline');
const path = require('path');
const log = require('./flog');

const BIN_PATH = 'bin/src/index';
const CONF_PATH = './conf.json';
const SRV_PORT = 42817;
const CPU_PROF_FILE = /^isolate-/;
const WAIT_MESSAGE = 'Listening on port';

class ServerProcess {
  constructor() {
    this.proc = null;
    this.dir = null;
    this.maxOpenFiles = 0;
  }

  async start() {
    if (this.proc)
      throw new Error('Already started.');

    let runid = new Date().toJSON()
      .replace('T', '/')
      .replace(/:/g, '-')
      .replace(/Z$/, '');

    let srvdir = '/tmp/ihbh/' + runid;
    let confpath2 = srvdir + '/conf.json';

    log.i('Starting the server:', srvdir);
    let conf = JSON.parse(fs.readFileSync(CONF_PATH));
    conf.port = SRV_PORT;
    conf.dirs.base = srvdir;
    mkdirp.sync(srvdir);
    fs.writeFileSync(confpath2, JSON.stringify(conf), 'utf8');

    try {
      log.d('Removing listeners on port', SRV_PORT);
      cp.execSync(`fuser -kvs ${SRV_PORT}/tcp`);
    } catch { }

    let sargs = [
      ...(cmd.profile ? ['--prof'] : []),
      path.resolve(BIN_PATH),
      '--config', confpath2,
      cmd.verbose && '--verbose',
    ].filter(arg => !!arg);

    log.i('spawn: node', sargs.join(' '));
    let srvp = cp.spawn('node', sargs);
    this.proc = srvp;
    this.dir = srvdir;

    srvp.stdout.on('data', (data) => log.cp(srvp.pid, data + ''));
    srvp.stderr.on('data', (data) => log.cp(srvp.pid, data + ''));

    await log.waitFor(WAIT_MESSAGE, srvp.pid);
  }

  watchOpenFiles() {
    let cmd = `ls /proc/${this.proc.pid}/fd | wc -l`;
    let timer = setInterval(() => {
      try {
        if (this.proc.killed)
          throw new Error('Process killed.');
        let res = cp.execSync(cmd).toString().trim();
        this.maxOpenFiles = Math.max(
          this.maxOpenFiles, +res);
      } catch (err) {
        log.i('watchOpenFiles() failed:', err.message);
        clearInterval(timer);
      }
    }, 500);
  }

  stop() {
    this.proc.kill();

    if (cmd.profile) {
      log.d('Post-processing CPU profiler log.');
      let pdir = this.dir + '/prof';
      mkdirp.sync(pdir);
      let fnames = fs.readdirSync('.')
        .filter(name => CPU_PROF_FILE.test(name));
      for (let fname of fnames) {
        fs.renameSync('./' + fname, pdir + '/' + fname);
        let sname = `${fname}.summary.log`;
        cp.execSync(`(cd ${pdir}; node --prof-process ${fname} > ${sname})`);
        log.i('CPU profiler summary:', pdir + '/' + sname);
      }
    }
  }

  getDirSize() {
    let dirpath = this.dir;
    let sap = cp.execSync('du -sB1 ' + dirpath).toString().trim();
    let sph = cp.execSync('du -sb ' + dirpath).toString().trim();
    let apparent = +sph.split('\t')[0];
    let physical = +sap.split('\t')[0];
    return { apparent, physical };
  }

  getMemSize() {
    let pid = this.proc.pid;
    let s = cp.execSync(`ps -q ${pid} -o size`).toString().trim();
    let m = /\d+/.exec(s);
    return +m[0];
  }
}

module.exports = ServerProcess;
