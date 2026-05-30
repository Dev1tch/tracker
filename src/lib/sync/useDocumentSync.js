'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, AUTH_CHANGE_EVENT } from '@/lib/api';

/* How many times a single flush re-fetches the current version and retries
   after a 409 version conflict before giving up. Without this, one stale
   base version permanently wedges the tab — every later save 409s and is
   silently dropped, losing all new items until a manual reload. */
const MAX_CONFLICT_RETRIES = 3;

/**
 * Timestamp-based LWW sync for a single-blob document (notes tree / board
 * state). No conflict UI: whichever side has the newer `updated_at` wins.
 * Offline use is not supported. A 409 version conflict self-heals — the push
 * re-fetches the current version, rebases, and retries (see flush) so a stale
 * base version can't permanently wedge saving; other failures are logged.
 *
 * The hook fetches once on mount and exposes the server doc back to the
 * parent, which compares timestamps and adopts-or-pushes. After that, every
 * call to `schedulePush()` debounces a PUT.
 *
 * @param {{
 *   api: {
 *     getDocument(): Promise<{ updated_at: string, [k: string]: any }>,
 *     updateDocument(opts: { snapshot: any, baseVersion?: number|null }): Promise<{ updated_at: string, version?: number, [k: string]: any }>,
 *   },
 *   debounceMs?: number,
 *   featureKey: string,
 * }} opts
 */
export function useDocumentSync({ api, debounceMs = 800, featureKey }) {
  const [initialServerDoc, setInitialServerDoc] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const hydratedRef = useRef(false);
  const initialFetchDoneRef = useRef(false);
  const pendingTimerRef = useRef(null);
  const latestSnapshotRef = useRef(null);
  const baseVersionRef = useRef(null);
  const inFlightRef = useRef(false);
  const queuedAfterFlightRef = useRef(false);

  const isAuthenticated = useCallback(() => Boolean(apiClient.getToken()), []);

  const markHydrated = useCallback(() => {
    hydratedRef.current = true;
  }, []);

  const setSnapshot = useCallback((snapshot) => {
    latestSnapshotRef.current = snapshot;
  }, []);

  const setBaseVersion = useCallback((version) => {
    baseVersionRef.current = Number.isFinite(version) ? version : null;
  }, []);

  const flush = useCallback(async (attempt = 0) => {
    if (!hydratedRef.current) return null;
    if (!isAuthenticated()) return null;
    if (!latestSnapshotRef.current) return null;

    /* Only the initial attempt respects in-flight coalescing; conflict retries
       run inside the same flush and must not bail out here. */
    if (attempt === 0 && inFlightRef.current) {
      queuedAfterFlightRef.current = true;
      return null;
    }
    inFlightRef.current = true;
    setSyncing(true);

    const snapshot = latestSnapshotRef.current;
    try {
      const doc = await api.updateDocument({
        snapshot,
        baseVersion: baseVersionRef.current,
      });
      if (Number.isFinite(doc?.version)) {
        baseVersionRef.current = doc.version;
      }
      setLastSyncedAt(Date.now());
      return doc;
    } catch (err) {
      if (err?.status === 401) {
        /* Token expired — api client clears the token; parent unmounts. */
        return null;
      }
      if (err?.status === 409 && attempt < MAX_CONFLICT_RETRIES) {
        /* Stale base version (another tab, the pagehide beacon, or a
           server-side change moved it). Re-fetch the current version, rebase,
           and retry so the tab doesn't get permanently wedged. The local
           snapshot re-applies on top — last-write-wins, this hook's model. */
        try {
          const remote = await api.getDocument();
          if (Number.isFinite(remote?.version)) {
            baseVersionRef.current = remote.version;
          }
        } catch (refetchErr) {
          console.warn(`[${featureKey}] conflict re-fetch failed`, refetchErr);
          return null;
        }
        return flush(attempt + 1);
      }
      console.warn(`[${featureKey}] sync push failed`, err);
      return null;
    } finally {
      /* Only the outermost attempt owns the in-flight flag and the queued
         follow-up; nested retries must leave them untouched. */
      if (attempt === 0) {
        inFlightRef.current = false;
        setSyncing(false);
        if (queuedAfterFlightRef.current) {
          queuedAfterFlightRef.current = false;
          schedulePush();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, featureKey, isAuthenticated]);

  const schedulePush = useCallback(() => {
    if (!hydratedRef.current) return;
    if (!isAuthenticated()) return;

    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      flush();
    }, debounceMs);
  }, [debounceMs, flush, isAuthenticated]);

  /* Initial fetch on mount (and on re-auth). */
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
      } catch (err) {
        if (err?.status !== 401) {
          console.warn(`[${featureKey}] sync initial fetch failed`, err);
        }
      }
    }
    run();
    function handleAuthChange() {
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

  /* Flush any pending debounced write on unmount. */
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
        flush().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBaseVersion = useCallback(() => baseVersionRef.current, []);

  return {
    initialServerDoc,
    syncing,
    lastSyncedAt,
    markHydrated,
    setSnapshot,
    setBaseVersion,
    getBaseVersion,
    schedulePush,
    flushNow: flush,
    isAuthenticated,
  };
}
