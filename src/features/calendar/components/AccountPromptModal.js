'use client';

import React from 'react';
import { X, User } from 'lucide-react';

export default function AccountPromptModal({ isOpen, onClose, accounts, onSelect }) {
  if (!isOpen) return null;

  return (
    <div className="calModalOverlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="calModal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <header className="calModalHeader">
          <h3>Select Account</h3>
          <button className="calModalClose" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="calModalBody" style={{ padding: '20px' }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px', fontSize: '14px' }}>
            To which account should this event be added? It will be created in the primary calendar.
          </p>
          
          <div className="calAccountList" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {accounts.filter(a => a.active).map(account => (
              <button
                key={account.email}
                className="calAccountItem glass-hover"
                onClick={() => onSelect(account.email)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '0',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  color: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  width: '100%'
                }}
              >
                <div className="calAccountAvatar" style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  {account.picture ? (
                    <img src={account.picture} alt="" style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{account.email}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="calModalFooter" style={{ padding: '15px 20px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>Cancel</button>
        </footer>
      </div>

      <style jsx>{`
        .calAccountItem:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: var(--accent-light) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
