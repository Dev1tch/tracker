'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Habits.css';
import { habitsApi, logsApi } from '@/lib/api';
import HabitList from './HabitList';
import HabitListMobile from './HabitListMobile';
import HabitLogModal from './HabitLogModal';
import HabitCreationModal from './HabitCreationModal';
import { categoriesApi } from '@/lib/api';
import CustomSelect from '../ui/CustomSelect';
import useIsMobile from '@/hooks/useIsMobile';
import ConfirmModal from '../ui/ConfirmModal';
import HabitEditModal from './HabitEditModal';
import CategoryEditModal from './CategoryEditModal';
import { useToast } from '../ui/ToastProvider';

export default function HabitTracker() {
  const isMobile = useIsMobile(768);
  const addToast = useToast();
  const [habits, setHabits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [logs, setLogs] = useState({}); // Indexed by habitId -> date -> log
  
  // Filtering and Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());
  
  // Modal State
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState(null);
  const [habitToEdit, setHabitToEdit] = useState(null);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  useEffect(() => {
    fetchData();
  }, [currentDisplayDate]);

  const getLocalYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDisplayDates = () => {
    if (isMobile) {
      // Return 7 days ending on currentDisplayDate
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(currentDisplayDate);
        d.setDate(d.getDate() - i);
        dates.push(d);
      }
      return dates;
    } else {
      const year = currentDisplayDate.getFullYear();
      const month = currentDisplayDate.getMonth();
      const numDays = new Date(year, month + 1, 0).getDate();
      const dates = [];
      for (let i = 1; i <= numDays; i++) {
        dates.push(new Date(year, month, i));
      }
      return dates;
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const displayDates = getDisplayDates();
      if (displayDates.length === 0) return;
      
      const startDateStr = getLocalYYYYMMDD(displayDates[0]);
      const endDateStr = getLocalYYYYMMDD(displayDates[displayDates.length - 1]);

      // Fetch habits, categories and logs in parallel
      const [timeframeData, fetchedCategories] = await Promise.all([
        logsApi.getTimeframeLogs({
          start_date: startDateStr,
          end_date: endDateStr
        }),
        categoriesApi.getCategories()
      ]);

      setHabits(timeframeData);
      setCategories(fetchedCategories);
      
      // Index logs by habit ID and date string (YYYY-MM-DD)
      const logsIndex = {};
      timeframeData.forEach(habit => {
        logsIndex[habit.id] = {};
        if (habit.logs) {
          habit.logs.forEach(log => {
            const dateStr = log.date.split('T')[0];
            logsIndex[habit.id][dateStr] = log;
          });
        }
      });
      
      setLogs(logsIndex);
    } catch (err) {
      setError('Failed to load habits. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };



  const handleToggleToday = async (habitId, isCurrentlyCompleted) => {
    const today = new Date();
    const todayStr = getLocalYYYYMMDD(today);
    const existingLog = logs[habitId]?.[todayStr];
    const newIsSuccessful = !isCurrentlyCompleted;

    // Optimistic UI update
    setLogs(prev => {
      const nextLogs = { ...prev };
      if (!nextLogs[habitId]) nextLogs[habitId] = {};
      nextLogs[habitId] = {
        ...nextLogs[habitId],
        [todayStr]: {
           ...existingLog, // if it exists
           id: existingLog?.id || 'temp',
           habit_id: habitId,
           date: todayStr,
           is_successful: newIsSuccessful,
           comment: existingLog?.comment || ''
        }
      };
      return nextLogs;
    });

    try {
      let updatedLog;
      if (existingLog) {
        updatedLog = await logsApi.updateLog(existingLog.id, { is_successful: newIsSuccessful });
      } else {
        updatedLog = await logsApi.createLog({
          habit_id: habitId,
          date: todayStr,
          is_successful: true,
          comment: ''
        });
      }
      
      // Update with exact data from server (especially the new ID if it was created)
      setLogs(prev => {
        const nextLogs = { ...prev };
        if (!nextLogs[habitId]) nextLogs[habitId] = {};
        nextLogs[habitId] = {
           ...nextLogs[habitId],
           [todayStr]: updatedLog
        };
        return nextLogs;
      });
      
    } catch (err) {
      console.error('Failed to toggle habit', err);
      // Revert optimistic update on failure
      setLogs(prev => {
         const nextLogs = { ...prev };
         if (existingLog) {
           nextLogs[habitId][todayStr] = existingLog;
         } else {
           delete nextLogs[habitId][todayStr];
         }
         return nextLogs;
      });
      addToast('Failed to update habit status.', 'error');
    }
  };

  const handlePrevPeriod = () => {
    setCurrentDisplayDate(prev => {
      const newDate = new Date(prev);
      if (isMobile) {
        newDate.setDate(prev.getDate() - 7);
      } else {
        newDate.setMonth(prev.getMonth() - 1);
      }
      return newDate;
    });
  };

  const handleNextPeriod = () => {
    setCurrentDisplayDate(prev => {
      const newDate = new Date(prev);
      if (isMobile) {
        newDate.setDate(prev.getDate() + 7);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleOpenDay = (habit, date) => {
    setSelectedHabit(habit);
    setSelectedDate(date);
    setIsLogModalOpen(true);
  };

  const handleSaveLog = async (logData) => {
    const dateStr = getLocalYYYYMMDD(selectedDate);
    const existingLog = logs[selectedHabit.id]?.[dateStr];

    try {
      let updatedLog;
      if (existingLog) {
        updatedLog = await logsApi.updateLog(existingLog.id, {
          is_successful: logData.is_successful,
          comment: logData.comment
        });
      } else {
        updatedLog = await logsApi.createLog({
          habit_id: selectedHabit.id,
          date: dateStr,
          is_successful: logData.is_successful,
          comment: logData.comment
        });
      }
      
      setLogs(prev => {
        const nextLogs = { ...prev };
        if (!nextLogs[selectedHabit.id]) nextLogs[selectedHabit.id] = {};
        nextLogs[selectedHabit.id] = {
           ...nextLogs[selectedHabit.id],
           [dateStr]: updatedLog
        };
        return nextLogs;
      });
      
      setIsLogModalOpen(false);
      addToast('Log saved!', 'success');
    } catch (err) {
      console.error('Failed to save log', err);
      addToast('Failed to save log.', 'error');
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      await habitsApi.updateHabit(habitId, { is_active: false });
      setHabits(prev => prev.filter(h => h.id !== habitId));
      setHabitToDelete(null);
      addToast('Habit deleted', 'success');
    } catch (err) {
      console.error('Failed to delete habit', err);
      addToast('Failed to delete habit.', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await categoriesApi.deleteCategory(categoryId);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      setHabits(prev => prev.map(h => h.category_id === categoryId ? { ...h, category_id: null } : h));
      setCategoryToDelete(null);
      addToast('Category deleted', 'success');
    } catch (err) {
      console.error('Failed to delete category', err);
      addToast('Failed to delete category.', 'error');
    }
  };

  if (isLoading && habits.length === 0) {
    return <div className="habitTrackerContainer" style={{ justifyContent: 'center', alignItems: 'center' }}><p style={{ color: 'var(--text-tertiary)' }}>Loading habits...</p></div>;
  }

  // Derived state: Filtering and Sorting
  const getFilteredAndSortedHabits = () => {
    let result = [...habits];

    // Search filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(h => h.name.toLowerCase().includes(q));
    }

    // Category filter
    if (filterCategory !== '') {
      result = result.filter(h => h.category_id === filterCategory);
    }

    // Priority Sort logic: High > Medium > Normal
    const priorityWeight = { 'High': 3, 'Medium': 2, 'Normal': 1 };

    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'priority_desc') {
        // Highest priority first
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'priority_asc') {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  };

  const displayDates = getDisplayDates();

  const getHeaderLabel = () => {
    if (displayDates.length === 0) return '';
    const firstDay = displayDates[0];
    const lastDay = displayDates[displayDates.length - 1];
    if (isMobile) {
      const startMonth = firstDay.toLocaleString('default', { month: 'short' });
      const endMonth = lastDay.toLocaleString('default', { month: 'short' });
      if (startMonth === endMonth) {
          return `${startMonth} ${firstDay.getDate()} - ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
      } else {
          const endYearStr = firstDay.getFullYear() !== lastDay.getFullYear() ? ` ${lastDay.getFullYear()}` : '';
          return `${startMonth} ${firstDay.getDate()} - ${endMonth} ${lastDay.getDate()}${endYearStr}, ${firstDay.getFullYear()}`;
      }
    }
    return firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const filteredAndSortedHabits = getFilteredAndSortedHabits();

  return (
    <div className="habitTrackerContainer">
      <div className={`habitStickyHeader ${isMobile ? 'mobileSticky' : ''}`}>
        <div className="habitHeader" style={{ marginBottom: isMobile ? '10px' : '20px', justifyContent: 'flex-end' }}>
          <button className="btn-primary customNewHabitBtn" onClick={() => setIsCreationModalOpen(true)}>New Habit</button>
        </div>

        <div className="habitToolbar" style={{ marginBottom: isMobile ? '10px' : '40px' }}>
          <input 
            type="text" 
            className="authInput searchInput" 
            placeholder="Search habits..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <div className="filterSelectWrapper" style={{ width: isMobile ? '100%' : '200px' }}>
            <CustomSelect
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map(c => ({ value: c.id, label: c.name, color: c.color }))
              ]}
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="Filter by Category"
            />
          </div>

          <div className="sortSelectWrapper" style={{ width: isMobile ? '100%' : '200px' }}>
            <CustomSelect
              options={[
                { value: 'name_asc', label: 'Sort A-Z' },
                { value: 'priority_desc', label: 'Priority: High to Low' },
                { value: 'priority_asc', label: 'Priority: Low to High' }
              ]}
              value={sortBy}
              onChange={setSortBy}
              placeholder="Sort Options"
            />
          </div>
        </div>

        {isMobile && (
          <div className="mobileHeaderStrip">
            <button className="mobileNavBtn" onClick={handlePrevPeriod} title="Previous">
              <ChevronLeft size={16} />
            </button>
            <span className="mobileNavTitle">{getHeaderLabel()}</span>
            <button className="mobileNavBtn" onClick={handleNextPeriod} title="Next">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      
      {error && <div className="authError" style={{ marginBottom: '20px' }}>{error}</div>}

      {habits.length === 0 && !error && !isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>You don't have any active habits. Create one to get started!</p>
      ) : isMobile ? (
        <HabitListMobile 
          habits={filteredAndSortedHabits} 
          categories={categories}
          logs={logs} 
          days={displayDates} 
          onToggleToday={handleToggleToday}
          onOpenDay={handleOpenDay}
          onDelete={setHabitToDelete}
          onEdit={setHabitToEdit}
          onEditCategory={setCategoryToEdit}
        />
      ) : (
        <HabitList 
          habits={filteredAndSortedHabits} 
          categories={categories}
          logs={logs} 
          days={getDisplayDates()} 
          onToggleToday={handleToggleToday}
          onOpenDay={handleOpenDay}
          onPrevPeriod={handlePrevPeriod}
          onNextPeriod={handleNextPeriod}
          onDelete={setHabitToDelete}
          onEdit={setHabitToEdit}
          onEditCategory={setCategoryToEdit}
        />
      )}

      {isLogModalOpen && (
        <HabitLogModal 
          habit={selectedHabit}
          date={selectedDate}
          existingLog={logs[selectedHabit?.id]?.[selectedDate ? getLocalYYYYMMDD(selectedDate) : '']}
          onClose={() => setIsLogModalOpen(false)}
          onSave={handleSaveLog}
        />
      )}

      <ConfirmModal
        isOpen={!!habitToDelete}
        title="Delete Habit"
        message={`Are you sure you want to delete the habit "${habitToDelete?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleDeleteHabit(habitToDelete.id)}
        onCancel={() => setHabitToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!categoryToDelete}
        title="Delete Category"
        message={`Are you sure you want to delete the category "${categoryToDelete?.name}"? Assigned habits will become uncategorized.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleDeleteCategory(categoryToDelete.id)}
        onCancel={() => setCategoryToDelete(null)}
      />

      {isCreationModalOpen && (
        <HabitCreationModal 
          categories={categories}
          onClose={() => setIsCreationModalOpen(false)}
          onSuccess={() => {
            setIsCreationModalOpen(false);
            fetchData();
            addToast('Habit created!', 'success');
          }}
        />
      )}

      <HabitEditModal
        habit={habitToEdit}
        categories={categories}
        onClose={() => setHabitToEdit(null)}
        onSuccess={(updatedHabit) => {
          if (updatedHabit) {
            setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
          } else {
            fetchData(); // Fallback if no data provided
          }
          setHabitToEdit(null);
          addToast('Habit details saved!', 'success');
        }}
        onDelete={() => {
          setHabitToDelete(habitToEdit);
          setHabitToEdit(null);
        }}
      />

      <CategoryEditModal
        category={categoryToEdit}
        onClose={() => setCategoryToEdit(null)}
        onSuccess={(updatedCategory) => {
          if (updatedCategory) {
            setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
          } else {
            fetchData(); // Fallback if no data provided
          }
          setCategoryToEdit(null);
          addToast('Category saved!', 'success');
        }}
        onDelete={() => {
          setCategoryToDelete(categoryToEdit);
          setCategoryToEdit(null);
        }}
      />
    </div>
  );
}
