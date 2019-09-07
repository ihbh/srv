import * as auth from '../auth';
import { log } from '../log';
import * as rpc from '../rpc';
import kvsdb from '../db/users';
import * as val from '../val';

let UserName = val.RegEx(/^\w{3,20}$/);
let UserPhoto = val.RegEx(/^data:image\/jpeg;base64,\S{1,8000}$/);
let UserInfo = val.AsciiText(1024);
let UserPubKey = val.HexNum(64);

interface RpcGetDetails {
  users: string[];
  props: string[];
}

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
    let props = body.props ? new Set(body.props) : null;
    log.v('Getting details for', users);
    log.v('Selected props:', props);
    return users.map(uid => {
      let json = kvsdb.get(uid);
      if (!props) return json;
      let subset = {};
      for (let prop of props)
        subset[prop] = json[prop];
      return subset;
    });
  }

  @rpc.Method('SetDetails')
  async set(
    @auth.RequiredUserId() user: string,
    @rpc.ReqBody(RpcSetDetails) details) {

    log.v('Setting details for', user);
    kvsdb.set(user, details);
  }
}
