export type Role =
  | 'ADMIN'
  | 'SALES'
  | 'TECHNICIAN'
  | 'FOREMAN'
  | 'WAREHOUSE'
  | 'PROCUREMENT'
  | string;

export interface AuthUser {
  staffId: string;
  staffName: string;
  role: Role;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  staffId: string;
  role: string;
  staffName: string;
}
