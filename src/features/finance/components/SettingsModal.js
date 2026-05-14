'use client';

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Cpu,
  Download,
  KeyRound,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { CURRENCY_OPTIONS, currencyToSelectOption } from '@/features/finance/lib/defaults';
import { useToast } from '@/components/ui/ToastProvider';

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Never (until I lock manually)' },
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
];

export default function SettingsModal({ open, vault, actions, onClose }) {
  const addToast = useToast();
  const fileInputRef = useRef(null);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [passError, setPassError] = useState('');
  const [destroyConfirm, setDestroyConfirm] = useState('');
  const [showDestroy, setShowDestroy] = useState(false);

  if (!open) return null;

  const settings = vault.settings || {};

  const handleUpdateSettings = (patch) => {
    actions.updateData((data) => ({
      ...data,
      settings: { ...data.settings, ...patch },
    }));
  };

  const handleExport = async () => {
    try {
      const payload = await actions.exportEncrypted();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `life-tracker-finance-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Backup downloaded. Store it somewhere safe.', 'success', 3500);
    } catch (err) {
      addToast(err.message || 'Failed to export backup.', 'error');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const passphrase = window.prompt(
        'Enter the passphrase for this backup. It is processed only in your browser.'
      );
      if (!passphrase) {
        addToast('Restore cancelled.', 'warning');
        return;
      }
      await actions.importEncrypted({ payload, passphrase });
      addToast('Vault restored from backup.', 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to restore backup.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleChangePassphrase = async () => {
    setPassError('');
    if (newPass.length < 8) {
      setPassError('New passphrase must be at least 8 characters.');
      return;
    }
    if (newPass !== newPassConfirm) {
      setPassError('Confirmation does not match.');
      return;
    }
    try {
      await actions.changePassphrase({ current: currentPass, next: newPass });
      addToast('Passphrase updated.', 'success');
      setCurrentPass('');
      setNewPass('');
      setNewPassConfirm('');
    } catch (err) {
      setPassError(err.message || 'Failed to change passphrase.');
    }
  };

  const handleDestroy = async () => {
    if (destroyConfirm !== 'DELETE') return;
    try {
      await actions.destroyVault();
      addToast('Vault deleted from this browser.', 'warning', 4000);
    } catch (err) {
      addToast(err.message || 'Failed to delete vault.', 'error');
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalContent financeModal financeWideModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <h2 className="modalTitle">Vault settings</h2>
          <p className="modalDate">
            Privacy posture, backups, and the kill switch all live here.
          </p>
        </div>

        <section className="financeSettingsSection">
          <header className="financeSettingsHeader">
            <Cpu size={14} />
            <h3>Privacy posture</h3>
          </header>
          <div className="financePledge inline">
            <div className="financePledgeRow">
              <Lock size={12} />
              <span>Encrypted with AES-GCM, key derived from your passphrase.</span>
            </div>
            <div className="financePledgeRow">
              <ShieldCheck size={12} />
              <span>Stored only in this browser&apos;s IndexedDB. No network calls.</span>
            </div>
          </div>

          <div className="financeFieldGrid" style={{ marginTop: 16 }}>
            <div className="financeFieldGroup">
              <label>Default currency</label>
              <CustomSelect
                options={CURRENCY_OPTIONS.map(currencyToSelectOption)}
                value={settings.defaultCurrency}
                onChange={(v) => handleUpdateSettings({ defaultCurrency: v })}
                searchable
                searchPlaceholder="Search by code or name"
              />
            </div>
            <div className="financeFieldGroup">
              <label>Auto-lock after inactivity</label>
              <CustomSelect
                options={AUTO_LOCK_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={settings.autoLockMinutes ?? 15}
                onChange={(v) => handleUpdateSettings({ autoLockMinutes: Number(v) })}
              />
            </div>
          </div>
        </section>

        <section className="financeSettingsSection">
          <header className="financeSettingsHeader">
            <Download size={14} />
            <h3>Backup &amp; restore</h3>
          </header>
          <p className="financeSettingsHint">
            The export is the same encrypted blob that lives in your browser. Anyone with the
            file <em>and</em> your passphrase can read it. Anyone with just the file can&apos;t.
          </p>
          <div className="financeSettingsActions">
            <button type="button" className="btn-primary" onClick={handleExport}>
              <Download size={12} style={{ marginRight: 6 }} />
              Export encrypted backup
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={12} style={{ marginRight: 6 }} />
              Restore from file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={handleImport}
            />
          </div>
          {settings.lastBackupAt && (
            <div className="financeSettingsMeta">
              Last backup: {new Date(settings.lastBackupAt).toLocaleString()}
            </div>
          )}
        </section>

        <section className="financeSettingsSection">
          <header className="financeSettingsHeader">
            <KeyRound size={14} />
            <h3>Change passphrase</h3>
          </header>
          <div className="financeFieldGroup">
            <label>Current passphrase</label>
            <input
              type="password"
              className="authInput"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="financeFieldGrid">
            <div className="financeFieldGroup">
              <label>New passphrase</label>
              <input
                type="password"
                className="authInput"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="financeFieldGroup">
              <label>Confirm new passphrase</label>
              <input
                type="password"
                className="authInput"
                value={newPassConfirm}
                onChange={(e) => setNewPassConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          {passError && <div className="authError">{passError}</div>}
          <div className="financeSettingsActions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleChangePassphrase}
              disabled={!currentPass || !newPass || !newPassConfirm}
            >
              Update passphrase
            </button>
          </div>
        </section>

        <section className="financeSettingsSection danger">
          <header className="financeSettingsHeader">
            <AlertTriangle size={14} />
            <h3>Reset everything</h3>
          </header>
          <p className="financeSettingsHint">
            Deletes the encrypted vault from this browser. Only use this if you have an
            exported backup or you want to start fresh.
          </p>
          {showDestroy ? (
            <>
              <input
                type="text"
                className="authInput"
                placeholder='Type "DELETE" to confirm'
                value={destroyConfirm}
                onChange={(e) => setDestroyConfirm(e.target.value)}
              />
              <div className="financeSettingsActions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowDestroy(false);
                    setDestroyConfirm('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary financeDangerBtn"
                  onClick={handleDestroy}
                  disabled={destroyConfirm !== 'DELETE'}
                >
                  <Trash2 size={12} style={{ marginRight: 6 }} />
                  Permanently delete vault
                </button>
              </div>
            </>
          ) : (
            <div className="financeSettingsActions">
              <button
                type="button"
                className="btn-secondary financeDangerLink"
                onClick={() => setShowDestroy(true)}
              >
                Delete vault from this browser
              </button>
            </div>
          )}
        </section>

        <div className="modalActions" style={{ marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
