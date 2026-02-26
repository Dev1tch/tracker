import { apiClient } from './client.js';

/**
 * Task statuses from the backend API.
 * @typedef {'TO_DO'|'IN_PROGRESS'|'PAUSED'|'COMPLETED'|'CANCELLED'|'IN_REVIEW'|'ARCHIVED'} TaskStatus
 */
/**
 * Task priorities from the backend API.
 * @typedef {'URGENT'|'HIGH'|'NORMAL'|'LOW'} TaskPriority
 */

/**
 * Interface: create task request payload.
 * @typedef {Object} TaskCreatePayloadData
 * @property {string} title
 * @property {string} [description]
 * @property {string} [task_type_id]
 * @property {string} [parent_task_id]
 * @property {TaskStatus} [status]
 * @property {TaskPriority} [priority]
 * @property {string} [start_date]
 * @property {string} [due_date]
 */

/**
 * Interface: update task request payload.
 * @typedef {TaskCreatePayloadData & {
 * completed_at?: string,
 * pause_start_date?: string,
 * total_pause_time_minutes?: number,
 * total_spent_time_minutes?: number,
 * is_parent?: boolean
 * }} TaskUpdatePayloadData
 */

/**
 * Interface: task API response.
 * @typedef {Object} TaskResponseData
 * @property {string} id
 * @property {string} user_id
 * @property {string} title
 * @property {string|null} description
 * @property {string|null} task_type_id
 * @property {string|null} parent_task_id
 * @property {TaskStatus} status
 * @property {TaskPriority} priority
 * @property {string|null} start_date
 * @property {string|null} due_date
 * @property {string|null} completed_at
 * @property {string|null} pause_start_date
 * @property {number} total_pause_time_minutes
 * @property {number} total_spent_time_minutes
 * @property {boolean} is_parent
 * @property {boolean} is_deleted
 * @property {string|null} created_at
 * @property {string|null} updated_at
 */

/**
 * Interface: task category API response.
 * @typedef {Object} TaskTypeResponseData
 * @property {string} id
 * @property {string} user_id
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} color
 * @property {boolean} is_active
 * @property {string|null} created_at
 * @property {string|null} updated_at
 */

/**
 * Interface: bulk delete response.
 * @typedef {Object} BulkDeleteTasksResponseData
 * @property {'success'} status
 * @property {number} deleted_count
 */

/**
 * Interface: bulk status update response.
 * @typedef {Object} BulkUpdateTasksStatusResponseData
 * @property {'success'} status
 * @property {number} updated_count
 */

/**
 * Interface: simple success response.
 * @typedef {Object} SuccessResponseData
 * @property {'success'} status
 */

export const TASK_STATUS = Object.freeze({
  TO_DO: 'TO_DO',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  IN_REVIEW: 'IN_REVIEW',
  ARCHIVED: 'ARCHIVED',
});

export const TASK_PRIORITY = Object.freeze({
  URGENT: 'URGENT',
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
});

export class TaskCreatePayload {
  /**
   * @param {TaskCreatePayloadData} data
   */
  constructor(data = {}) {
    this.title = data.title ?? '';
    this.description = data.description;
    this.task_type_id = data.task_type_id;
    this.parent_task_id = data.parent_task_id;
    this.status = data.status ?? TASK_STATUS.TO_DO;
    this.priority = data.priority ?? TASK_PRIORITY.NORMAL;
    this.start_date = data.start_date;
    this.due_date = data.due_date;
  }

  toJSON() {
    return {
      title: this.title,
      description: this.description,
      task_type_id: this.task_type_id,
      parent_task_id: this.parent_task_id,
      status: this.status,
      priority: this.priority,
      start_date: this.start_date,
      due_date: this.due_date,
    };
  }
}

export class TaskUpdatePayload extends TaskCreatePayload {
  /**
   * @param {TaskUpdatePayloadData} data
   */
  constructor(data = {}) {
    super(data);
    this.completed_at = data.completed_at;
    this.pause_start_date = data.pause_start_date;
    this.total_pause_time_minutes = data.total_pause_time_minutes;
    this.total_spent_time_minutes = data.total_spent_time_minutes;
    this.is_parent = data.is_parent;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      completed_at: this.completed_at,
      pause_start_date: this.pause_start_date,
      total_pause_time_minutes: this.total_pause_time_minutes,
      total_spent_time_minutes: this.total_spent_time_minutes,
      is_parent: this.is_parent,
    };
  }
}

export class TaskTypePayload {
  constructor(data = {}) {
    this.name = data.name ?? '';
    this.description = data.description;
    this.color = data.color;
    this.is_active = data.is_active;
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      color: this.color,
      is_active: this.is_active,
    };
  }
}

export class BulkTaskIdsPayload {
  constructor(data = {}) {
    this.task_ids = Array.isArray(data.task_ids) ? data.task_ids : [];
  }

  toJSON() {
    return { task_ids: this.task_ids };
  }
}

export class BulkTaskStatusUpdatePayload extends BulkTaskIdsPayload {
  constructor(data = {}) {
    super(data);
    this.status = data.status ?? TASK_STATUS.TO_DO;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      status: this.status,
    };
  }
}

