const log = require('./flog');

class CToken {
  constructor(name) {
    this.name = name;
    this.cancelled = false;
    this.whenCancelled = new Promise(
      resolve => this.resolveWhenCancelled = resolve);
  }

  cancel(reason) {
    log.i(this.name, 'cancelled:', reason);
    this.cancelled = true;
    this.resolveWhenCancelled();
  }

  waitForCancellation() {
    return this.whenCancelled;
  }

  throwIfCancelled() {
    if (this.cancelled)
      throw new Error(this.name + ' cancelled');
  }
}

module.exports = CToken;
