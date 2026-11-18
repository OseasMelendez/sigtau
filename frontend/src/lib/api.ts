/**
 * Cliente HTTP de SIGTAU. Todas las llamadas van a /api (Vite las redirige al
 * backend) e incluyen la cookie de sesión. Si el backend responde con error,
 * se lanza ApiError con el mensaje listo para mostrar al usuario.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(metodo: Metodo, ruta: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }

  const datos = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && ruta !== '/auth/login' && ruta !== '/auth/me') {
      window.dispatchEvent(new Event('sigtau:sesion-expirada'));
    }
    throw new ApiError(res.status, datos?.message ?? 'Ocurrió un error inesperado.');
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => request<T>('GET', ruta),
  post: <T>(ruta: string, body?: unknown) => request<T>('POST', ruta, body ?? {}),
  put: <T>(ruta: string, body?: unknown) => request<T>('PUT', ruta, body ?? {}),
  patch: <T>(ruta: string, body?: unknown) => request<T>('PATCH', ruta, body ?? {}),
  delete: <T>(ruta: string) => request<T>('DELETE', ruta),
};
