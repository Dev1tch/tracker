'use client';

import React, { useState } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import { generateId } from '@/features/finance/lib/defaults';

const TABS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

export default function CategoriesModal({ open, vault, onClose, onChange }) {
  const [tab, setTab] = useState('expense');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', color: '#7f8c8d' });

  if (!open) return null;

  const transactions = vault.transactions || [];
  const categories = (vault.categories || []).filter((c) => c.type === tab);

  const handleCreate = () => {
    if (!draft.name.trim()) return;
    const newCat = {
      id: generateId(),
      name: draft.name.trim(),
      type: tab,
      color: draft.color,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    onChange((data) => ({ ...data, categories: [...data.categories, newCat] }));
    setDraft({ name: '', color: '#7f8c8d' });
    setAdding(false);
  };

  const handleArchive = (id, archived) => {
    onChange((data) => ({
      ...data,
      categories: data.categories.map((c) => (c.id === id ? { ...c, archived } : c)),
    }));
  };

  const handleRename = (id, name) => {
    onChange((data) => ({
      ...data,
      categories: data.categories.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  };

  const handleColor = (id, color) => {
    onChange((data) => ({
      ...data,
      categories: data.categories.map((c) => (c.id === id ? { ...c, color } : c)),
    }));
  };

  const handleDelete = (id) => {
    const inUse = transactions.some((t) => t.categoryId === id);
    if (inUse) {
      const ok = window.confirm(
        'This category is used by transactions. Deleting it will leave them uncategorized. Continue?'
      );
      if (!ok) return;
    }
    onChange((data) => ({
      ...data,
      categories: data.categories.filter((c) => c.id !== id),
    }));
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalContent financeModal financeWideModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <h2 className="modalTitle">Categories</h2>
        </div>

        <div className="financeTabRow">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`financeTab ${tab === t.value ? 'active' : ''}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="financeManagerList">
          {categories.length === 0 && (
            <div className="financeManagerEmpty">
              No {tab} categories yet.
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className={`financeManagerRow ${cat.archived ? 'archived' : ''}`}>
              <div className="financeManagerColorWrap">
                <ColorPicker value={cat.color || '#7f8c8d'} onChange={(c) => handleColor(cat.id, c)} />
              </div>
              <div className="financeManagerMain">
                <input
                  type="text"
                  className="financeInlineInput"
                  value={cat.name}
                  onChange={(e) => handleRename(cat.id, e.target.value)}
                />
                <div className="financeManagerMeta">
                  <span>{tab === 'income' ? 'Income' : 'Expense'}</span>
                </div>
              </div>
              <div className="financeManagerActions">
                <button
                  type="button"
                  className="financeIconBtn"
                  onClick={() => handleArchive(cat.id, !cat.archived)}
                  title={cat.archived ? 'Restore' : 'Archive'}
                >
                  {cat.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
                <button
                  type="button"
                  className="financeIconBtn danger"
                  onClick={() => handleDelete(cat.id)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="financeInlineForm">
            <h4>New {tab} category</h4>
            <div className="financeFieldGroup">
              <label>Name</label>
              <input
                type="text"
                className="authInput"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Coffee"
              />
            </div>
            <div className="financeFieldGroup">
              <label>Color</label>
              <ColorPicker value={draft.color} onChange={(c) => setDraft({ ...draft, color: c })} />
            </div>
            <div className="modalActions" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={!draft.name.trim()}
              >
                Add category
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="financeAddRow" onClick={() => setAdding(true)}>
            <Plus size={14} />
            <span>Add {tab} category</span>
          </button>
        )}

        <div className="modalActions" style={{ marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
