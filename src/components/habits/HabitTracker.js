'use client';

import React, { useState, useEffect } from 'react';
import './Habits.css';
import { habitsApi, logsApi } from '@/lib/api';
import HabitList from './HabitList';
import HabitLogModal from './HabitLogModal';
import HabitCreationModal from './HabitCreationModal';
import { categoriesApi } from '@/lib/api';
import CustomSelect from '../ui/CustomSelect';

export default function HabitTracker() {
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

  useEffect(() => {
    fetchData();
  }, [currentDisplayDate]);

  const getLocalYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Calculate start and end of the currently displayed month
      const year = currentDisplayDate.getFullYear();
      const month = currentDisplayDate.getMonth();
      
      const startOfMonth = new Date(year, month, 1);
      // Last day of the month: day 0 of the next month
      const endOfMonth = new Date(year, month + 1, 0); 
      
      const startDateStr = getLocalYYYYMMDD(startOfMonth);
      const endDateStr = getLocalYYYYMMDD(endOfMonth);

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

  const getCurrentMonthDates = () => {
      const year = currentDisplayDate.getFullYear();
      const month = currentDisplayDate.getMonth();
      
      const numDays = new Date(year, month + 1, 0).getDate();
      
      const dates = [];
      for (let i = 1; i <= numDays; i++) {
        dates.push(new Date(year, month, i));
      }
      return dates;
  };

  const handleToggleToday = async (habitId, isCurrentlyCompleted) => {
    const today = new Date();
    const todayStr = getLocalYYYYMMDD(today);
    const log = logs[habitId]?.[todayStr];

    try {
      if (log) {
        // Update existing log
        const newIsSuccessful = !isCurrentlyCompleted;
        await logsApi.updateLog(log.id, { is_successful: newIsSuccessful });
      } else {
        // Create new log
        await logsApi.createLog({
          habit_id: habitId,
          date: todayStr,
          is_successful: true,
          comment: ''
        });
      }
      // Refresh data to ensure UI is in sync
      fetchData();
    } catch (err) {
      console.error('Failed to toggle habit', err);
      alert('Failed to update habit status.');
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDisplayDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDisplayDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
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
      if (existingLog) {
        await logsApi.updateLog(existingLog.id, {
          is_successful: logData.is_successful,
          comment: logData.comment
        });
      } else {
        await logsApi.createLog({
          habit_id: selectedHabit.id,
          date: dateStr,
          is_successful: logData.is_successful,
          comment: logData.comment
        });
      }
      setIsLogModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save log', err);
      alert('Failed to save log.');
    }
  };

  if (isLoading && habits.length === 0) {
    return <div className="habitTrackerContainer"><p style={{ color: 'var(--text-tertiary)' }}>Loading habits...</p></div>;
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

  const filteredAndSortedHabits = getFilteredAndSortedHabits();

  return (
    <div className="habitTrackerContainer">
      <div className="habitHeader" style={{ marginBottom: '20px' }}>
        <h1 className="pageTitle">Habits</h1>
        <button className="btn-primary" onClick={() => setIsCreationModalOpen(true)}>New Habit</button>
      </div>

      <div className="habitToolbar">
        <input 
          type="text" 
          className="authInput searchInput" 
          placeholder="Search habits..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <div style={{ width: '200px' }}>
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

        <div style={{ width: '200px' }}>
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
      
      {error && <div className="authError" style={{ marginBottom: '20px' }}>{error}</div>}

      {habits.length === 0 && !error && !isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>You don't have any active habits. Create one to get started!</p>
      ) : (
        <HabitList 
          habits={filteredAndSortedHabits} 

          categories={categories}
          logs={logs} 
          days={getCurrentMonthDates()} 
          onToggleToday={handleToggleToday}
          onOpenDay={handleOpenDay}
          onPrevMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
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

      {isCreationModalOpen && (
        <HabitCreationModal 
          categories={categories}
          onClose={() => setIsCreationModalOpen(false)}
          onSuccess={() => {
            setIsCreationModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
