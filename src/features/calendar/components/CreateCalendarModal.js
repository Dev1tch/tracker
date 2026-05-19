'use client';

import React, { useState } from 'react';
import { X, Calendar as CalIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import ColorPicker from '@/components/ui/ColorPicker';

const CALENDAR_COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6', '#0ea5e9'
];

export default function CreateCalendarModal({ isOpen, onClose, onCreate }) {
  const toast = useToast();
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary) return;
    setLoading(true);
    try {
      await onCreate({ summary, description, color });
      onClose();
      setSummary('');
      setDescription('');
      setColor('#3b82f6');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to create calendar', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="calModalOverlay" onClick={onClose}>
      <div className="calModal glass" onClick={(e) => e.stopPropagation()}>
        <header className="calModalHeader">
          <h3>New Calendar</h3>
          <button className="calModalClose" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="calModalForm">
          <div className="calFormGroup">
            <label><CalIcon size={16} /> Calendar Name</label>
            <input
              type="text"
              className="authInput"
              placeholder="e.g. Work, Personal, Side Projects"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="calFormGroup">
            <label>Color</label>
            <div className="calColorPickerWrap">
              <ColorPicker
                value={color}
                onChange={setColor}
                presets={CALENDAR_COLOR_PRESETS}
              />
            </div>
          </div>

          <div className="calFormGroup">
            <label>Description (Optional)</label>
            <textarea
              className="authInput calTextarea"
              placeholder="Describe what this calendar is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <footer className="calModalFooter">
            <div className="calModalActions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading || !summary}>
                {loading ? <Loader2 size={16} className="spin" /> : 'Create Calendar'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
