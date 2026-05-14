'use client';

const KDF_ITERATIONS = 250_000;
const KDF_HASH = 'SHA-256';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;
const VERIFICATION_PLAINTEXT = 'life-tracker:finance:v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

function getCrypto() {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  return window.crypto;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function generateSalt() {
  return getCrypto().getRandomValues(new Uint8Array(SALT_BYTES));
}

export async function deriveKey(passphrase, salt) {
  const c = getCrypto();
  const baseKey = await c.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return c.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: KDF_ITERATIONS,
      hash: KDF_HASH,
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(key, value) {
  const c = getCrypto();
  const iv = c.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = enc.encode(JSON.stringify(value));
  const ciphertext = await c.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson(key, payload) {
  const c = getCrypto();
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const plaintext = await c.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return JSON.parse(dec.decode(plaintext));
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

export const codec = {
  bytesToBase64,
  base64ToBytes,
};

export const cryptoConstants = {
  KDF_ITERATIONS,
  KDF_HASH,
  KEY_BITS,
  SALT_BYTES,
  IV_BYTES,
};
