import { BadRequest } from './errors';
import * as rpc from './rpc';
import * as val from './val';

const AUTHORIZATION = 'Authorization';

export const UserId = val.HexNum(16);
const UserSig = val.HexNum(128);

const AuthToken = val.Dictionary({
  uid: UserId,
  sig: val.Optional(UserSig),
});

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
      AuthToken.verifyInput(json);
      return json.uid;
    } catch (err) {
      throw new BadRequest('Bad Auth', err.message);
    }
  });
}
