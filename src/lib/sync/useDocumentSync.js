'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, AUTH_CHANGE_EVENT } from '@/lib/api';

/**
 * Drive single-blob LWW sync for a feature whose authoritative state lives in
 * a parent component (notes tree, board state). The hook is intentionally
 * unopinionated about *what* the snapshot is — the parent passes `serialize`,
 * `applyRemote`, and an `api` adapter exposing `getDocument()` /
 * `updateDocument({snapshot, baseVersion})`.
 *
 * Lifecycle:
 *   1. Hook mounts. Parent calls `markHydrated()` after restoring from IDB.
 *   2. Hook fetches the server doc. If `serverVersion > lastSeenVersion` (or
 *      we have no lastSeenVersion yet and the server isn't empty) → expose
 *      `conflict` so the parent can render a banner. If the server is at the
 *      same version, treat it as "synced" and no UI fires.
 *   3. Parent calls `schedulePush()` whenever its state changes. The hook
 *      debounces and PUTs with `base_version=lastSeenVersion`.
 *   4. On 409 (parent's version is stale) → expose `conflict`, do NOT
 *      overwrite parent state until they choose.
 *
 * @param {{
 *   api: { getDocument(): Promise<any>, updateDocument(opts:{snapshot:any, baseVersion:number}): Promise<any> },
 *   debounceMs?: number,
 *   featureKey: string,
 * }} opts
 */
export function useDocumentSync({ api, debounceMs = 800, featureKey }) {
  const [conflict, setConflict] = useState(null); // { document, reason } | null
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [initialServerDoc, setInitialServerDoc] = useState(null);

  const lastSeenVersionRef = useRef(0);
  const hydratedRef = useRef(false);
  const initialFetchDoneRef = useRef(false);
  const pendingTimerRef = useRef(null);
  const latestSnapshotRef = useRef(null);
  const inFlightRef = useRef(false);
  const queuedAfterFlightRef = useRef(false);

  const isAuthenticated = useCallback(() => Boolean(apiClient.getToken()), []);

  const markHydrated = useCallback(() => {
    hydratedRef.current = true;
  }, []);

  const setLastSeenVersion = useCallback((version) => {
    lastSeenVersionRef.current = Number.isFinite(version) ? version : 0;
  }, []);

  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  const acceptRemote = useCallback(() => {
    const doc = conflict?.document;
    setConflict(null);
    return doc;
  }, [conflict]);

  /** Fire one PUT. Caller is responsible for debouncing. */
  const flush = useCallback(async () => {
    if (!hydratedRef.current) return;
    if (!isAuthenticated()) return;
    if (!latestSnapshotRef.current) return;

    if (inFlightRef.current) {
      queuedAfterFlightRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setSyncing(true);

    const snapshot = latestSnapshotRef.current;
    const base = lastSeenVersionRef.current;

    try {
      const doc = await api.updateDocument({
        snapshot,
        baseVersion: base,
      });
      lastSeenVersionRef.current = doc.version;
      setLastSyncedAt(Date.now());
    } catch (err) {
      if (err?.name === 'NotesConflictError' || err?.name === 'BoardConflictError') {
        setConflict({ document: err.document, reason: 'remote-newer' });
      } else if (err?.status === 401) {
        // Token expired — api client clears the token; parent will unmount.
      } else {
        console.warn(`[${featureKey}] sync push failed`, err);
      }
    } finally {
      inFlightRef.current = false;
      setSyncing(false);
      if (queuedAfterFlightRef.current && !conflict) {
        queuedAfterFlightRef.current = false;
        // Re-debounce so caller's latest state has a chance to settle.
        schedulePush();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, conflict, featureKey, isAuthenticated]);

  const schedulePush = useCallback(() => {
    if (!hydratedRef.current) return;
    if (!isAuthenticated()) return;
    if (conflict) return; // Don't push until the user resolves the conflict.

    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      flush();
    }, debounceMs);
  }, [conflict, debounceMs, flush, isAuthenticated]);

  const setSnapshot = useCallback((snapshot) => {
    latestSnapshotRef.current = snapshot;
  }, []);

  /** Initial GET on mount once authenticated. */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isAuthenticated()) return;
      if (initialFetchDoneRef.current) return;
      try {
        const doc = await api.getDocument();
        if (cancelled) return;
        initialFetchDoneRef.current = true;
        setInitialServerDoc(doc);
        setLastSyncedAt(Date.now());
        /* lastSeenVersion will be set by the parent via setLastSeenVersion
           once it decides whether to adopt the remote doc, keep local, or
           merge — this hook deliberately does NOT mutate parent state. */
      } catch (err) {
        if (err?.status !== 401) {
          console.warn(`[${featureKey}] sync initial fetch failed`, err);
        }
      }
    }
    run();
    function handleAuthChange() {
      // On login, retry the initial fetch.
      if (!initialFetchDoneRef.current) run();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      }
    };
  }, [api, featureKey, isAuthenticated]);

  /* Flush any debounced write on unmount. */
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
        // Fire-and-forget; component is leaving the tree.
        flush().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    initialServerDoc,
    conflict,
    syncing,
    lastSyncedAt,
    markHydrated,
    setLastSeenVersion,
    setSnapshot,
    schedulePush,
    flushNow: flush,
    dismissConflict,
    acceptRemote,
    isAuthenticated,
  };
}