export class TaskModel {
  /**
   * @param {TaskResponseData} data
   */
  constructor(data = {}) {
    this.id = data.id ?? '';
    this.user_id = data.user_id ?? '';
    this.title = data.title ?? '';
    this.description = data.description ?? null;
    this.task_type_id = data.task_type_id ?? null;
    this.parent_task_id = data.parent_task_id ?? null;
    this.status = data.status ?? TASK_STATUS.TO_DO;
    this.priority = data.priority ?? TASK_PRIORITY.NORMAL;
    this.start_date = data.start_date ?? null;
    this.due_date = data.due_date ?? null;
    this.completed_at = data.completed_at ?? null;
    this.pause_start_date = data.pause_start_date ?? null;
    this.total_pause_time_minutes = data.total_pause_time_minutes ?? 0;
    this.total_spent_time_minutes = data.total_spent_time_minutes ?? 0;
    this.is_parent = data.is_parent ?? false;
    this.is_deleted = data.is_deleted ?? false;
    this.created_at = data.created_at ?? null;
    this.updated_at = data.updated_at ?? null;
  }

  static fromApi(data) {
    return new TaskModel(data);
  }
}

export class TaskTypeModel {
  /**
   * @param {TaskTypeResponseData} data
   */
  constructor(data = {}) {
    this.id = data.id ?? '';
    this.user_id = data.user_id ?? '';
    this.name = data.name ?? '';
    this.description = data.description ?? null;
    this.color = data.color ?? null;
    this.is_active = data.is_active ?? true;
    this.created_at = data.created_at ?? null;
    this.updated_at = data.updated_at ?? null;
  }

  static fromApi(data) {
    return new TaskTypeModel(data);
  }
}

export class BulkDeleteTasksResponse {
  /**
   * @param {BulkDeleteTasksResponseData} data
   */
  constructor(data = {}) {
    this.status = data.status ?? 'success';
    this.deleted_count = data.deleted_count ?? 0;
  }
}

export class BulkUpdateTasksStatusResponse {
  /**
   * @param {BulkUpdateTasksStatusResponseData} data
   */
  constructor(data = {}) {
    this.status = data.status ?? 'success';
    this.updated_count = data.updated_count ?? 0;
  }
}

export class SuccessResponse {
  /**
   * @param {SuccessResponseData} data
   */
  constructor(data = {}) {
    this.status = data.status ?? 'success';
  }
}

function toTaskCreatePayload(data) {
  if (data instanceof TaskCreatePayload) return data;
  return new TaskCreatePayload(data);
}

function toTaskUpdatePayload(data) {
  if (data instanceof TaskUpdatePayload) return data;
  return new TaskUpdatePayload(data);
}

function toTaskTypePayload(data) {
  if (data instanceof TaskTypePayload) return data;
  return new TaskTypePayload(data);
}

function toBulkTaskIdsPayload(data) {
  if (data instanceof BulkTaskIdsPayload) return data;
  return new BulkTaskIdsPayload(data);
}

function toBulkTaskStatusUpdatePayload(data) {
  if (data instanceof BulkTaskStatusUpdatePayload) return data;
  return new BulkTaskStatusUpdatePayload(data);
}

export class TasksApi {
  /**
  * All methods below are protected and require a valid auth token.
   * The ApiClient automatically attaches:
   * Authorization: Bearer <token>
   */

   /**
   * Get all tasks for the current user.
   */
  async getTasks() {
    const data = await apiClient.get('/tasks/');
    if (!Array.isArray(data)) return [];
    return data.map((item) => TaskModel.fromApi(item));
  }

  /**
   * Create a task.
   * @param {TaskCreatePayloadData|TaskCreatePayload} taskData
   */
  async createTask(taskData) {
    const payload = toTaskCreatePayload(taskData);
    const data = await apiClient.post('/tasks/', payload.toJSON());
    return TaskModel.fromApi(data);
  }

  /**
   * Bulk delete tasks.
   * @param {{ task_ids: string[] }|BulkTaskIdsPayload} data
   */
  async deleteTasksBulk(data) {
    const payload = toBulkTaskIdsPayload(data);
    const result = await apiClient.delete('/tasks/bulk', { body: payload.toJSON() });
    return new BulkDeleteTasksResponse(result);
  }

  /**
   * Bulk update task status.
   * @param {{ task_ids: string[], status: TaskStatus }|BulkTaskStatusUpdatePayload} data
   */
  async updateTasksBulkStatus(data) {
    const payload = toBulkTaskStatusUpdatePayload(data);
    const result = await apiClient.patch('/tasks/bulk/status', payload.toJSON());
    return new BulkUpdateTasksStatusResponse(result);
  }

  /**
   * Get task types.
   */
  async getTaskTypes() {
    const data = await apiClient.get('/tasks/types');
    if (!Array.isArray(data)) return [];
    return data.map((item) => TaskTypeModel.fromApi(item));
  }

  /**
   * Create a task type.
   * @param {{ name: string, description?: string, color?: string, is_active?: boolean }|TaskTypePayload} taskTypeData
   */
  async createTaskType(taskTypeData) {
    const payload = toTaskTypePayload(taskTypeData);
    const data = await apiClient.post('/tasks/types', payload.toJSON());
    return TaskTypeModel.fromApi(data);
  }

  /**
   * Delete a task type.
   * @param {string} taskTypeId (UUID)
   */
  async deleteTaskType(taskTypeId) {
    const data = await apiClient.delete(`/tasks/types/${taskTypeId}`);
    return new SuccessResponse(data);
  }

  /**
   * Get a task by ID.
   * @param {string} taskId (UUID)
   */
  async getTask(taskId) {
    const data = await apiClient.get(`/tasks/${taskId}`);
    return TaskModel.fromApi(data);
  }

  /**
   * Update a task by ID.
   * @param {string} taskId (UUID)
   * @param {TaskUpdatePayloadData|TaskUpdatePayload} taskData
   */
  async updateTask(taskId, taskData) {
    const payload = toTaskUpdatePayload(taskData);
    const data = await apiClient.put(`/tasks/${taskId}`, payload.toJSON());
    return TaskModel.fromApi(data);
  }
}

export const tasksApi = new TasksApi();
