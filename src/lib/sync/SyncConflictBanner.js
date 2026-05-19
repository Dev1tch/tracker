'use client';

import React from 'react';
import './SyncConflictBanner.css';

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  } catch {
    return '';
  }
}

export default function SyncConflictBanner({ updatedAt, onReload, onKeepLocal }) {
  const when = formatTime(updatedAt);
  return (
    <div className="syncConflictBanner" role="alert">
      <div className="syncConflictText">
        <strong>Newer changes from another device</strong>
        {when && <span className="syncConflictWhen"> · saved {when}</span>}
        <p>Reload to use the server copy, or keep your local edits and overwrite the server on the next save.</p>
      </div>
      <div className="syncConflictActions">
        <button type="button" className="syncConflictBtn primary" onClick={onReload}>
          Reload from server
        </button>
        <button type="button" className="syncConflictBtn" onClick={onKeepLocal}>
          Keep local
        </button>
      </div>
    </div>
  );
}
