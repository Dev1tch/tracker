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
  X,
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
    <div className="tasksModalOverlay" onClick={onClose}>
      <div
        className="tasksModal finSettingsModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tasksModalHeader">
          <h3>Vault settings</h3>
          <div className="tasksModalHeaderActions">
            <button type="button" className="tasksIconBtn" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="finSettingsBody">
          <div className="finSettingsTopRow">
            <section className="finSettingsCard">
              <header className="finSettingsCardHead">
                <Cpu size={13} />
                <h4>Privacy posture</h4>
              </header>
              <ul className="finSettingsPledge">
                <li>
                  <Lock size={11} />
                  <span>Encrypted with AES-GCM, key derived from your passphrase.</span>
                </li>
                <li>
                  <ShieldCheck size={11} />
                  <span>Stored only in this browser&apos;s IndexedDB. No network calls.</span>
                </li>
              </ul>
              <div className="finSettingsFieldGrid">
                <div className="tasksField">
                  <label>Default currency</label>
                  <CustomSelect
                    options={CURRENCY_OPTIONS.map(currencyToSelectOption)}
                    value={settings.defaultCurrency}
                    onChange={(v) => handleUpdateSettings({ defaultCurrency: v })}
                    searchable
                    searchPlaceholder="Search by code or name"
                  />
                </div>
                <div className="tasksField">
                  <label>Auto-lock</label>
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

            <section className="finSettingsCard">
              <header className="finSettingsCardHead">
                <Download size={13} />
                <h4>Backup &amp; restore</h4>
              </header>
              <p className="finSettingsHint">
                The export is the encrypted blob from your browser. Anyone with the file{' '}
                <em>and</em> your passphrase can read it. Anyone with just the file can&apos;t.
              </p>
              <div className="finSettingsActions">
                <button
                  type="button"
                  className="tasksBtn tasksBtnPrimary tasksBtnCompact"
                  onClick={handleExport}
                >
                  <Download size={12} />
                  Export
                </button>
                <button
                  type="button"
                  className="tasksBtn tasksBtnCompact"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={12} />
                  Restore
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
                <div className="finSettingsMeta">
                  Last backup: {new Date(settings.lastBackupAt).toLocaleString()}
                </div>
              )}
            </section>
          </div>

          <section className="finSettingsCard">
            <header className="finSettingsCardHead">
              <KeyRound size={13} />
              <h4>Change passphrase</h4>
            </header>
            <div className="finSettingsPassRow">
              <div className="tasksField">
                <label>Current</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="tasksField">
                <label>New</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="tasksField">
                <label>Confirm new</label>
                <input
                  type="password"
                  value={newPassConfirm}
                  onChange={(e) => setNewPassConfirm(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className="tasksBtn tasksBtnPrimary"
                onClick={handleChangePassphrase}
                disabled={!currentPass || !newPass || !newPassConfirm}
              >
                Update
              </button>
            </div>
            {passError && <div className="authError">{passError}</div>}
          </section>

          <section className="finSettingsCard finSettingsCardDanger">
            <header className="finSettingsCardHead">
              <AlertTriangle size={13} />
              <h4>Reset everything</h4>
            </header>
            <div className="finSettingsResetRow">
              <p className="finSettingsHint">
                Deletes the encrypted vault from this browser. Only use this if you have an
                exported backup or you want to start fresh.
              </p>
              {showDestroy ? (
                <div className="finSettingsResetForm">
                  <input
                    type="text"
                    className="finSettingsResetInput"
                    placeholder='Type "DELETE"'
                    value={destroyConfirm}
                    onChange={(e) => setDestroyConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    className="tasksBtn tasksBtnCompact"
                    onClick={() => {
                      setShowDestroy(false);
                      setDestroyConfirm('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="tasksBtn tasksBtnCompact finSettingsDangerBtn"
                    onClick={handleDestroy}
                    disabled={destroyConfirm !== 'DELETE'}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="tasksBtn tasksBtnCompact finSettingsDangerLink"
                  onClick={() => setShowDestroy(true)}
                >
                  Delete vault from this browser
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
