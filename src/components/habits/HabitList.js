import React from 'react';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HabitList({ habits, categories, logs, days, onToggleToday, onOpenDay, onPrevMonth, onNextMonth }) {
  if (days.length === 0) return null;
  
  const monthName = days[0].toLocaleString('default', { month: 'long', year: 'numeric' });
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
          <button className="monthNavBtn" onClick={onPrevMonth} title="Previous Month">
            <ChevronLeft size={16} />
          </button>
          <span>{monthName}</span>
          <button className="monthNavBtn" onClick={onNextMonth} title="Next Month">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="timetableDaysHeader">
          {days.map((date) => {
            const isMonday = date.getDay() === 1;
            const isToday = getLocalYYYYMMDD(date) === todayStr;
            return (
              <div 
                key={date.toISOString()} 
                className={`timetableDayLabel ${isMonday ? 'weekStart' : ''} ${isToday ? 'todayLabel' : ''}`}
              >
                {date.getDate()}
              </div>
            );
          })}
        </div>
        <div className="timetableActionHeader">Today</div>
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
                   const canOpen = !isToday && !isFuture;

                   return (
                     <div 
                       key={dateStr}
                       className={cubeClass}
                       title={`${date.toDateString()} - ${status}`}
                       onClick={() => {
                          if (canOpen) onOpenDay(habit, date);
                       }}
                     >
                       {status === 'completed' && <Check size={12} color="#FFF" strokeWidth={3} />}
                       {status === 'failed' && <X size={12} color="#ff4d4d" strokeWidth={3} />}
                     </div>
                   );
                })}
              </div>

              <div className="timetableActionCell">
                <button 
                  className={`checkboxBtn ${isTodayCompleted ? 'completed' : ''}`}
                  onClick={() => onToggleToday(habit.id, isTodayCompleted)}
                  title="Mark today as completed"
                  style={{ width: '28px', height: '28px' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
