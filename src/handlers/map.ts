import * as auth from '../auth';
import conf from '../conf';
import db from '../db/map';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../val';

interface RpcShareLocation {
  lat: number;
  lon: number;
  // Date.now()/1000, seconds, about 30 bits.
  // Also serves as unique id of this record.
  time: number;
}

interface RpcGetPeopleNearby {
  lat: number;
  lon: number;
}

let Lat = val.MinMax(-90, 90);
let Lon = val.MinMax(-180, 180);

let RpcShareLocation = val.Dictionary({
  lat: Lat,
  lon: Lon,
  time: val.MinMax(
    Math.round(new Date('2000-1-1').getTime() / 1000),
    Math.round(new Date('2100-1-1').getTime() / 1000)),
});

let RpcGetPeopleNearby = val.Dictionary({
  lat: Lat,
  lon: Lon,
});

// Returns a 10 byte pointer with 100 meters resolution.
function getDbKey(lat: number, lon: number): Buffer {
  // en.wikipedia.org/wiki/Decimal_degrees#Precision
  // lat = -90 .. +90
  // lon = -180 .. +180
  // cell: 1/1024 = 100 x 100 m
  // 5 hex digits each
  let clat = (lat + 90) * conf.map.cell | 0;
  let clon = (lon + 180) * conf.map.cell | 0;
  let key = new Uint8Array(5);

  // key[0] divides the entire map into 16 blocks
  // key[1] divides that block into 16 sub blocks
  // and so on
  for (let i = 0; i < 5; i++) {
    let dlat = (clat >> (4 - i)) * 4 & 15;
    let dlon = (clon >> (4 - i)) * 4 & 15;
    key[i] = dlat << 4 | dlon;
  }

  return Buffer.from(key);
}

@rpc.Service('Map')
class RpcMap {
  @rpc.Method('ShareLocation')
  async add(
    @auth.RequiredUserId() user: string,
    @rpc.ReqBody(RpcShareLocation) body: RpcShareLocation) {

    let json = { user, ...body };
    let key = getDbKey(body.lat, body.lon);
    log.v('Sharing location:', key.toString('hex'), user, body);
    db.add(key, json);
  }

  @rpc.Method('GetPeopleNearby')
  async get(
    @rpc.ReqBody(RpcGetPeopleNearby) body: RpcGetPeopleNearby) {

    let key = getDbKey(body.lat, body.lon);
    log.v('Getting people nearby', key.toString('hex'), body);
    return db.get(key);
  }
}
