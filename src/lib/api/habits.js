import { apiClient } from './client.js';

export class HabitsApi {
  /**
   * Get all habits for the current user
   * @param {Object} filters { category_id, is_active }
   */
  getHabits(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category_id) params.append('category_id', filters.category_id);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/habits/${query}`);
  }

  /**
   * Create a new habit
   * @param {Object} habitData { name, description, category_id, priority, is_active }
   */
  createHabit(habitData) {
    return apiClient.post('/habits/', habitData);
  }

  /**
   * Get a specific habit by ID
   * @param {string} habitId (UUID)
   */
  getHabit(habitId) {
    return apiClient.get(`/habits/${habitId}`);
  }

  /**
   * Update an existing habit
   * @param {string} habitId (UUID)
   * @param {Object} habitData { name, description, category_id, priority, is_active }
   */
  updateHabit(habitId, habitData) {
    return apiClient.patch(`/habits/${habitId}`, habitData);
  }

  /**
   * Delete a habit
   * @param {string} habitId (UUID)
   */
  deleteHabit(habitId) {
    return apiClient.delete(`/habits/${habitId}`);
  }
}

export const habitsApi = new HabitsApi();
