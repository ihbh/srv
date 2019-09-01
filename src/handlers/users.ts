// curl -X POST -d '{"user":"123"}' localhost:3921/rpc/Users.GetDetails
// curl -X POST -d '{"user":"123","name":"Joe"}' localhost:3921/rpc/Users.SetDetails

import conf from '../conf';
import KVS from '../kvs';
import { log } from '../log';
import * as rpc from '../rpc';

let users = new KVS(conf.dirs.kvs.user);

interface UserDetails {
  user: string;
  name: string;
  info: string;
  photo: string;
  pubkey: string;
}

interface RpcGetDetails {
  user: string;
}

@rpc.Service('Users')
class RpcUsers {
  @rpc.Method('GetDetails')
  async get({ user }: RpcGetDetails) {
    log.v('Getting details for', user);
    let json = users.get(user);
    return JSON.parse(json) as UserDetails;
  }

  @rpc.Method('SetDetails')
  async set(details: UserDetails) {
    let user = details.user;
    log.v('Setting details for', user);
    let json = JSON.stringify(details);
    users.set(user, json);
  }
}
