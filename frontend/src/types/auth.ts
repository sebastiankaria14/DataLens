// Shared type definitions for authentication

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface SignupData {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
