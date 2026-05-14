'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  codec,
  decryptJson,
  deriveKey,
  encryptJson,
  generateSalt,
  makeVerification,
  verifyKey,
} from '@/features/finance/lib/crypto';
import {
  deleteVault as storageDeleteVault,
  getMeta,
  getVaultBlob,
  setMeta,
  setVaultBlob,
} from '@/features/finance/lib/storage';
import { buildDefaultVault, generateId, SCHEMA_VERSION } from '@/features/finance/lib/defaults';

const DEFAULT_AUTO_LOCK_MINUTES = 15;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'visibilitychange'];

// Vault status:
//   'initializing' -> reading meta from disk
//   'empty'        -> no vault exists yet (show onboarding)
//   'locked'       -> vault exists, needs passphrase
//   'unlocking'    -> verifying passphrase
//   'unlocked'     -> vault decrypted in memory
//   'error'        -> initialization failed
export function useVault() {
  const [status, setStatus] = useState('initializing');
  const [meta, setMetaState] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const keyRef = useRef(null);
  const saltRef = useRef(null);
  const lockTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const lock = useCallback(() => {
    keyRef.current = null;
    saltRef.current = null;
    setData(null);
    setStatus((prev) => (prev === 'empty' ? 'empty' : 'locked'));
  }, []);

  const scheduleAutoLock = useCallback(() => {
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    const minutes = data?.settings?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES;
    if (!minutes || minutes <= 0) return;
    const ms = minutes * 60 * 1000;
    lockTimerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= ms) {
        clearInterval(lockTimerRef.current);
        lockTimerRef.current = null;
        lock();
      }
    }, 30_000);
  }, [data, lock]);

  useEffect(() => {
    if (status !== 'unlocked') return undefined;
    lastActivityRef.current = Date.now();
    const handler = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));
    scheduleAutoLock();
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handler));
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [status, scheduleAutoLock]);

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

  const persist = useCallback(
    async (nextData) => {
      if (!keyRef.current) {
        throw new Error('Vault is locked.');
      }
      const stamped = { ...nextData, updatedAt: new Date().toISOString() };
      const blob = await encryptJson(keyRef.current, stamped);
      await setVaultBlob({ ...blob, schemaVersion: SCHEMA_VERSION });
      setData(stamped);
      setLastSavedAt(Date.now());
    },
    []
  );

  const updateData = useCallback(
    async (updater) => {
      const next = typeof updater === 'function' ? updater(data) : updater;
      await persist(next);
      return next;
    },
    [data, persist]
  );

  const createVault = useCallback(
    async ({ passphrase, currency }) => {
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
    },
    []
  );

  const unlock = useCallback(
    async (passphrase) => {
      if (!meta) {
        throw new Error('No vault to unlock.');
      }
      setStatus('unlocking');
      setError('');
      try {
        const salt = codec.base64ToBytes(meta.salt);
        const key = await deriveKey(passphrase, salt);
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
        keyRef.current = key;
        saltRef.current = salt;
        setData(decoded);
        setStatus('unlocked');
      } catch (err) {
        setError(err.message || 'Failed to unlock.');
        if (status !== 'locked') setStatus('locked');
        throw err;
      }
    },
    [meta, status]
  );

  const changePassphrase = useCallback(
    async ({ current, next }) => {
      if (!data) throw new Error('Vault must be unlocked.');
      if (!next || next.length < 8) throw new Error('New passphrase must be at least 8 characters.');
      const currentSalt = saltRef.current;
      if (!currentSalt) throw new Error('Vault state error.');
      const currentKey = await deriveKey(current, currentSalt);
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
        rotatedAt: new Date().toISOString(),
      };
      await setMeta(updatedMeta);
      await setVaultBlob({ ...blob, schemaVersion: SCHEMA_VERSION });

      keyRef.current = newKey;
      saltRef.current = newSalt;
      setMetaState(updatedMeta);
    },
    [data, meta]
  );

  const exportEncrypted = useCallback(async () => {
    if (!meta) throw new Error('No vault to export.');
    const blob = await getVaultBlob();
    if (!blob) throw new Error('Vault data missing.');
    const payload = {
      app: 'life-tracker',
      kind: 'finance-vault',
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      meta: {
        salt: meta.salt,
        verification: meta.verification,
        schemaVersion: meta.schemaVersion,
        createdAt: meta.createdAt,
      },
      blob: {
        iv: blob.iv,
        ciphertext: blob.ciphertext,
        schemaVersion: blob.schemaVersion,
      },
    };
    if (data) {
      const next = {
        ...data,
        settings: { ...data.settings, lastBackupAt: new Date().toISOString() },
      };
      await persist(next);
    }
    return payload;
  }, [meta, data, persist]);

  const importEncrypted = useCallback(
    async ({ payload, passphrase }) => {
      if (!payload || payload.kind !== 'finance-vault' || !payload.meta || !payload.blob) {
        throw new Error('Invalid backup file.');
      }
      const salt = codec.base64ToBytes(payload.meta.salt);
      const key = await deriveKey(passphrase, salt);
      const ok = await verifyKey(key, payload.meta.verification);
      if (!ok) throw new Error('Passphrase did not match this backup.');
      const decoded = await decryptJson(key, payload.blob);

      await setMeta({
        schemaVersion: payload.meta.schemaVersion || SCHEMA_VERSION,
        salt: payload.meta.salt,
        verification: payload.meta.verification,
        createdAt: payload.meta.createdAt || new Date().toISOString(),
        importedAt: new Date().toISOString(),
      });
      await setVaultBlob({
        iv: payload.blob.iv,
        ciphertext: payload.blob.ciphertext,
        schemaVersion: payload.blob.schemaVersion || SCHEMA_VERSION,
      });

      const newMeta = await getMeta();
      keyRef.current = key;
      saltRef.current = salt;
      setMetaState(newMeta);
      setData(decoded);
      setStatus('unlocked');
    },
    []
  );

  const destroyVault = useCallback(async () => {
    await storageDeleteVault();
    await setMeta(null);
    keyRef.current = null;
    saltRef.current = null;
    setData(null);
    setMetaState(null);
    setStatus('empty');
  }, []);

  const actions = useMemo(
    () => ({
      lock,
      unlock,
      createVault,
      updateData,
      changePassphrase,
      exportEncrypted,
      importEncrypted,
      destroyVault,
      generateId,
    }),
    [
      lock,
      unlock,
      createVault,
      updateData,
      changePassphrase,
      exportEncrypted,
      importEncrypted,
      destroyVault,
    ]
  );

  return {
    status,
    error,
    data,
    meta,
    lastSavedAt,
    actions,
  };
}

/* Context wrapper so the vault state survives tab switches — otherwise the
   Finance component unmounts, the in-memory key is destroyed, and the user
   has to re-enter their passphrase every time they leave & return. */
const VaultContext = createContext(null);

export function FinanceVaultProvider({ children }) {
  const vault = useVault();
  return <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>;
}

export function useVaultContext() {
  return useContext(VaultContext);
}
