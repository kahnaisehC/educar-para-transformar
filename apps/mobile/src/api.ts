const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  formData?: FormData;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    const payload = data as { error?: string; code?: string };
    throw new ApiError(
      response.status,
      payload.error ?? "No se pudo completar la operación",
      payload.code ?? "REQUEST_ERROR",
    );
  }
  return data as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers,
    body,
  });
  return parseResponse<T>(response);
}

export async function apiUpload<T>(path: string, token: string, formData: FormData): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseResponse<T>(response);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
