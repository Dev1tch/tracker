import React from 'react';
import {
  AlignLeft,
  Calendar,
  CalendarClock,
  CircleDot,
  ClipboardList,
  Flag,
  GitBranch,
  Loader2,
  Plus,
  Shapes,
  Tag,
  X,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import {
  PRIORITY_ORDER,
  STATUS_ORDER,
} from '@/features/tasks/constants/task-board.constants';
import { formatPriority, formatStatus } from '@/features/tasks/utils/task-formatters';
import TasksDatePicker from './TasksDatePicker';
import TaskFieldLabel from './TaskFieldLabel';

const PRIORITY_OPTION_COLORS = {
  URGENT: '#f87171',
  HIGH: '#fbbf24',
  NORMAL: '#60a5fa',
  LOW: '#9ca3af',
};

export default function CreateTaskModal({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
  isSubmitting,
  taskTypes,
  statusColors,
  parentTasks,
  onOpenTypeManager,
}) {
  if (!isOpen) return null;

  const statusOptions = STATUS_ORDER.map((status) => ({
    value: status,
    label: formatStatus(status),
    color: statusColors?.[status],
  }));
  const priorityOptions = PRIORITY_ORDER.map((priority) => ({
    value: priority,
    label: formatPriority(priority),
    color: PRIORITY_OPTION_COLORS[priority],
  }));
  const taskTypeOptions = [
    { value: '', label: 'None' },
    ...taskTypes.map((type) => ({ value: type.id, label: type.name, color: type.color || undefined })),
  ];
  const parentTaskOptions = [
    { value: '', label: 'None' },
    ...parentTasks.map((task) => ({ value: task.id, label: task.title })),
  ];

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      <div className="tasksModal tasksCreateModal" onClick={(e) => e.stopPropagation()}>
        <div className="tasksModalHeader">
          <h3>Create Task</h3>
          <button type="button" className="tasksIconBtn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tasksModalBody">
          <form
            className="tasksFormGrid tasksModalForm"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="tasksField tasksFieldFull">
              <label>
                <TaskFieldLabel icon={ClipboardList}>Title *</TaskFieldLabel>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
                required
                autoFocus
              />
            </div>

            <div className="tasksField tasksFieldFull">
              <label>
                <TaskFieldLabel icon={AlignLeft}>Description</TaskFieldLabel>
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Task description"
                rows={4}
              />
            </div>

            <div className="tasksField">
              <label>
                <TaskFieldLabel icon={CircleDot}>Status</TaskFieldLabel>
              </label>
              <CustomSelect
                options={statusOptions}
                value={form.status}
                onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                placeholder="Select status"
              />
            </div>

            <div className="tasksField">
              <label>
                <TaskFieldLabel icon={Flag}>Priority</TaskFieldLabel>
              </label>
              <CustomSelect
                options={priorityOptions}
                value={form.priority}
                onChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                placeholder="Select priority"
              />
            </div>

            <div className="tasksField">
              <label>
                <TaskFieldLabel icon={Shapes}>Task Category</TaskFieldLabel>
              </label>
              <div className="tasksInlineField">
                <CustomSelect
                  options={taskTypeOptions}
                  value={form.task_type_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, task_type_id: value }))}
                  placeholder="Select task category"
                />
                <button
                  type="button"
                  className="tasksIconBtn"
                  onClick={onOpenTypeManager}
                  title="Manage task categories"
                >
                  <Tag size={14} />
                </button>
              </div>
            </div>

            <div className="tasksField">
              <label>
                <TaskFieldLabel icon={GitBranch}>Parent Task</TaskFieldLabel>
              </label>
              <CustomSelect
                options={parentTaskOptions}
                value={form.parent_task_id}
                onChange={(value) => setForm((prev) => ({ ...prev, parent_task_id: value }))}
                placeholder="Select parent task"
              />
            </div>

            <div className="tasksField">
              <label>
                <TaskFieldLabel icon={Calendar}>Start Date</TaskFieldLabel>
              </label>
              <div className="tasksReadonlyField tasksReadonlyFieldPlaceholder">
                <span>Auto when you start the task</span>
                <Calendar size={14} />
              </div>
            </div>

            <div className="tasksField">
              <label>
                <TaskFieldLabel icon={CalendarClock}>Due Date</TaskFieldLabel>
              </label>
              <TasksDatePicker
                value={form.due_date}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, due_date: value }))
                }
                placeholder="Select due date"
                showTime
                className="tasksDateFieldInput"
              />
            </div>

            <div className="tasksModalActions tasksFieldFull">
              <button type="button" className="tasksBtn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="tasksBtn tasksBtnPrimary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                Create Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
