import React, { useCallback } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';

const TYPE_COLOR_PRESETS = [
  '#94a3b8',
  '#60a5fa',
  '#9ca3af',
  '#fbbf24',
  '#34d399',
  '#f87171',
  '#6b7280',
  '#e879f9',
  '#a78bfa',
  '#2dd4bf',
  '#4ade80',
  '#f97316',
];

export default function CategoryManagerModal({
  isOpen,
  onClose,
  taskTypes,
  typeForm,
  setTypeForm,
  onCreate,
  onDelete,
  isCreating,
}) {
  const handleColorChange = useCallback((nextColor) => {
    setTypeForm((prev) => ({ ...prev, color: nextColor }));
  }, [setTypeForm]);

  if (!isOpen) return null;

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      <div className="tasksModal tasksTypeModal" onClick={(e) => e.stopPropagation()}>
        <div className="tasksModalHeader">
          <h3>Task Types</h3>
          <div className="tasksModalHeaderActions">
            <button
              type="button"
              className="tasksBtn tasksBtnPrimary tasksBtnCompact"
              onClick={onCreate}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Create
            </button>
            <button type="button" className="tasksIconBtn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="tasksTypeCreateGrid">
          <div className="tasksField">
            <label>Name</label>
            <input
              type="text"
              value={typeForm.name}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Type name"
            />
          </div>
          <div className="tasksField">
            <label>Color</label>
            <div className="tasksTypeColorField">
              <ColorPicker
                value={typeForm.color || '#6ea8fe'}
                onChange={handleColorChange}
                presets={TYPE_COLOR_PRESETS}
              />
            </div>
          </div>
          <div className="tasksField tasksFieldFull">
            <label>Description</label>
            <input
              type="text"
              value={typeForm.description}
              onChange={(e) =>
                setTypeForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description"
            />
          </div>
        </div>

        <div className="tasksTypeList">
          {taskTypes.length === 0 ? (
            <p className="tasksMutedText">No task types yet.</p>
          ) : (
            taskTypes.map((type) => (
              <div key={type.id} className="tasksTypeItem">
                <div className="tasksTypeInfo">
                  <span
                    className="tasksTypeColor"
                    style={{ backgroundColor: type.color || '#6ea8fe' }}
                  />
                  <div>
                    <strong>{type.name}</strong>
                    <p>{type.description || 'No description'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="tasksIconBtn danger tasksTypeDeleteBtn"
                  onClick={() => onDelete(type.id)}
                  title="Delete task type"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
