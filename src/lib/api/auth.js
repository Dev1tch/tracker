import { apiClient } from './client.js';

export class AuthApi {
  /**
   * Register a new user
   * @param {Object} userData { email, password, first_name, last_name }
   */
  signup(userData) {
    return apiClient.post('/auth/signup', userData);
  }

  /**
   * Login with email and password
   * @param {string} username (email)
   * @param {string} password
   */
  async login(username, password) {
    const response = await apiClient.postForm('/auth/login', {
      username,
      password,
    });
    
    if (response.access_token) {
      apiClient.setToken(response.access_token);
    }
    
    return response;
  }

  logout() {
    apiClient.setToken(null);
  }

  getCurrentToken() {
    return apiClient.token;
  }
}

export const authApi = new AuthApi();
