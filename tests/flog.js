function log(...args) {
  console.log(...args);
}

log.i = (...args) => log('I', ...args);
log.d = (...args) => log('D', ...args);

log.listeners = [];

log.cp = (pid, text) => {
  let lines = text.split(/\r?\n/g);

  for (let line of lines) {
    line = line.trimRight();
    if (!line) continue;

    if (!isLogExcluded(line))
      log(pid + ' :: ' + line);

    for (let listener of log.listeners)
      listener(line, pid);
  }
};

function isLogExcluded(line) {
  if (!log.cplogs)
    return true;
  for (let regex of log.cp.excluded)
    if (regex.test(line))
      return true;
  return false;
}

log.cplogs = true;
log.cp.excluded = [];

log.waitFor = (pattern, pid) => new Promise(resolve => {
  log.d('Waiting for the srv log:', JSON.stringify(pattern));
  log.listeners.push(function listener(line = '', srvpid) {
    if (pid && pid != srvpid) return;
    if (line.indexOf(pattern) < 0) return;
    log.d('Detected the srv log:', JSON.stringify(pattern));
    let i = log.listeners.indexOf(listener);
    log.listeners.splice(i, 1);
    resolve(line);
  });
});

module.exports = log;
