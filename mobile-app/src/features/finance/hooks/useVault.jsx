import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  codec,
  cryptoConstants,
  decryptJson,
  deriveKey,
  encryptJson,
  generateSalt,
  makeVerification,
  verifyKey,
} from '../lib/crypto';
import {
  deleteVault as storageDeleteVault,
  getMeta,
  getVaultBlob,
  setMeta,
  setVaultBlob,
} from '../lib/storage';
import {
  buildDefaultVault,
  generateId,
  SCHEMA_VERSION,
} from '../../../../../src/features/finance/lib/defaults';

const DEFAULT_AUTO_LOCK_MINUTES = 15;
// Vaults created before kdfIterations was stored in meta used this count.
const LEGACY_KDF_ITERATIONS = 100_000;

// Status: 'initializing' | 'empty' | 'locked' | 'unlocking' | 'unlocked' | 'error'
export function useVault() {
  const [status, setStatus] = useState('initializing');
  const [meta, setMetaState] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const keyRef = useRef(null);
  const saltRef = useRef(null);
  const backgroundedAtRef = useRef(null);

  const lock = useCallback(() => {
    keyRef.current = null;
    saltRef.current = null;
    setData(null);
    setStatus((prev) => (prev === 'empty' ? 'empty' : 'locked'));
  }, []);

  // Auto-lock: when the app goes to the background, remember when; on return,
  // lock if it has been away longer than the configured idle window.
  useEffect(() => {
    if (status !== 'unlocked') return undefined;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAtRef.current = Date.now();
        return;
      }
      if (next === 'active' && backgroundedAtRef.current) {
        const minutes = data?.settings?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES;
        const elapsed = Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (minutes > 0 && elapsed >= minutes * 60 * 1000) {
          lock();
        }
      }
    });
    return () => subscription.remove();
  }, [status, data, lock]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getMeta();
        if (cancelled) return;
        if (!stored) {
          setStatus('empty');
          return;
        }
        setMetaState(stored);
        setStatus('locked');
      } catch (err) {
        console.error('Vault init failed', err);
        if (!cancelled) {
          setError(err.message || 'Failed to access local storage.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (nextData) => {
    if (!keyRef.current) throw new Error('Vault is locked.');
    const stamped = { ...nextData, updatedAt: new Date().toISOString() };
    const blob = await encryptJson(keyRef.current, stamped);
    await setVaultBlob({ ...blob, schemaVersion: SCHEMA_VERSION });
    setData(stamped);
    setLastSavedAt(Date.now());
  }, []);

  const updateData = useCallback(async (updater) => {
    const next = typeof updater === 'function' ? updater(data) : updater;
    await persist(next);
    return next;
  }, [data, persist]);

  const createVault = useCallback(async ({ passphrase, currency }) => {
    if (!passphrase || passphrase.length < 8) {
      throw new Error('Passphrase must be at least 8 characters.');
    }
    const salt = generateSalt();
    const key = await deriveKey(passphrase, salt);
    const verification = await makeVerification(key);
    const initial = buildDefaultVault({ currency });
    const blob = await encryptJson(key, initial);

    const newMeta = {
      schemaVersion: SCHEMA_VERSION,
      salt: codec.bytesToBase64(salt),
      verification,
      kdfIterations: cryptoConstants.KDF_ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    await setMeta(newMeta);
    await setVaultBlob({ ...blob, schemaVersion: SCHEMA_VERSION });

    keyRef.current = key;
    saltRef.current = salt;
    setMetaState(newMeta);
    setData(initial);
    setLastSavedAt(Date.now());
    setStatus('unlocked');
  }, []);

  const unlock = useCallback(async (passphrase) => {
    if (!meta) throw new Error('No vault to unlock.');
    setStatus('unlocking');
    setError('');
    try {
      const salt = codec.base64ToBytes(meta.salt);
      const iterations = meta.kdfIterations || LEGACY_KDF_ITERATIONS;
      const key = await deriveKey(passphrase, salt, iterations);
      const ok = await verifyKey(key, meta.verification);
      if (!ok) {
        setStatus('locked');
        throw new Error('Incorrect passphrase.');
      }
      const blob = await getVaultBlob();
      if (!blob) {
        setStatus('locked');
        throw new Error('Vault data is missing.');
      }
      const decoded = await decryptJson(key, blob);

      // Auto-migrate vaults created at a different (slower) iteration count to the
      // current fast default, so unlock is only ever slow once. Best-effort: if the
      // re-key write fails, fall back to the freshly-derived original key.
      if (iterations !== cryptoConstants.KDF_ITERATIONS) {
        try {
          const newSalt = generateSalt();
          const newKey = await deriveKey(passphrase, newSalt);
          const verification = await makeVerification(newKey);
          const reblob = await encryptJson(newKey, decoded);
          const migratedMeta = {
            ...meta,
            salt: codec.bytesToBase64(newSalt),
            verification,
            kdfIterations: cryptoConstants.KDF_ITERATIONS,
            migratedAt: new Date().toISOString(),
          };
          await setMeta(migratedMeta);
          await setVaultBlob({ ...reblob, schemaVersion: SCHEMA_VERSION });
          keyRef.current = newKey;
          saltRef.current = newSalt;
          setMetaState(migratedMeta);
          setData(decoded);
          setStatus('unlocked');
          return;
        } catch (migrateErr) {
          console.warn('Vault KDF migration skipped', migrateErr);
        }
      }

      keyRef.current = key;
      saltRef.current = salt;
      setData(decoded);
      setStatus('unlocked');
    } catch (err) {
      setError(err.message || 'Failed to unlock.');
      setStatus('locked');
      throw err;
    }
  }, [meta]);

  const changePassphrase = useCallback(async ({ current, next }) => {
    if (!data) throw new Error('Vault must be unlocked.');
    if (!next || next.length < 8) throw new Error('New passphrase must be at least 8 characters.');
    const currentSalt = saltRef.current;
    if (!currentSalt) throw new Error('Vault state error.');
    const currentKey = await deriveKey(current, currentSalt, meta.kdfIterations || LEGACY_KDF_ITERATIONS);
    const ok = await verifyKey(currentKey, meta.verification);
    if (!ok) throw new Error('Current passphrase is incorrect.');

    const newSalt = generateSalt();
    const newKey = await deriveKey(next, newSalt);
    const verification = await makeVerification(newKey);
    const blob = await encryptJson(newKey, data);

    const updatedMeta = {
      ...meta,
      salt: codec.bytesToBase64(newSalt),
      verification,
      kdfIterations: cryptoConstants.KDF_ITERATIONS,
      rotatedAt: new Date().toISOString(),
    };
    await setMeta(updatedMeta);
    await setVaultBlob({ ...blob, schemaVersion: SCHEMA_VERSION });

    keyRef.current = newKey;
    saltRef.current = newSalt;
    setMetaState(updatedMeta);
  }, [data, meta]);

  const destroyVault = useCallback(async () => {
    await storageDeleteVault();
    await setMeta(null);
    keyRef.current = null;
    saltRef.current = null;
    setData(null);
    setMetaState(null);
    setStatus('empty');
  }, []);

  const actions = useMemo(() => ({
    lock,
    unlock,
    createVault,
    updateData,
    changePassphrase,
    destroyVault,
    generateId,
  }), [lock, unlock, createVault, updateData, changePassphrase, destroyVault]);

  return { status, error, data, meta, lastSavedAt, actions };
}

// Provider lives above the tab navigator so the in-memory key survives tab
// switches — otherwise leaving Finance would re-lock the vault every time.
const VaultContext = createContext(null);

export function FinanceVaultProvider({ children }) {
  const vault = useVault();
  return <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>;
}

export function useVaultContext() {
  return useContext(VaultContext);
}
