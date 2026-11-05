import { createECDH, createCipheriv, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';

function b64url(data: Buffer): string { return data.toString('base64url'); }
function fromB64url(data: string): Buffer { return Buffer.from(data, 'base64url'); }
function hmac(key: Buffer, data: Buffer): Buffer { return createHmac('sha256', key).update(data).digest(); }
function hkdfExpand(key: Buffer, info: Buffer, size: number): Buffer { return hmac(key, Buffer.concat([info, Buffer.from([1])])).subarray(0, size); }

// Derive the public signing key from the private key rather than trusting a possibly mismatched env value.
export function deriveVapidPublicKey(privateKey: string): string {
  const ecdh = createECDH('prime256v1');
  const raw = Buffer.from(privateKey, 'base64url');
  if (raw.length !== 32) throw new Error('VAPID private key must be 32 bytes');
  ecdh.setPrivateKey(raw);
  return ecdh.getPublicKey(undefined, 'uncompressed').toString('base64url');
}

export function buildWebPushRequest(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: { title: string; body: string; url: string; tag?: string },
  vapid: { publicKey: string; privateKey: string; subject: string }
): { url: string; headers: Record<string,string>; body: Buffer } {
  const u = new URL(subscription.endpoint);
  if (u.protocol !== 'https:') throw new Error('Invalid push endpoint protocol');
  const uaPublic = fromB64url(subscription.keys_p256dh);
  const authSecret = fromB64url(subscription.keys_auth);
  const vapidPublic = fromB64url(vapid.publicKey);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16 || vapidPublic.length !== 65 || vapidPublic[0] !== 4) throw new Error('Invalid push subscription keys');
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const appPublic = ecdh.getPublicKey(undefined, 'uncompressed');
  const sharedSecret = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0','utf8'),uaPublic,appPublic]);
  const ikm = hkdfExpand(hmac(authSecret, sharedSecret),keyInfo,32);
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0','utf8'),16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0','utf8'),12);
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payload),'utf8'), Buffer.from([2])]);
  if (plaintext.length + 16 > 3993) throw new Error('Push payload too large');
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096,0);
  const cipher = createCipheriv('aes-128-gcm',cek,nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]);
  const body = Buffer.concat([salt,rs,Buffer.from([appPublic.length]),appPublic,encrypted]);
  const vapidKey = createPrivateKey({format:'jwk',key:{kty:'EC',crv:'P-256',d:b64url(fromB64url(vapid.privateKey)),x:b64url(vapidPublic.subarray(1,33)),y:b64url(vapidPublic.subarray(33,65))}});
  const header = b64url(Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const claims = b64url(Buffer.from(JSON.stringify({aud:u.origin,exp:Math.floor(Date.now()/1000)+3600,sub:vapid.subject})));
  const signingInput = header+'.'+claims;
  const signature = sign('sha256',Buffer.from(signingInput),{key:vapidKey,dsaEncoding:'ieee-p1363'});
  const jwt = signingInput+'.'+b64url(signature);
  return {url:u.href,headers:{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'3600','Authorization':'vapid t='+jwt+', k='+vapid.publicKey},body};
}