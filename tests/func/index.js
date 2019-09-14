const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const mkdirp = require('mkdirp');

const VERBOSE_FLAG = '+logs';

let included = process.argv[2] || '';
let verbose = process.argv[3] == VERBOSE_FLAG;
let basedir = __dirname;
let excluded = /^index\.js$/;
let tslog = new Date().toJSON()
  .replace('T', '/')
  .replace(/:/g, '-')
  .replace(/\.\d+Z/, '');
let logpath = `/tmp/ihbh/tests/${tslog}/output.log`;

start();

async function start() {
  log('Debug logs:', logpath);
  mkdirp.sync(path.dirname(logpath));
  if (!verbose)
    log(`Add ${VERBOSE_FLAG} to print tests output to stdout.`);
  if (included)
    log('Filtering tests with:', JSON.stringify(included));
  log('Looking for tests in:', basedir);

  let jsnames = fs.readdirSync(basedir);
  let nfailures = 0;

  try {
    for (let jsname of jsnames) {
      if (excluded.test(jsname))
        continue;
      if (included && jsname.indexOf(included) < 0)
        continue;
      let jspath = path.join(basedir, jsname);
      let time = Date.now();
      let exitcode = await exec(jspath);
      let testname = jsname.replace(/\.js$/, '');
      let label = exitcode ?
        '\x1b[41mfailed\x1b[0m' :
        '\x1b[32mpassed\x1b[0m';
      log('Test:', testname, label,
        'in', Date.now() - time, 'ms');
      if (exitcode) nfailures++;
    }

    log(nfailures > 0 ?
      nfailures + ' tests \x1b[41mfailed\x1b[0m' :
      'All tests passed');
  } catch (err) {
    log(err);
    process.exit(1);
  }
}

function log(...args) {
  console.log('[::]', ...args);
}

function logcp(data) {
  let text = (data + '').trimRight();
  if (verbose) console.log(text);
  fs.appendFileSync(logpath, text + '\n', 'utf8');
}

function exec(jspath) {
  return new Promise((resolve, reject) => {
    logcp('> node ' + jspath);
    let p = cp.spawn('node', [jspath]);
    p.stdout.on('data', logcp);
    p.stderr.on('data', logcp);
    p.on('close', resolve);
  });
}
