import { apiClient } from './client.js';

export class CategoriesApi {
  /**
   * Get all habit categories for the current user
   */
  getCategories() {
    return apiClient.get('/habit-categories/');
  }

  /**
   * Create a new habit category
   * @param {Object} categoryData { name, color, icon }
   */
  createCategory(categoryData) {
    return apiClient.post('/habit-categories/', categoryData);
  }

  /**
   * Get a specific habit category by ID
   * @param {string} categoryId (UUID)
   */
  getCategory(categoryId) {
    return apiClient.get(`/habit-categories/${categoryId}`);
  }

  /**
   * Update an existing habit category
   * @param {string} categoryId (UUID)
   * @param {Object} categoryData { name, color, icon }
   */
  updateCategory(categoryId, categoryData) {
    return apiClient.put(`/habit-categories/${categoryId}`, categoryData);
  }

  /**
   * Delete a habit category
   * @param {string} categoryId (UUID)
   */
  deleteCategory(categoryId) {
    return apiClient.delete(`/habit-categories/${categoryId}`);
  }
}

export const categoriesApi = new CategoriesApi();
