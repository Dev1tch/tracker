'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Globe, Plus, Check, X, ChevronDown, User } from 'lucide-react';

export default function AccountSwitcher({ accounts, onConnect, onToggle, onDisconnect }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (accounts.length === 0) {
    return (
      <button className="calConnectBtn" onClick={onConnect}>
        <Globe size={16} strokeWidth={1.5} />
        Connect Google Calendar
      </button>
    );
  }

  const activeAccounts = accounts.filter(a => a.active);

  return (
    <div className="account-dropdown-container" ref={containerRef}>
      <div className="calConnectedBar glass">
        <div className="calConnectedStatus">
          <div className={`calConnectedDot ${activeAccounts.length > 0 ? 'active' : 'paused'}`} />
          <span>{accounts.length} Account{accounts.length > 1 ? 's' : ''} Connected</span>
        </div>
        <div 
          className="account-trigger" 
          onClick={() => setIsOpen(!isOpen)}
          title="Manage Accounts"
        >
          <div className="account-mini-profile">
            {activeAccounts[0]?.picture ? (
              <img src={activeAccounts[0].picture} alt="" />
            ) : (
              <User size={12} />
            )}
          </div>
          <ChevronDown size={14} className={isOpen ? 'rotate' : ''} />
        </div>
      </div>

      {isOpen && (
        <div className="account-dropdown-menu glass">
          <div className="account-dropdown-header">
            <h4>Accounts</h4>
            <button className="dropdown-add-btn" onClick={() => { onConnect(); setIsOpen(false); }}>
              <Plus size={14} />
            </button>
          </div>
          
          <div className="account-dropdown-list">
            {accounts.map((account) => (
              <div key={account.email} className={`account-dropdown-item ${!account.active ? 'inactive' : ''}`}>
                <div className="item-info">
                  {account.picture ? (
                    <img src={account.picture} alt="" className="item-avatar" />
                  ) : (
                    <div className="item-avatar-placeholder"><User size={10} /></div>
                  )}
                  <div className="item-details">
                    <span className="item-email" title={account.email}>{account.email}</span>
                  </div>
                </div>
                
                <div className="item-actions">
                  <button 
                    className={`item-toggle-btn ${account.active ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggle(account.email); }}
                  >
                    {account.active ? <Check size={12} /> : <X size={12} />}
                  </button>
                  <button 
                    className="item-remove-btn"
                    onClick={(e) => { e.stopPropagation(); onDisconnect(account.email); }}
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .account-dropdown-container {
          position: relative;
          margin-bottom: 20px;
          z-index: 1000;
        }
        .account-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 0;
          transition: background 0.2s;
          margin-right: -4px;
        }
        .account-trigger:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .account-mini-profile {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .account-mini-profile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .calConnectedDot.paused {
          background: #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
        }
        .rotate {
          transform: rotate(180deg);
        }
        .account-dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          border: 1px solid var(--border-color);
          background: rgba(12, 12, 12, 0.98);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.42);
          border-radius: 0;
          animation: slideDown 0.2s ease-out;
          z-index: 1001;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .account-dropdown-header {
          padding: 8px 10px 7px;
          border-bottom: 1px solid var(--border-color-dim);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .account-dropdown-header h4 {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .dropdown-add-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          width: 24px;
          height: 24px;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .dropdown-add-btn:hover {
          color: rgba(255, 255, 255, 1);
          transform: scale(1.1);
        }
        .account-dropdown-list {
          padding: 7px 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .account-dropdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          border-radius: 0;
          background: rgba(255, 255, 255, 0.02);
          border: none;
          transition: all 0.2s;
        }
        .account-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .account-dropdown-item.inactive {
          opacity: 0.5;
        }
        .item-info {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }
        .item-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .item-avatar-placeholder {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .item-email {
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        .item-actions {
          display: flex;
          gap: 6px;
        }
        .item-toggle-btn, .item-remove-btn {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: rgba(255, 255, 255, 0.3);
          width: 26px;
          height: 26px;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .item-toggle-btn.active {
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
        }
        .item-toggle-btn:hover:not(.active) {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }
        .item-remove-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
        }
      `}</style>
    </div>
  );
}
