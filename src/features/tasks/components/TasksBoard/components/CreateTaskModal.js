import React from 'react';
import {
  AlignLeft,
  CalendarClock,
  CircleDot,
  ClipboardList,
  Flag,
  FolderKanban,
  GitBranch,
  Loader2,
  Plus,
  Shapes,
  Tag,
  UserRound,
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

function getMemberDisplayName(member) {
  const fullName = [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim();
  return fullName || member?.email || 'Member';
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
  isSubmitting,
  taskTypes,
  projects,
  membersByProject,
  currentUserId,
  statusColors,
  parentTasks,
  onOpenTypeManager,
  showProjectField = true,
  showAssigneeField = false,
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
  const projectOptions = [
    ...(showAssigneeField ? [] : [{ value: '', label: 'Personal' }]),
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  const projectMembers = form.project_id ? membersByProject?.[form.project_id] || [] : [];
  const assigneeOptions = projectMembers.map((member) => ({
    value: member.user_id,
    label: getMemberDisplayName(member),
  }));
  const getDefaultAssignee = (projectId) => {
    const members = projectId ? membersByProject?.[projectId] || [] : [];
    return (
      members.find((member) => member.user_id === currentUserId)?.user_id ||
      members[0]?.user_id ||
      ''
    );
  };
  const parentTaskOptions = [
    { value: '', label: 'None' },
    ...parentTasks
      .filter((task) => (task.project_id || '') === (form.project_id || ''))
      .map((task) => ({ value: task.id, label: task.title })),
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

            {showProjectField ? (
              <div className="tasksField">
                <label>
                  <TaskFieldLabel icon={FolderKanban}>Project</TaskFieldLabel>
                </label>
                <CustomSelect
                  options={projectOptions}
                  value={form.project_id}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      project_id: value,
                      assignee_user_id: getDefaultAssignee(value),
                      parent_task_id: '',
                    }))
                  }
                  placeholder="Select project"
                />
              </div>
            ) : null}

            {showAssigneeField ? (
              <div className="tasksField">
                <label>
                  <TaskFieldLabel icon={UserRound}>Assignee *</TaskFieldLabel>
                </label>
                <CustomSelect
                  options={assigneeOptions}
                  value={form.assignee_user_id}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, assignee_user_id: value }))
                  }
                  placeholder="Select assignee"
                />
              </div>
            ) : null}

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
                <TaskFieldLabel icon={CalendarClock}>Deadline</TaskFieldLabel>
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
