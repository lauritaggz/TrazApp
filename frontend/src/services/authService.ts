import { clearAccessToken, getAccessToken } from "@/lib/tokenStorage";
import {
  ApiError,
  type LoginRequest,
  type LoginResponse,
  type Productor,
  type RegisterRequest,
  type UpdateProfileRequest,
} from "@/types/auth";

function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new ApiError(
      "No se pudo conectar con el servidor. Intenta de nuevo más tarde.",
      0,
    );
  }
  return baseUrl;
}

function mapFieldErrors(detail: unknown): Record<string, string> {
  if (!Array.isArray(detail)) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};
  for (const item of detail) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("loc" in item) ||
      !("msg" in item)
    ) {
      continue;
    }

    const loc = (item as { loc: unknown }).loc;
    const msg = (item as { msg: unknown }).msg;
    if (!Array.isArray(loc) || typeof msg !== "string") {
      continue;
    }

    const field = loc.filter((part) => typeof part === "string").at(-1);
    if (!field) {
      continue;
    }

    if (field === "nombre") fieldErrors.name = "Revisa el nombre ingresado.";
    else if (field === "nombre_negocio")
      fieldErrors.businessName =
        "Revisa el nombre del negocio o emprendimiento.";
    else if (field === "email")
      fieldErrors.email = "Revisa el correo electrónico ingresado.";
    else if (field === "password")
      fieldErrors.password = "Revisa la contraseña ingresada.";
  }
  return fieldErrors;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    const body = (await response.json()) as { detail?: unknown };
    detail = body.detail;
  } catch {
    detail = undefined;
  }

  if (response.status === 401) {
    return new ApiError("Credenciales inválidas", 401);
  }
  if (response.status === 409) {
    const message =
      typeof detail === "string"
        ? detail
        : "El correo ya está registrado";
    return new ApiError(message, 409);
  }
  if (response.status === 422) {
    return new ApiError(
      "Revisa los datos del formulario.",
      422,
      mapFieldErrors(detail),
    );
  }

  return new ApiError(
    "No se pudo completar la operación. Intenta de nuevo más tarde.",
    response.status,
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const token = getAccessToken();
    if (!token) {
      throw new ApiError("No autenticado", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Intenta de nuevo más tarde.",
      0,
    );
  }

  if (!response.ok) {
    if (authenticated && response.status === 401) {
      clearAccessToken();
      throw new ApiError("Tu sesión ha expirado. Inicia sesión nuevamente.", 401);
    }
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function register(payload: RegisterRequest): Promise<Productor> {
  return request<Productor>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentProductor(): Promise<Productor> {
  return request<Productor>("/auth/me", { method: "GET" }, true);
}

export async function updateProfile(
  payload: UpdateProfileRequest,
): Promise<Productor> {
  return request<Productor>(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}
