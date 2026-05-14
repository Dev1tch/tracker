'use client';

import React from 'react';
import { useVaultContext } from './hooks/useVault';
import PrivacyGate from './components/PrivacyGate';
import Dashboard from './components/Dashboard';
import './Finance.css';

export default function Finance() {
  const { status, error, data, actions, lastSavedAt } = useVaultContext();

  if (status !== 'unlocked' || !data) {
    return (
      <PrivacyGate
        status={status}
        actions={actions}
        error={error}
      />
    );
  }

  return (
    <Dashboard
      vault={data}
      actions={actions}
      lastSavedAt={lastSavedAt}
    />
  );
}
