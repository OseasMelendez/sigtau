import { useState, useSyncExternalStore } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen, CalendarDays, ChartColumn, FileText, GraduationCap, History, House, LogOut, Menu, Plus, Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, type Rol } from '../auth/AuthContext';
import { NotificacionesPanel } from './NotificacionesPanel';
import { MiPerfil } from './MiPerfil';
import { usuarios as apiUsuarios } from '../services';

// ---------- Fotos de perfil ----------
// "version" cambia cada vez que alguien sube una foto, para que el navegador no muestre la anterior.
let versionFotos = Date.now();
const oyentes = new Set<() => void>();
/** Usuarios que no tienen foto (para no volver a pedirla en cada pantalla) */
const sinFoto = new Set<number>();
export function refrescarFotos() {
  versionFotos = Date.now();
  sinFoto.clear();
  oyentes.forEach((f) => f());
}
const useVersionFotos = () =>
  useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => versionFotos);

export const EXT_FOTO = '.png,.jpg,.jpeg,.webp';
/** Valida la imagen antes de subirla (el backend vuelve a validar) */
export function validarFoto(a: File) {
  if (!/\.(png|jpe?g|webp)$/i.test(a.name)) return 'La foto debe ser una imagen PNG, JPG o WEBP';
  if (a.size > 2 * 1024 * 1024) return 'La foto no puede superar 2 MB';
  return '';
}

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
    subtitulo: 'Portal Coordinador',
    items: [
      { a: '/coordinador', texto: 'Inicio / Métricas', icono: House, exacto: true },
      { a: '/coordinador/usuarios', texto: 'Gestión de Usuarios', icono: Users },
      { a: '/coordinador/reportes', texto: 'Reportes Globales', icono: ChartColumn },
    ],
  },
};

/**
 * Avatar: muestra la foto de perfil si el usuario tiene una (pasando `id`);
 * si no, sus iniciales. `src` permite mostrar una vista previa local.
 */
export function Iniciales({ nombre, className = '', id, src }: { nombre: string; className?: string; id?: number; src?: string }) {
  const version = useVersionFotos();
  const [falloEn, setFalloEn] = useState<string | null>(null);
  const ini = nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const url = src ?? (id && !sinFoto.has(id) ? apiUsuarios.urlFoto(id, version) : null);
  if (url && falloEn !== url) {
    return (
      <img src={url} alt={nombre} className={`inline-block shrink-0 rounded-full bg-primario-suave object-cover ${className}`}
        onError={() => { if (id && !src) sinFoto.add(id); setFalloEn(url); }} />
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primario-suave font-semibold text-primario-oscuro ${className}`}>
      {ini}
    </span>
  );
}

/** Si el usuario aún tiene la contraseña inicial, "Mi perfil" se abre una vez por sesión para pedirle cambiarla. */
const CLAVE_AVISO = 'sigtau:aviso-contrasena';

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  // En teléfono el menú lateral se oculta y se abre con el botón ☰ (en escritorio siempre visible)
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);
  const [perfilAbierto, setPerfilAbierto] = useState(() => {
    try { return !!usuario?.debe_cambiar_contrasena && !sessionStorage.getItem(CLAVE_AVISO); } catch { return false; }
  });
  if (!usuario) return null;
  const abrirPerfil = () => setPerfilAbierto(true);
  const cerrarPerfil = () => {
    try { sessionStorage.setItem(CLAVE_AVISO, '1'); } catch { /* sin almacenamiento */ }
    setPerfilAbierto(false);
  };
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
      {/* Fondo oscuro detrás del menú abierto en teléfono */}
      {menuAbierto && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={cerrarMenu} aria-hidden />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-borde bg-superficie px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-transform md:w-56 md:translate-x-0 ${
        menuAbierto ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>
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
            to={menu.boton.a} onClick={cerrarMenu}
            className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-primario px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primario-hover"
          >
            <menu.boton.icono size={18} /> {menu.boton.texto}
          </NavLink>
        )}

        <nav className="flex flex-col gap-1.5">
          {menu.items.map((it) => (
            <NavLink key={it.a} to={it.a} end={it.exacto} className={claseItem} onClick={cerrarMenu}>
              <it.icono size={18} /> {it.texto}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-borde pt-4">
          {/* Clic en el avatar o el nombre: "Mi perfil" (foto y contraseña) */}
          <button type="button" onClick={() => { cerrarMenu(); abrirPerfil(); }} title="Mi perfil"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 -m-1 text-left hover:bg-fondo">
            <span className="relative shrink-0">
              <Iniciales id={usuario.id_usuario} nombre={usuario.nombre_completo} className="size-9 text-sm" />
              {usuario.debe_cambiar_contrasena && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white" title="Cambia tu contraseña" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{usuario.nombre_completo}</span>
              <span className="block text-xs text-texto-suave">{usuario.rol} · <span className="text-primario">Mi perfil</span></span>
            </span>
          </button>
          <button onClick={salir} title="Cerrar sesión" className="rounded p-1 text-texto-suave hover:bg-fondo hover:text-peligro">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-56">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-borde bg-superficie px-4 md:px-6">
          {/* Solo en teléfono: botón del menú y nombre del sistema */}
          <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú"
            className="-ml-1 rounded-lg p-2 text-texto-suave hover:bg-fondo md:hidden">
            <Menu size={22} />
          </button>
          <span className="mr-auto flex items-center gap-2 font-bold text-primario md:hidden">
            <GraduationCap size={20} /> SIGTAU
          </span>
          <NotificacionesPanel />
          <button type="button" onClick={abrirPerfil} title="Mi perfil" className="rounded-full">
            <Iniciales id={usuario.id_usuario} nombre={usuario.nombre_completo} className="size-9 text-sm" />
          </button>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
        <MiPerfil abierto={perfilAbierto} onCerrar={cerrarPerfil} />
      </div>
    </div>
  );
}
