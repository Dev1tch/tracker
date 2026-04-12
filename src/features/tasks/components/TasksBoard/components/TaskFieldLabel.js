import React from 'react';

export default function TaskFieldLabel({ icon: Icon, children }) {
  return (
    <span className="tasksFieldLabel">
      {Icon ? (
        <span className="tasksFieldLabelIcon" aria-hidden="true">
          <Icon size={12} />
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}
