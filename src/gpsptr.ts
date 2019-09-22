import conf from './conf';

// Returns a 5 byte GPS pointer with 100x100 meters resolution.
export function getGpsPtr(lat: number, lon: number): Buffer {
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
    let dlat = (clat >> (4 - i) * 4) & 15;
    let dlon = (clon >> (4 - i) * 4) & 15;
    key[i] = dlat << 4 | dlon;
  }

  return Buffer.from(key);
}
