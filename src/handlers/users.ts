import * as auth from '../auth';
import dbusers, { PROFILE_DIR } from '../db/users';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../scheme';

let UserName = val.RegEx(/^\w{3,20}$/);
let UserPhoto = val.RegEx(/^data:image\/jpeg;base64,\S+$/);
let UserInfo = val.AsciiText(1024);
let UserPubKey = val.HexNum(64);

type RpcGetDetails = typeof RpcGetDetails.input;
type RpcSetDetails = typeof RpcSetDetails.input;

let RpcGetDetails = val.Dictionary({
  users: val.ArrayOf(auth.UserId),
  props: val.Optional(
    val.ArrayOf(
      val.RegEx(/^(name|info|photo|pubkey)$/))),
});

let RpcSetDetails = val.Dictionary({
  name: val.Optional(UserName),
  info: val.Optional(UserInfo),
  photo: val.Optional(UserPhoto),
  pubkey: val.Optional(UserPubKey),
});

@rpc.Service('Users')
class RpcUsers {
  @rpc.Method('GetDetails')
  async get(
    @rpc.ReqBody(RpcGetDetails) body: RpcGetDetails) {

    let users = body.users;
    let props = new Set(body.props || ['name', 'photo', 'info', 'pubkey']);
    log.v('Getting details for', users);
    log.v('Selected props:', props);
    return users.map(uidstr => {
      let uid = Buffer.from(uidstr, 'hex');
      if (!dbusers.exists(uid))
        return null;
      let json = {};
      for (let prop of props) {
        let path = PROFILE_DIR + '/' + prop;
        json[prop] = dbusers.get(uid, path);
      }
      return json;
    });
  }

  @rpc.Method('SetDetails')
  async set(
    @auth.RequiredUserId() uidstr: string,
    @rpc.ReqBody(RpcSetDetails) json: RpcSetDetails) {

    log.v('Setting details for', uidstr);
    let uid = Buffer.from(uidstr, 'hex');
    for (let prop in json) {
      let path = PROFILE_DIR + '/' + prop;
      dbusers.set(uid, path, json[prop]);
    }
  }
}
