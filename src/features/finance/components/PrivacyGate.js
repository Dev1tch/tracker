'use client';

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  currencyToSelectOption,
} from '@/features/finance/lib/defaults';

function PassphraseField({ value, onChange, placeholder, autoFocus = false, name = 'passphrase' }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="financePassphraseField">
      <input
        type={visible ? 'text' : 'password'}
        className="authInput"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        name={name}
      />
      <button
        type="button"
        className="financePassphraseToggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function PrivacyPledge() {
  return (
    <div className="financePledge">
      <div className="financePledgeRow">
        <Cpu size={14} />
        <span>Everything stays in this browser. Nothing is sent to a server.</span>
      </div>
      <div className="financePledgeRow">
        <Lock size={14} />
        <span>Your passphrase encrypts the vault locally. We can&apos;t recover or read it.</span>
      </div>
      <div className="financePledgeRow warning">
        <AlertTriangle size={14} />
        <span>If you clear browser data or lose the passphrase, the vault is gone.</span>
      </div>
    </div>
  );
}

function OnboardingScreen({ onCreate }) {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const passphraseTooShort = passphrase.length > 0 && passphrase.length < 8;
  const mismatch = confirm.length > 0 && confirm !== passphrase;
  const canSubmit =
    !submitting &&
    accepted &&
    passphrase.length >= 8 &&
    confirm === passphrase;

  const formId = 'finance-onboarding-form';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await onCreate({ passphrase, currency });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to set up the vault.');
      setSubmitting(false);
    }
  };

  return (
    <div className="calEventPageOverlay financeGateOverlay">
      <div className="calEventPage financeGatePage" onClick={(e) => e.stopPropagation()}>
        <header className="calModalHeader calEventPageHeader">
          <div className="calEventPageHeading">
            <span className="calEventPageLabel">
              <ShieldCheck size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
              Finance vault
            </span>
            <h2 className="calEventPageTitle">Create your vault</h2>
            <p className="calEventPageMeta">
              Your money stays yours — encrypted on this device, never sent anywhere.
            </p>
          </div>
          <div className="calEventPageHeaderActions">
            <div className="calEventPagePrimaryActions">
              <button
                type="submit"
                form={formId}
                className="btn-primary calEventPageActionBtn"
                disabled={!canSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 size={12} className="spin" style={{ marginRight: 6 }} />
                    Sealing...
                  </>
                ) : (
                  'Create vault'
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="calEventPageBody">
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="calModalForm calEventPageForm financeGateForm"
          >
            <PrivacyPledge />

            <div className="calFormRow financeGateRow">
              <div className="calFormGroup">
                <label>
                  <Cpu size={12} /> Default currency
                </label>
                <CustomSelect
                  options={CURRENCY_OPTIONS.map(currencyToSelectOption)}
                  value={currency}
                  onChange={setCurrency}
                  placeholder="Select currency"
                  searchable
                  searchPlaceholder="Search by code or name"
                />
              </div>
            </div>

            <div className="calFormRow financeGateRow">
              <div className="calFormGroup">
                <label>
                  <KeyRound size={12} /> Vault passphrase
                </label>
                <PassphraseField
                  value={passphrase}
                  onChange={setPassphrase}
                  placeholder="At least 8 characters"
                  autoFocus
                />
                {passphraseTooShort ? (
                  <div className="financeHint warn">Use at least 8 characters.</div>
                ) : (
                  <div className="financeHint">A long phrase you can remember works best.</div>
                )}
              </div>
              <div className="calFormGroup">
                <label>
                  <KeyRound size={12} /> Confirm passphrase
                </label>
                <PassphraseField
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Repeat the passphrase"
                />
                {mismatch ? (
                  <div className="financeHint warn">Passphrases don&apos;t match.</div>
                ) : (
                  <div className="financeHint">Same as above. We never store this.</div>
                )}
              </div>
            </div>

            <div className="financeAckBox">
              <label className="financeAck">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  I understand that if I forget the passphrase or lose this browser&apos;s
                  storage, my finance data cannot be recovered.
                </span>
              </label>
            </div>

            {error && <div className="authError" style={{ marginTop: 0 }}>{error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

function UnlockScreen({ onUnlock, onImport, onDestroy }) {
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDestroy, setShowDestroy] = useState(false);
  const [destroyConfirm, setDestroyConfirm] = useState('');
  const fileInputRef = useRef(null);

  const formId = 'finance-unlock-form';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passphrase) return;
    setSubmitting(true);
    setError('');
    try {
      await onUnlock(passphrase);
    } catch (err) {
      setError(err.message || 'Could not unlock.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await onImport(payload);
    } catch (err) {
      setError(err.message || 'Failed to read backup file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="calEventPageOverlay financeGateOverlay">
      <div className="calEventPage financeGatePage" onClick={(e) => e.stopPropagation()}>
        <header className="calModalHeader calEventPageHeader">
          <div className="calEventPageHeading">
            <span className="calEventPageLabel">
              <Lock size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
              Finance vault
            </span>
            <h2 className="calEventPageTitle">Unlock vault</h2>
            <p className="calEventPageMeta">
              Enter the passphrase you set on this device. We can&apos;t reset it.
            </p>
          </div>
          <div className="calEventPageHeaderActions">
            <div className="calEventPagePrimaryActions">
              <button
                type="submit"
                form={formId}
                className="btn-primary calEventPageActionBtn"
                disabled={submitting || !passphrase}
              >
                {submitting ? (
                  <>
                    <Loader2 size={12} className="spin" style={{ marginRight: 6 }} />
                    Decrypting...
                  </>
                ) : (
                  'Unlock'
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="calEventPageBody">
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="calModalForm calEventPageForm financeGateForm"
          >
            <div className="calFormRow financeGateRow">
              <div className="calFormGroup">
                <label>
                  <KeyRound size={12} /> Passphrase
                </label>
                <PassphraseField
                  value={passphrase}
                  onChange={setPassphrase}
                  placeholder="Vault passphrase"
                  autoFocus
                />
              </div>
            </div>

            {error && <div className="authError" style={{ marginTop: 0 }}>{error}</div>}
          </form>

          <div className="financeGateBodyExtra">
            <div className="financeGateSection">
              <div className="financeGateSectionHead">
                <Upload size={12} />
                <h3>Restore from backup</h3>
              </div>
              <p className="financeGateSectionHint">
                Pick the encrypted JSON file you exported earlier. We&apos;ll ask for the
                passphrase that protects it — never sent anywhere.
              </p>
              <button
                type="button"
                className="btn-secondary financeGateInlineBtn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={12} style={{ marginRight: 6 }} />
                Choose backup file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={handleImport}
              />
            </div>

            <div className="financeGateSection danger">
              <div className="financeGateSectionHead">
                <AlertTriangle size={12} />
                <h3>Forgot passphrase</h3>
              </div>
              <p className="financeGateSectionHint">
                Resetting permanently deletes the encrypted vault from this browser. There is
                no recovery unless you have an exported backup.
              </p>
              {!showDestroy ? (
                <button
                  type="button"
                  className="btn-secondary financeGateInlineBtn financeDangerLink"
                  onClick={() => setShowDestroy(true)}
                >
                  Reset this vault
                </button>
              ) : (
                <div className="financeDangerBox">
                  <input
                    type="text"
                    className="authInput"
                    placeholder='Type "DELETE" to confirm'
                    value={destroyConfirm}
                    onChange={(e) => setDestroyConfirm(e.target.value)}
                  />
                  <div className="financeGateInlineActions">
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
                      disabled={destroyConfirm !== 'DELETE'}
                      onClick={() => onDestroy()}
                    >
                      Permanently delete vault
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyGate({ status, actions, error }) {
  if (status === 'initializing') {
    return (
      <div className="calEventPageOverlay financeGateOverlay">
        <div className="calEventPage financeGatePage financeGateLoadingPage">
          <div className="financeGateLoading">
            <Loader2 size={18} className="spin" />
            <span>Reading local vault...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="calEventPageOverlay financeGateOverlay">
        <div className="calEventPage financeGatePage">
          <header className="calModalHeader calEventPageHeader">
            <div className="calEventPageHeading">
              <span className="calEventPageLabel">
                <AlertTriangle size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
                Finance vault
              </span>
              <h2 className="calEventPageTitle">Storage unavailable</h2>
              <p className="calEventPageMeta">
                {error || 'Your browser blocked local storage. The vault needs IndexedDB to function.'}
              </p>
            </div>
          </header>
          <div className="calEventPageBody">
            <div className="calEventPageForm financeGateForm">
              <p className="financeGateSectionHint">
                Try disabling private/incognito mode, or check your browser&apos;s site settings
                for IndexedDB access on this domain.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <OnboardingScreen
        onCreate={async ({ passphrase, currency }) => {
          await actions.createVault({ passphrase, currency });
        }}
      />
    );
  }

  return (
    <UnlockScreen
      onUnlock={async (passphrase) => actions.unlock(passphrase)}
      onImport={async (payload) => {
        const passphrase = window.prompt(
          'Enter the passphrase that protects this backup. It is never sent anywhere.'
        );
        if (!passphrase) throw new Error('Restore cancelled.');
        await actions.importEncrypted({ payload, passphrase });
      }}
      onDestroy={async () => {
        await actions.destroyVault();
      }}
    />
  );
}
