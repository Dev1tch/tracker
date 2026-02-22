import React from 'react';
import '../habits/Habits.css';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">{title}</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>
        <div className="modalActions">
          <button className="btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className="btn-primary" onClick={onConfirm} style={{ background: 'rgba(255, 77, 77, 0.2)', color: '#ff4d4d', borderColor: 'rgba(255, 77, 77, 0.5)' }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
