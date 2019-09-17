export class Report {
  constructor(
    public message: string | Report,
    public path?: string,
    public input?) { }

  toString() {
    return this.message + ' ' + this.path;
  }
}

export class Validator<T> {
  readonly input: T;

  constructor(
    public validate: (input: T) => Iterable<Report>) { }

  verifyInput(input: T) {
    for (let report of this.validate(input))
      throw new SyntaxError(report.toString());
  }
}

export function MinMax(min: number, max: number) {
  if (min >= max) throw new Error(`Bad range: ${min}..${max}`);
  return new Validator<number>(function* (input) {
    if (typeof input != 'number') {
      yield new Report(`Number expected.`, '', input);
    } else if (input < min || input > max) {
      yield new Report(`Expected to be in range ${min}..${max}`, '', input);
    }
  });
}

export function RegEx(regex: RegExp, minlen = 0, maxlen = Infinity) {
  return new Validator<string>(function* (input) {
    if (typeof input != 'string') {
      yield new Report(`String expected.`, '', input);
    } else if (input.length < minlen) {
      yield new Report(`Shorter than ${minlen} chars.`, '', input);
    } else if (input.length > maxlen) {
      yield new Report(`Longer than ${maxlen} chars.`, '', input);
    } else if (!regex.test(input)) {
      yield new Report(`Expected to match a regex: ${regex}`, '', input);
    }
  });
}

export const HexNum = (digits: number) =>
  RegEx(new RegExp(`^[0-9a-f]{${digits}}$`));

export const AsciiText = (maxchars: number) =>
  RegEx(new RegExp(`^[\\x20-\\x7e]{0,${maxchars}}$`));

export function ArrayOf<T>(item: Validator<T>) {
  return new Validator<T[]>(function* (input) {
    if (!Array.isArray(input)) {
      yield new Report(`Array expected.`, '', input);
    } else {
      for (let i = 0; i < input.length; i++)
        for (let report of item.validate(input[i]))
          yield new Report(report, '[' + i + ']', input[i]);
    }
  });
}

export function Dictionary<T>(shape: { [K in keyof T]: Validator<T[K]> }) {
  return new Validator<T>(function* (input) {
    if (!input) {
      yield new Report(`Dictionary expected.`, '', input);
    } else {
      for (let i of Object.keys(shape))
        for (let report of shape[i].validate(input[i]))
          yield new Report(report, '.' + i, input[i]);
    }
  });
}

export function KeyVal<T>(
  keyShape: Validator<string>,
  valShape: Validator<T>) {

  return new Validator<{ [key: string]: T }>(function* (input) {
    if (!input) {
      yield new Report(`Dictionary expected.`, '', input);
    } else {
      for (let [key, val] of Object.entries(input)) {
        for (let report of keyShape.validate(key))
          yield new Report(report, '.' + key, key);
        for (let report of valShape.validate(val))
          yield new Report(report, '.' + key, val);
      }
    }
  });
}

export function Optional<T>(validator: Validator<T>) {
  return new Validator<T>(function* (input) {
    if (input !== undefined)
      yield* validator.validate(input);
  });
}

export const json = new Validator<JSON>(function* (input) {
  if (typeof input == 'function' || typeof input === 'undefined')
    yield new Report('Invalid JSON', '', input);
});
