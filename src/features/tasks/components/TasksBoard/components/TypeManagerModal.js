import React from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';

export default function TypeManagerModal({
  isOpen,
  onClose,
  taskTypes,
  typeForm,
  setTypeForm,
  onCreate,
  onDelete,
  isCreating,
}) {
  if (!isOpen) return null;

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      <div className="tasksModal tasksTypeModal" onClick={(e) => e.stopPropagation()}>
        <div className="tasksModalHeader">
          <h3>Task Types</h3>
          <button type="button" className="tasksIconBtn" onClick={onClose}>
            <X size={16} />
          </button>
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
            <input
              type="color"
              value={typeForm.color}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, color: e.target.value }))}
            />
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
          <div className="tasksField tasksFieldInline">
            <button
              type="button"
              className="tasksBtn tasksBtnPrimary"
              onClick={onCreate}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Create
            </button>
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
