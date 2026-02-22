import React, { useState, useEffect } from 'react';
import { categoriesApi, habitsApi } from '@/lib/api';
import CustomSelect from '../ui/CustomSelect';

export default function HabitEditModal({ habit, categories, onClose, onSuccess, onDelete }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Habit Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Normal');
  
  // Category Fields
  const [categoryId, setCategoryId] = useState(''); // '' means no category
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#ffffff');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name || '');
      setDescription(habit.description || '');
      setPriority(habit.priority || 'Normal');
      setCategoryId(habit.category_id || '');
    }
  }, [habit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await habitsApi.updateHabit(habit.id, {
        name,
        description,
        priority,
        category_id: categoryId || null
      });

      onSuccess(); // Close modal and refresh
    } catch (err) {
      console.error('Failed to update habit', err);
      setError('Failed to update habit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName) {
      setError('Please provide a name for the new category.');
      return;
    }

    setError('');
    setIsSubmittingCategory(true);

    try {
      const newCat = await categoriesApi.createCategory({
        name: newCategoryName,
        color: newCategoryColor,
        icon: 'circle'
      });
      
      // Update local categories list optimistically
      categories.push(newCat);
      setCategoryId(newCat.id);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryColor('#ffffff');
    } catch (err) {
      console.error('Failed to create category', err);
      setError('Failed to create category.');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const priorityOptions = [
    { value: 'Normal', label: 'Normal' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' }
  ];

  const categoryOptions = [
    { value: '', label: 'No Category' },
    ...categories.map(c => ({ value: c.id, label: c.name, color: c.color }))
  ];

  if (!habit) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">Edit Habit</h2>
        </div>

        {error && <div className="authError" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="creationForm">
          
          <div className="formGroup">
            <label>Habit Name *</label>
            <input 
              type="text" 
              className="authInput" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Read for 30 minutes"
              required
            />
          </div>

          <div className="formGroup">
            <label>Priority</label>
            <CustomSelect 
              options={priorityOptions}
              value={priority}
              onChange={setPriority}
            />
          </div>

          <div className="formGroup">
            <label>Category</label>
            <CustomSelect 
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select Category"
              onCreateNew={() => setIsCreatingCategory(true)}
              createNewText="+ Create New Category"
            />
          </div>

          {isCreatingCategory && (
            <div className="inlineCategoryCreation">
              <h4 style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 500 }}>Create New Category</h4>
              <div className="formGroup">
                <label>Category Name *</label>
                <input 
                  type="text" 
                  className="authInput" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Health"
                />
              </div>
              <div className="formGroup">
                <label>Category Color</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="color" 
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '40px' }}
                  />
                  <input 
                    type="text" 
                    className="authInput" 
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    placeholder="#ffffff"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                 <button 
                   type="button" 
                   className="btn-secondary" 
                   onClick={() => setIsCreatingCategory(false)}
                   style={{ padding: '8px 12px', flex: 1 }}
                 >
                   Cancel
                 </button>
                 <button 
                   type="button" 
                   className="btn-primary" 
                   onClick={handleCreateCategory}
                   disabled={isSubmittingCategory || !newCategoryName}
                   style={{ padding: '8px 12px', flex: 1 }}
                 >
                   {isSubmittingCategory ? 'Saving...' : 'Save Category'}
                 </button>
              </div>
            </div>
          )}

          <div className="formGroup">
            <label>Description (Optional)</label>
            <textarea 
              className="commentInput"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about your habit..."
              style={{ minHeight: '80px', marginBottom: 0 }}
            />
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
                Delete Habit
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
