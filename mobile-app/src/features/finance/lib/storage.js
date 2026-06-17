import AsyncStorage from '@react-native-async-storage/async-storage';

// SecureStore is too small for the encrypted vault blob (it can hold tags/images),
// so the vault lives in AsyncStorage. The blob is already AES-GCM encrypted, so
// AsyncStorage (unencrypted at rest) only ever sees ciphertext.
const META_KEY = 'finance.meta';
const VAULT_KEY = 'finance.vault';

async function readJson(key) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getMeta() {
  return readJson(META_KEY);
}

export async function setMeta(meta) {
  if (meta == null) {
    await AsyncStorage.removeItem(META_KEY);
    return;
  }
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function getVaultBlob() {
  return readJson(VAULT_KEY);
}

export async function setVaultBlob(blob) {
  await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(blob));
}

export async function deleteVault() {
  await AsyncStorage.removeItem(VAULT_KEY);
}
