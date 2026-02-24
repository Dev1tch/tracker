import React, { useState, useEffect } from 'react';

export default function HabitLogModal({ habit, date, existingLog, onClose, onSave }) {
  const [status, setStatus] = useState('empty');
  const [notes, setNotes] = useState('');
  
  useEffect(() => {
    if (existingLog) {
      setStatus(existingLog.is_successful !== undefined ? (existingLog.is_successful ? 'completed' : 'failed') : 'empty');
      setNotes(existingLog.comment || '');
    }
  }, [existingLog]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (status === 'empty') return; // Must select success or fail
    
    onSave({
       is_successful: status === 'completed',
       comment: notes
    });
  };

  if (!habit || !date) return null;

  const dateStr = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">{habit.name}</h2>
          <p className="modalDate">{dateStr}</p>
        </div>

        <form onSubmit={handleSubmit}>
          
          <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '10px', display: 'block' }}>
            Status
          </label>
          <div className="statusToggle">
            <button 
              type="button"
              className={`statusBtn success ${status === 'completed' ? 'active' : ''}`}
              onClick={() => setStatus('completed')}
            >
              Successful
            </button>
            <button 
              type="button"
              className={`statusBtn fail ${status === 'failed' ? 'active' : ''}`}
              onClick={() => setStatus('failed')}
            >
              Unsuccessful
            </button>
          </div>

          <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '10px', display: 'block' }}>
            Notes / Reason (Optional)
          </label>
          <textarea 
            className="commentInput"
            placeholder="Why was this unsuccessful? Or add notes for success..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="modalActions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={status === 'empty'}>
              Save
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
