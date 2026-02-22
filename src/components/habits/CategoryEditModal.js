import React, { useState, useEffect } from 'react';
import { categoriesApi } from '@/lib/api';

export default function CategoryEditModal({ category, onClose, onSuccess, onDelete }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [color, setColor] = useState('#ffffff');

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setColor(category.color || '#ffffff');
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await categoriesApi.updateCategory(category.id, {
        name,
        color
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to update category', err);
      setError('Failed to update category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!category) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">Edit Category</h2>
        </div>

        {error && <div className="authError" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="creationForm">
          <div className="formGroup">
            <label>Category Name *</label>
            <input 
              type="text" 
              className="authInput" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Health"
              required
            />
          </div>

          <div className="formGroup">
            <label>Category Color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '40px' }}
              />
              <input 
                type="text" 
                className="authInput" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#ffffff"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="modalActions" style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            {onDelete ? (
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={onDelete} 
                disabled={isSubmitting}
                style={{ color: '#ff4d4d', borderColor: 'rgba(255, 77, 77, 0.3)' }}
              >
                Delete Category
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isSubmitting || !name}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
