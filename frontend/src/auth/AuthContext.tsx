import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export type Rol = 'Estudiante' | 'Tutor' | 'Coordinador';

export interface Usuario {
  id_usuario: number;
  nombre_usuario: string;
  nombre_completo: string;
  correo: string;
  rol: Rol;
  debe_cambiar_contrasena: boolean;
  estudiante: { carrera: string; ciclo: number | null } | null;
  tutor: { especialidad: string; asignaturas: string[] } | null;
}

interface AuthValor {
  usuario: Usuario | null;
  cargando: boolean;
  login: (usuario: string, contrasena: string) => Promise<Usuario>;
  logout: () => Promise<void>;
  /** Actualiza datos del usuario en memoria (p. ej. tras cambiar la contraseña) */
  actualizarUsuario: (cambios: Partial<Usuario>) => void;
}

const AuthContext = createContext<AuthValor | null>(null);

/** Ruta de inicio de cada rol. */
export const INICIO_POR_ROL: Record<Rol, string> = {
  Estudiante: '/estudiante',
  Tutor: '/tutor',
  Coordinador: '/coordinador',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  // Al cargar la app se pregunta al backend si la cookie sigue siendo válida
  useEffect(() => {
    api
      .get<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));

    const expirada = () => setUsuario(null);
    window.addEventListener('sigtau:sesion-expirada', expirada);
    return () => window.removeEventListener('sigtau:sesion-expirada', expirada);
  }, []);

  const login = useCallback(async (u: string, c: string) => {
    const r = await api.post<{ usuario: Usuario }>('/auth/login', { usuario: u, contrasena: c });
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const actualizarUsuario = useCallback((cambios: Partial<Usuario>) => {
    setUsuario((u) => (u ? { ...u, ...cambios } : u));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, actualizarUsuario }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
