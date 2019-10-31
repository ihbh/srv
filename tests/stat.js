class Seq {
  constructor() {
    this.n = 0;
    this.sum = 0;
  }

  push(x) {
    this.n++;
    this.sum += x;
  }

  get mean() {
    return this.sum / this.n;
  }
}

class SeqMap {
  constructor() {
    this.map = new Map;
  }

  get(name) {
    let seq = this.map.get(name);
    if (!seq) this.map.set(name, seq = new Seq);
    return seq;
  }

  *[Symbol.iterator]() {
    yield* this.map.entries();
  }
}

module.exports = { Seq, SeqMap };

