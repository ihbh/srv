import { logstr } from './log';
import { VFS_PATH } from './conf';

export class Report {
  message?: string;
  report?: Report;
  input?: any;
  key?: string | number;

  constructor(message: string, input);
  constructor(report: Report, key: string | number);
  constructor(mr, ki) {
    if (mr instanceof Report) {
      this.key = ki;
      this.report = mr;
    } else {
      this.message = mr;
      this.input = ki;
    }
  }

  toString() {
    let path = '';
    let message = '';
    let input = null;

    for (let r: Report = this; r; r = r.report) {
      if (r.report) {
        path += typeof r.key == 'string' ?
          '.' + r.key : '[' + r.key + ']';
      } else {
        input = r.input;
        message = r.message;
      }
    }

    return `${message} Where input${path} = ${logstr(input)}`;
  }
}

export class Validator<T> {
  readonly input: T;

  constructor(
    public validate: (input: T) => Iterable<Report>) { }

  test(input: T) {
    for (let report of this.validate(input))
      return false;
    return true;
  }

  verifyInput(input: T) {
    for (let report of this.validate(input))
      throw new SyntaxError(report.toString());
  }
}

export const escapeRegEx = (str: string) =>
  str.replace(/[^\w]/g, ch => '\\' + ch);

export function minmax(min: number, max: number) {
  if (min >= max) throw new Error(`Bad range: ${min}..${max}`);
  return new Validator<number>(function* (input) {
    if (typeof input != 'number') {
      yield new Report(`Number expected.`, input);
    } else if (input < min || input > max) {
      yield new Report(`Not in the ${min}..${max} range.`, input);
    }
  });
}

export function str(pattern: RegExp | string, minlen = 0, maxlen = Infinity) {
  let rx = pattern instanceof RegExp ?
    pattern as RegExp : new RegExp(pattern);

  return new Validator<string>(function* (input) {
    if (typeof input != 'string') {
      yield new Report(`String expected.`, input);
    } else if (input.length < minlen) {
      yield new Report(`Shorter than ${minlen} chars.`, input);
    } else if (input.length > maxlen) {
      yield new Report(`Longer than ${maxlen} chars.`, input);
    } else if (!rx.test(input)) {
      yield new Report(`String doesn't match ${pattern}.`, input);
    }
  });
}

export const hexnum = (minlen: number, maxlen = minlen) =>
  str(/^[0-9a-f]*$/, minlen, maxlen);

export const ascii = (minlen = 0, maxlen = Infinity) => {
  let range = [
    minlen,
    maxlen == Infinity ? '' : maxlen,
  ].join(',');
  return str(new RegExp(`^[\\x20-\\x7e]{${range}}$`));
}

export function list<T>(item: Validator<T>) {
  return new Validator<T[]>(function* (input) {
    if (!Array.isArray(input)) {
      yield new Report(`Array expected.`, input);
    } else {
      for (let i = 0; i < input.length; i++)
        for (let report of item.validate(input[i]))
          yield new Report(report, i);
    }
  });
}

export function dict<T>(shape: { [K in keyof T]: Validator<T[K]> }) {
  return new Validator<T>(function* (input) {
    if (!input) {
      yield new Report(`Dictionary expected.`, input);
    } else {
      for (let i of Object.keys(shape))
        for (let report of shape[i].validate(input[i]))
          yield new Report(report, i);
    }
  });
}

export function subset<T>(shape: { [K in keyof T]?: Validator<T[K]> }) {
  return new Validator<T>(function* (input) {
    if (!input) {
      yield new Report(`Dictionary expected.`, input);
    } else {
      for (let i of Object.keys(input)) {
        if (!shape[i]) {
          yield new Report(`Unexpected key ${JSON.stringify(i)}.`, input);
          continue;
        }
        for (let report of shape[i].validate(input[i]))
          yield new Report(report, i);
      }
    }
  });
}

export function keyval<T>({ key: keyShape, val: valShape }:
  { key: Validator<string>, val: Validator<T> }) {

  return new Validator<{ [key: string]: T }>(function* (input) {
    if (!input) {
      yield new Report(`Dictionary expected.`, input);
    } else {
      for (let [key, val] of Object.entries(input)) {
        for (let report of keyShape.validate(key))
          yield new Report(report, key);
        for (let report of valShape.validate(val))
          yield new Report(report, key);
      }
    }
  });
}

export function opt<T>(validator: Validator<T>) {
  return new Validator<T>(function* (input) {
    if (input !== undefined)
      yield* validator.validate(input);
  });
}

export function nullor<T>(validator: Validator<T>) {
  return new Validator<T>(function* (input) {
    if (input !== null)
      yield* validator.validate(input);
  });
}

export const anything = new Validator<any>(function* (input) {
  // ...
});

export const nothing = new Validator<void>(function* (input) {
  if (input !== undefined)
    yield new Report('Expected null/undefined.', input);
});

export const json = new Validator<any>(function* (input) {
  if (typeof input == 'function' || typeof input === 'undefined')
    yield new Report(`Invalid JSON: ${typeof input}.`, input);
});

export const jsontime =
  str(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);

export const dataurl = (mime: string) =>
  str(`^data:${escapeRegEx(mime)};base64,[\\w+/=]+$`)

export const uid = hexnum(16);
export const pubkey = hexnum(64);
export const signature = hexnum(128);
// Date.now()/1000/60, 32 bits, overflows in 135 years
export const tskey = hexnum(8);
export const lat = minmax(-90, 90);
export const lon = minmax(-180, 180);
export const vfspath = str(VFS_PATH);

export const timesec = minmax(
  Math.round(new Date('2000-1-1').getTime() / 1000),
  Math.round(new Date('2100-1-1').getTime() / 1000));