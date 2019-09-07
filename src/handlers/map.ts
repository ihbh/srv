import * as auth from '../auth';
import conf from '../conf';
import db from '../db/map';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../val';

const MINUTE = 60 * 1000; // ms

interface RpcShareLocation {
  lat: number;
  lon: number;
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
    new Date('2000-1-1').getTime() / MINUTE | 0,
    new Date('2100-1-1').getTime() / MINUTE | 0),
});

let RpcGetPeopleNearby = val.Dictionary({
  lat: Lat,
  lon: Lon,
});

function getDbKey(lat: number, lon: number) {
  // en.wikipedia.org/wiki/Decimal_degrees#Precision
  // lat = -90 .. +90
  // lon = -180 .. +180
  // cell: 1/1024 = 100 x 100 m
  // 5 hex digits each
  let clat = (lat + 90) * conf.map.cell | 0;
  let clon = (lon + 180) * conf.map.cell | 0;
  let key = '';

  for (let i = 4; i >= 0; i--) {
    let dlat = clat >> i*4 & 15;
    let dlon = clon >> i*4 & 15;
    key += dlat.toString(16);
    key += dlon.toString(16);
  }

  return key;
}

@rpc.Service('Map')
class RpcMap {
  @rpc.Method('ShareLocation')
  async add(
    @auth.RequiredUserId() user: string,
    @rpc.ReqBody(RpcShareLocation) body: RpcShareLocation) {
    
    let json = { user, ...body };
    let key = getDbKey(body.lat, body.lon);
    log.v('Sharing location:', key, user, body);
    db.add(key, json);
  }

  @rpc.Method('GetPeopleNearby')
  async get(
    @rpc.ReqBody(RpcGetPeopleNearby) body: RpcGetPeopleNearby) {
    
    let key = getDbKey(body.lat, body.lon);
    log.v('Getting people nearby', key, body);
    return db.get(key);
  }
}
