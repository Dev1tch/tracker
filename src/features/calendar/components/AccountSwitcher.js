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
            <span>Accounts</span>
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
          border-radius: 8px;
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
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: slideDown 0.2s ease-out;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
          background: rgba(20, 20, 25, 0.95);
          backdrop-filter: blur(15px);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .account-dropdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.7rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 0 4px;
        }
        .dropdown-add-btn {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .dropdown-add-btn:hover {
          background: var(--primary-color, #7c3aed);
          transform: scale(1.05);
        }
        .account-dropdown-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .account-dropdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.2s;
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
          border-radius: 6px;
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
