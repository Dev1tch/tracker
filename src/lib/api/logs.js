import { apiClient } from './client.js';

export class LogsApi {
  /**
   * Get habit logs
   * @param {Object} filters { habit_id, day }
   */
  getLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.habit_id) params.append('habit_id', filters.habit_id);
    if (filters.day) params.append('day', filters.day);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/habit-logs/${query}`);
  }

  /**
   * Create a new habit log
   * @param {Object} logData { habit_id, date, is_successful, comment }
   */
  createLog(logData) {
    return apiClient.post('/habit-logs/', logData);
  }

  /**
   * Update an existing habit log
   * @param {string} logId (UUID)
   * @param {Object} logData { is_successful, comment }
   */
  updateLog(logId, logData) {
    return apiClient.patch(`/habit-logs/${logId}`, logData);
  }

  /**
   * Delete a habit log
   * @param {string} logId (UUID)
   */
  deleteLog(logId) {
    return apiClient.delete(`/habit-logs/${logId}`);
  }
}

export const logsApi = new LogsApi();
