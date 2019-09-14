import * as auth from '../auth';
import conf from '../conf';
import dbPlaces, { Lat, Lon, VisitedPlace, VisitedPlaces } from '../db/places';
import dbVisitors from '../db/visitors';
import { BadRequest } from '../errors';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../scheme';

type LatLon = typeof LatLon.input;

let LatLon = val.Dictionary({
  lat: Lat,
  lon: Lon,
});

// Returns a 10 byte pointer with 100 meters resolution.
function getLocPtr(lat: number, lon: number): Buffer {
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

function verifyVisitorEntry(tskey: string, place: VisitedPlace) {
  let key = (place.time / 60 | 0).toString(16);
  while (key.length < 8) key = '0' + key;
  if (key != tskey)
    throw new BadRequest(
      'Bad TS Key',
      `Given ts key: ${tskey}; expected ts key: ${key}; time: ${place.time} s`);
}

function parseHex(str: string) {
  return parseInt(str, 16);
}

@rpc.Service('Map')
class RpcMap {
  @rpc.Method('GetVisitedPlaces')
  async get(
    @auth.RequiredUserId() uid: string) {

    return dbPlaces.get(Buffer.from(uid, 'hex'));
  }

  @rpc.Method('AddVisitedPlaces')
  async add(
    @auth.RequiredUserId() uid: string,
    @rpc.ReqBody(VisitedPlaces) dict: VisitedPlaces) {

    let uid64 = Buffer.from(uid, 'hex');
    let prev = dbPlaces.get(uid64);

    try {
      for (let [tskey, place] of Object.entries(dict)) {
        if (!place) {
          log.v('Deleting visitor note:', uid, tskey);
          delete prev[tskey];
        } else if (prev[tskey]) {
          log.v('Updating visitor note:', uid, tskey);
          prev[tskey] = place;
        } else {
          log.v('Adding visitor note:', uid, tskey);
          prev[tskey] = place;
          verifyVisitorEntry(tskey, place);
          let locptr = getLocPtr(place.lat, place.lon);
          dbVisitors.add(locptr, { uid, tskey });
        }
      }
    } finally {
      dbPlaces.set(uid64, prev);
    }
  }

  @rpc.Method('GetVisitors')
  async visitors(
    @rpc.ReqBody(LatLon) body: LatLon) {

    let locptr = getLocPtr(body.lat, body.lon);
    let visitors = dbVisitors.get(locptr);
    let uid2ts: { [uid: string]: number } = {};

    for (let { uid, tskey } of visitors) {
      let time = parseHex(tskey) * 60;
      let prev = uid2ts[uid];
      if (!prev || time >= prev)
        uid2ts[uid] = time;
    }

    return Object.entries(uid2ts)
      .map(([uid, time]) => ({ uid, time }));
  }
}
