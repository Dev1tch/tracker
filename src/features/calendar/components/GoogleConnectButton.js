'use client';

import React from 'react';
import { LogOut, Globe } from 'lucide-react';

export default function GoogleConnectButton({ isConnected, onConnect, onDisconnect }) {
  if (isConnected) {
    return (
      <div className="calConnectedBar glass">
        <div className="calConnectedStatus">
          <div className="calConnectedDot" />
          <span>Synchronized with Google</span>
        </div>
        <button className="calDisconnectBtn" onClick={onDisconnect}>
          <LogOut size={12} style={{ marginRight: '6px' }} />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button className="calConnectBtn" onClick={onConnect}>
      <Globe size={16} strokeWidth={1.5} />
      Connect Google Calendar
    </button>
  );
}
