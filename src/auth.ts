import * as rpc from './rpc';
import { BadRequest } from './errors';

const AUTHORIZATION = 'Authorization';
const USERID = /^[0-9a-f]{16}$/; // 64 bits

interface AuthToken {
  uid: string;
  sig: string;
}

export function RequiredUserId() {
  return rpc.ParamDep(req => {
    let token = req.headers[AUTHORIZATION.toLowerCase()] as string;
    if (!token) throw new BadRequest('Missing Auth');

    try {
      let json: AuthToken = JSON.parse(token);
      if (!USERID.test(json.uid))
        throw new SyntaxError('Invalid uid: ' + json.uid);
      return json.uid;
    } catch (err) {
      throw new BadRequest('Bad Auth', err.message);
    }
  });
}
