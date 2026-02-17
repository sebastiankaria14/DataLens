import api from './api';
import type { User, SignupData, LoginData, ForgotPasswordData, AuthResponse } from '../types/auth';

export type { User, SignupData, LoginData, ForgotPasswordData, AuthResponse };

/**
 * Authentication service
 * Handles all auth-related API calls
 */
class AuthService {
  /**
   * Register a new user
   */
  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await api.post('/api/auth/signup', data);
    // Get user data from response
    const user = response.data;
    
    // Login after signup to get token
    const loginResponse = await api.post('/api/auth/login/json', {
      email: data.email,
      password: data.password
    });
    
    const authData = {
      access_token: loginResponse.data.access_token,
      token_type: loginResponse.data.token_type,
      user: user
    };
    
    this.setAuthData(authData);
    return authData;
  }

  /**
   * Login existing user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post('/api/auth/login/json', data);
    
    // Get user info
    const token = response.data.access_token;
    localStorage.setItem('token', token);
    
    const userResponse = await api.get('/api/auth/me');
    
    const authData = {
      access_token: token,
      token_type: response.data.token_type,
      user: userResponse.data
    };
    
    this.setAuthData(authData);
    return authData;
  }

  /**
   * Request password reset
   */
  async forgotPassword(data: ForgotPasswordData): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/api/auth/forgot-password', data);
    return response.data;
  }

  /**
   * Logout user - clear local storage
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:changed'));
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: { full_name?: string; email?: string }): Promise<User> {
    const response = await api.put('/api/auth/me', data);
    const updatedUser = response.data;
    
    // Update stored user data
    localStorage.setItem('user', JSON.stringify(updatedUser));
    window.dispatchEvent(new Event('auth:changed'));
    
    return updatedUser;
  }

  /**
   * Get stored auth token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Store auth data in localStorage
   */
  private setAuthData(data: AuthResponse): void {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.dispatchEvent(new Event('auth:changed'));
  }
}

const authService = new AuthService();
export default authService;
