export const decodeText = (b64string: string) =>
  Buffer.from(b64string, 'base64').toString('ascii');

export const encodeText = (text: string) =>
  new Buffer(text).toString('base64');
