import React from 'react';
import { Check, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import './HabitListMobile.css';

export default function HabitListMobile({ habits, categories, logs, days, onToggleToday, onOpenDay, onDelete, onEdit, onEditCategory }) {
  if (!days || days.length === 0) return null;

  const getLocalYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);
  const todayStr = getLocalYYYYMMDD(todayDate);

  // We want to sort the `days` array so the most recent day (usually today) is at the top of the list in each card.
  // Wait, the user might expect chronological order. Let's do chronological: older days at top, newest at bottom.
  // We'll leave the array order as provided by HabitTracker.

  return (
    <div className="habitListMobileContainer">
      
      <div className="habitListMobileCards">
        {habits.map((habit) => {
          const todayLog = logs[habit.id]?.[todayStr];
          const isTodayCompleted = todayLog?.is_successful === true;

          const category = categories?.find(c => c.id === habit.category_id);
          const categoryName = category ? category.name : 'General';
          const categoryColor = category ? category.color : 'var(--text-tertiary)';

          return (
            <div key={habit.id} className="habitCard" style={{ borderLeftColor: categoryColor }}>
              
              <div className="habitCardHeader">
                <div className="habitCardInfo">
                  <h3 
                    className="habitCardName clickableText"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(habit);
                    }}
                    title="Edit Habit"
                  >
                    {habit.name}
                  </h3>
                  <div className="habitCardMeta">
                     <span 
                       className={`habitCardCategory ${category ? 'clickableText' : ''}`}
                       style={{ color: categoryColor }}
                       onClick={(e) => {
                         e.stopPropagation();
                         if (category) onEditCategory(category);
                       }}
                       title={category ? "Edit Category" : ""}
                     >
                       {categoryName}
                     </span>
                     <span className={`priorityBadge ${habit.priority.toLowerCase()}`}>{habit.priority}</span>
                  </div>
                </div>
                <button 
                  className="mobileNavBtn" 
                  onClick={() => onDelete(habit)}
                  title="Delete Habit"
                  style={{ padding: '8px', color: 'var(--text-tertiary)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="habitCardDaysStrip">
                {days.map((date) => {
                   const dateStr = getLocalYYYYMMDD(date);
                   const log = logs[habit.id]?.[dateStr];
                   const status = log ? (log.is_successful ? 'completed' : 'failed') : 'empty';
                   
                   const isToday = dateStr === todayStr;
                   // Use very short day names (e.g. M, T, W) to fit 7 across easily
                   const dayOfWeekShort = date.toLocaleString('default', { weekday: 'narrow' });
                   const dayOfMonth = date.getDate();
                   
                   // Strip time to properly compare future dates
                   const dateCopy = new Date(date);
                   dateCopy.setHours(0,0,0,0);
                   const isFuture = dateCopy > todayDate;
                   
                   let colClass = `mobileDayCol ${status}`;
                   if (isToday) colClass += ' todayCol';
                   if (isFuture) colClass += ' futureCol';

                   // Can only open historical (past) days that are not today and not in future
                   // Actually, if we removed the TODAY toggle, they need to be able to toggle today by clicking the column!
                   const canOpen = !isFuture;

                   const handleClick = () => {
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
                       className={colClass}
                       onClick={handleClick}
                     >
                       <div className="mobileDayColInfo">
                         <span className="mobileDayColName">{dayOfWeekShort}</span>
                         <span className="mobileDayColDate">{dayOfMonth}</span>
                       </div>
                       
                       <div className="mobileDayColStatus">
                         {status === 'completed' && <div className="statusIndicator success"><Check size={12} color="#000" strokeWidth={3} /></div>}
                         {status === 'failed' && <div className="statusIndicator fail"><X size={12} color="#ff4d4d" strokeWidth={3} /></div>}
                         {status === 'empty' && !isFuture && <div className="statusIndicator empty"></div>}
                         {isFuture && <div className="statusIndicator future"></div>}
                       </div>
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
