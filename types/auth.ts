export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  error?: string;
}
