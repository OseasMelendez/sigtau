import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen, CalendarDays, ChartColumn, FileText, GraduationCap, History, House, LogOut, Plus, Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, type Rol } from '../auth/AuthContext';
import { NotificacionesPanel } from './NotificacionesPanel';

interface ItemMenu { a: string; texto: string; icono: LucideIcon; exacto?: boolean }

/** Menú lateral de cada rol, igual que en el Figma. */
const MENU: Record<Rol, { subtitulo: string; boton?: ItemMenu; items: ItemMenu[] }> = {
  Estudiante: {
    subtitulo: 'Portal Estudiantil',
    boton: { a: '/estudiante/nueva-solicitud', texto: 'Nueva Solicitud', icono: Plus },
    items: [
      { a: '/estudiante', texto: 'Inicio', icono: House, exacto: true },
      { a: '/estudiante/solicitudes', texto: 'Mis Solicitudes', icono: FileText },
      { a: '/estudiante/historial', texto: 'Historial', icono: History },
    ],
  },
  Tutor: {
    subtitulo: 'Portal Tutor',
    items: [
      { a: '/tutor', texto: 'Inicio/Solicitudes', icono: House, exacto: true },
      { a: '/tutor/horarios', texto: 'Gestionar Horarios', icono: CalendarDays },
      { a: '/tutor/tutorias', texto: 'Mis Tutorías', icono: BookOpen },
    ],
  },
  Coordinador: {
    subtitulo: 'Portal Administrador',
    items: [
      { a: '/coordinador', texto: 'Inicio / Métricas', icono: House, exacto: true },
      { a: '/coordinador/usuarios', texto: 'Gestión de Usuarios', icono: Users },
      { a: '/coordinador/reportes', texto: 'Reportes Globales', icono: ChartColumn },
    ],
  },
};

export function Iniciales({ nombre, className = '' }: { nombre: string; className?: string }) {
  const ini = nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primario-suave font-semibold text-primario-oscuro ${className}`}>
      {ini}
    </span>
  );
}

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  if (!usuario) return null;
  const menu = MENU[usuario.rol];

  const salir = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const claseItem = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-nav-activo text-primario-oscuro before:absolute before:-left-1 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-primario'
        : 'text-texto-suave hover:bg-fondo'
    }`;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-borde bg-superficie px-4 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primario text-white">
            <GraduationCap size={22} />
          </span>
          <div>
            <p className="text-lg leading-tight font-bold text-primario">SIGTAU</p>
            <p className="text-xs text-texto-suave">{menu.subtitulo}</p>
          </div>
        </div>

        {menu.boton && (
          <NavLink
            to={menu.boton.a}
            className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-primario px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primario-hover"
          >
            <menu.boton.icono size={18} /> {menu.boton.texto}
          </NavLink>
        )}

        <nav className="flex flex-col gap-1.5">
          {menu.items.map((it) => (
            <NavLink key={it.a} to={it.a} end={it.exacto} className={claseItem}>
              <it.icono size={18} /> {it.texto}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-borde pt-4">
          <Iniciales nombre={usuario.nombre_completo} className="size-9 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{usuario.nombre_completo}</p>
            <p className="text-xs text-texto-suave">{usuario.rol}</p>
          </div>
          <button onClick={salir} title="Cerrar sesión" className="rounded p-1 text-texto-suave hover:bg-fondo hover:text-peligro">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="ml-56 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-3 border-b border-borde bg-superficie px-6">
          <NotificacionesPanel />
          <Iniciales nombre={usuario.nombre_completo} className="size-9 text-sm" />
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
