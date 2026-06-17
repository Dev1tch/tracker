import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';

// Mobile vault crypto. Real PBKDF2-SHA256 + AES-256-GCM (via the audited @noble
// pure-JS libs, which work in Expo Go). Web uses crypto.subtle with 250k PBKDF2
// iterations; pure JS on Hermes is far slower AND would block the UI thread, so
// we use a reduced count and the ASYNC pbkdf2 (which yields between batches so the
// screen stays responsive with a visible spinner). Consequence: mobile vaults are
// NOT cross-compatible with web vaults/backups — an accepted Expo Go tradeoff.
const KDF_ITERATIONS = 12_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERIFICATION_PLAINTEXT = 'life-tracker:finance:v1';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

function base64ToBytes(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i += 1) {
    buffer = (buffer << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[p] = (buffer >> bits) & 0xff;
      p += 1;
    }
  }
  return out.subarray(0, p);
}

export function generateSalt() {
  return Crypto.getRandomBytes(SALT_BYTES);
}

// Async PBKDF2: yields to the event loop (asyncTick) so deriving the key never
// freezes the UI thread the way the synchronous variant did. The iteration count
// is passed in (and stored in vault meta) so older vaults keep unlocking even if
// the default changes.
export async function deriveKey(passphrase, salt, iterations = KDF_ITERATIONS) {
  return pbkdf2Async(sha256, utf8ToBytes(passphrase), salt, {
    c: iterations,
    dkLen: KEY_BYTES,
    asyncTick: 10,
  });
}

export async function encryptJson(key, value) {
  const iv = Crypto.getRandomBytes(IV_BYTES);
  const plaintext = utf8ToBytes(JSON.stringify(value));
  const ciphertext = gcm(key, iv).encrypt(plaintext);
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export async function decryptJson(key, payload) {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const plaintext = gcm(key, iv).decrypt(ciphertext);
  return JSON.parse(bytesToUtf8(plaintext));
}

export async function makeVerification(key) {
  return encryptJson(key, { marker: VERIFICATION_PLAINTEXT });
}

export async function verifyKey(key, payload) {
  try {
    const decoded = await decryptJson(key, payload);
    return decoded?.marker === VERIFICATION_PLAINTEXT;
  } catch {
    return false;
  }
}

export const codec = { bytesToBase64, base64ToBytes };
export const cryptoConstants = { KDF_ITERATIONS, SALT_BYTES, IV_BYTES, KEY_BYTES };
