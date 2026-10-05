export interface Productor {
  id: number;
  nombre: string;
  nombre_negocio: string | null;
  email: string;
  activo: boolean;
  created_at: string;
}

export interface RegisterRequest {
  nombre: string;
  nombre_negocio: string;
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  nombre: string;
  nombre_negocio: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  productor: Productor;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;
  /** Structured `detail` of the response when the API sends an object (e.g. a 409 with data). */
  readonly detail?: unknown;

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.detail = detail;
  }
}
