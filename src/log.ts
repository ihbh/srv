const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SUBTAG = /^[a-z]+(-[a-z]+)*$/i;
const T_BASE = Date.now();

type Sev = 'V' | 'I' | 'W' | 'E';

function log(sev: Sev, tag: string, ...args) {
  let ts = dt2s(Date.now() - T_BASE);
  if (tag) {
    console.log(ts, sev, '[' + tag + ']', ...args);
  } else {
    console.log(ts, sev, ...args);
  }
}

export const config = {
  verbose: false,
};

class Log {
  tag: string = '';

  v(...args) { config.verbose && log('V', this.tag, ...args); }
  i(...args) { log('I', this.tag, ...args); }
  w(...args) { log('W', this.tag, ...args); }
  e(...args) { log('E', this.tag, ...args); }

  fork(subtag: string) {
    if (!SUBTAG.test(subtag))
      throw new Error('Bad log subtag: ' + subtag);
    let flog = new Log;
    flog.tag = !this.tag ? subtag :
      this.tag + '.' + subtag;
    return flog;
  }
}

export default new Log;

function p2(x) {
  return (100 + x).toString().slice(1);
}

function dt2s(dt) {
  let s = dt / SEC % 60;
  let m = dt / MIN % 60 | 0;
  let h = dt / HOUR % 24 | 0;
  let d = dt / DAY | 0;

  let x = '';

  if (d > 0) {
    x = p2(d) + ':' + p2(h) + ':' + p2(m) + ':';
  } else if (h > 0) {
    x = p2(h) + ':' + p2(m) + ':';
  } else if (m > 0) {
    x = p2(m) + ':';
  }

  return '[' + x + s.toFixed(3) + ']';
}

log('I', 'log', 'Started:', new Date().toISOString());
