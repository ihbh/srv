export class HttpError extends Error {
  constructor(public code: number, public status = '', public description = '') {
    super(status ? code + ': ' + status : code + '');
  }
}

export class BadRequest extends HttpError {
  constructor(status = '', description = '') {
    super(400, status, description);
  }
}

export class NotFound extends HttpError {
  constructor(status = '', description = '') {
    super(404, status, description);
  }
}

export class Unauthorized extends HttpError {
  constructor(status = '', description = '') {
    super(401, status, description);
  }
}

export class VfsAclError extends Unauthorized {
  constructor(op: string, path: string) {
    super('No Access', `vfs.${op} ${path}`);
  }
}

export class NotImplemeted extends HttpError {
  constructor(status = '', description = '') {
    super(501, status, description);
  }
}
