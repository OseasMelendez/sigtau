import { Navigate, Outlet } from 'react-router-dom';
import { INICIO_POR_ROL, useAuth, type Rol } from './AuthContext';

/**
 * Deja pasar solo a usuarios autenticados con alguno de los roles indicados.
 * La seguridad real está en el backend (guards de NestJS); esto solo evita
 * mostrar pantallas que el usuario no puede usar.
 */
export function RutaProtegida({ roles }: { roles: Rol[] }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-texto-suave">Cargando…</div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />;
  return <Outlet />;
}
