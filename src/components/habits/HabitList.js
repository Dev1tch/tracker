import React from 'react';
import { Check, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

export default function HabitList({ habits, categories, logs, days, onToggleToday, onOpenDay, onPrevPeriod, onNextPeriod, onDelete }) {
  if (days.length === 0) return null;
  
  const getHeaderLabel = () => {
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    if (days.length <= 7) {
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

  const headerLabel = getHeaderLabel();
  const getLocalYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);
  const todayStr = getLocalYYYYMMDD(todayDate);

  return (
    <div className="habitTimetable">
      <div className="timetableHeaderRow">
        <div className="timetableMonthHeader">
          <button className="monthNavBtn" onClick={onPrevPeriod} title="Previous">
            <ChevronLeft size={16} />
          </button>
          <span>{headerLabel}</span>
          <button className="monthNavBtn" onClick={onNextPeriod} title="Next">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="timetableDaysHeader">
          {days.map((date) => {
            const isMonday = date.getDay() === 1;
            const isToday = getLocalYYYYMMDD(date) === todayStr;
            const dayShort = date.toLocaleString('default', { weekday: 'short' });
            return (
              <div 
                key={date.toISOString()} 
                className={`timetableDayLabel ${isMonday ? 'weekStart' : ''} ${isToday ? 'todayLabel' : ''}`}
              >
                <span className="dayNameShort">{dayShort}</span>
                <span className="dayNum">{date.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="timetableBody">
        {habits.map((habit) => {
          const todayLog = logs[habit.id]?.[todayStr];
          const isTodayCompleted = todayLog?.is_successful === true;

          const category = categories?.find(c => c.id === habit.category_id);
          const categoryName = category ? category.name : 'General';
          const categoryColor = category ? category.color : 'var(--text-tertiary)';

          return (
            <div key={habit.id} className="timetableRow">
              <div className="timetableHabitInfo" style={{ borderLeft: `4px solid ${categoryColor}` }}>
                <span className="habitName" style={{ fontSize: '14px' }}>{habit.name}</span>
                <span className="habitCategory" style={{ color: categoryColor, fontSize: '9px' }}>{categoryName}</span>
                <span className={`priorityBadge ${habit.priority.toLowerCase()}`}>{habit.priority}</span>
                <button 
                  className="deleteHabitBtn" 
                  onClick={() => onDelete(habit)}
                  title="Delete Habit"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="timetableGrid">
                {days.map((date) => {
                   const dateStr = getLocalYYYYMMDD(date);
                   const log = logs[habit.id]?.[dateStr];
                   const status = log ? (log.is_successful ? 'completed' : 'failed') : 'empty';
                   
                   const isToday = dateStr === todayStr;
                   const isMonday = date.getDay() === 1;
                   
                   // Check if the date is in the future
                   const isFuture = date > todayDate;
                   
                   let cubeClass = `dayCube ${status}`;
                   if (isToday) cubeClass += ' today';
                   if (isMonday) cubeClass += ' weekStart';
                   if (isFuture) cubeClass += ' future';

                   // Can only open historical (past) days that are not today and not in future
                   const canOpen = !isFuture;

                   const handleCubeClick = () => {
                       if (!canOpen) return;
                       if (isToday) {
                           onToggleToday(habit.id, status === 'completed');
                       } else {
                           onOpenDay(habit, date);
                       }
                   };

                   return (
                     <div 
                       key={dateStr}
                       className={cubeClass}
                       title={`${date.toDateString()} - ${status}`}
                       onClick={handleCubeClick}
                     >
                       {status === 'completed' && <Check size={14} color="#FFF" strokeWidth={3} />}
                       {status === 'failed' && <X size={14} color="#ff4d4d" strokeWidth={3} />}
                     </div>
                   );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
