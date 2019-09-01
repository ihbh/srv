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
  constructor(
    public validate: (input: T) => Iterable<Report>) { }

  verifyInput(input: T) {
    for (let report of this.validate(input))
      throw new SyntaxError(report.toString());
  }
}

export function RegEx(regex: RegExp) {
  return new Validator<string>(function* (input) {
    if (typeof input != 'string') {
      yield new Report(`String expected.`, '', input);
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

export function Dictionary<T>(shape) {
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

export function Optional<T>(validator: Validator<T>) {
  return new Validator<T>(function* (input) {
    if (input !== undefined)
      yield* validator.validate(input);
  });
}
