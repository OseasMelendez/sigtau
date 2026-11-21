/**
 * Todas las llamadas a la API, agrupadas por módulo. Cada función documenta el
 * endpoint que el backend debe implementar (detalle completo en API.md).
 */
import { api } from './lib/api';
import type {
  Asignatura, Catalogos, FiltrosReporte, Franja, Metricas, NivelProgreso, Notificacion, ReporteGenerado,
  RolUsuario, SolicitudEstudiante, SolicitudTutor, TutorDetalle, TutorResumen, Tutoria, UsuarioAdmin,
  VistaPreviaReporte,
} from './types';

const qs = (p: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && s.set(k, String(v)));
  const t = s.toString();
  return t ? `?${t}` : '';
};

// ---------- Catálogos y tutores (lectura, cualquier rol autenticado) ----------
export const catalogos = {
  asignaturas: () => api.get<Asignatura[]>('/asignaturas'),
  todos: () => api.get<Catalogos>('/catalogos'),
};

export const tutores = {
  /** GET /tutores?asignatura=ID  -> tutores activos que imparten la asignatura */
  porAsignatura: (idAsignatura: number) => api.get<TutorResumen[]>(`/tutores${qs({ asignatura: idAsignatura })}`),
  /** GET /tutores/:id */
  detalle: (id: number) => api.get<TutorDetalle>(`/tutores/${id}`),
  /** GET /tutores/:id/franjas?desde&hasta -> franjas (Disponibles y Ocupadas) del rango */
  franjas: (id: number, desde: string, hasta: string) =>
    api.get<Franja[]>(`/tutores/${id}/franjas${qs({ desde, hasta })}`),
};

// ---------- M2 Solicitudes ----------
export const solicitudes = {
  /** Estudiante. GET /solicitudes/mias */
  mias: () => api.get<SolicitudEstudiante[]>('/solicitudes/mias'),
  /** Estudiante. POST /solicitudes */
  crear: (d: { id_asignatura: number; id_horario: number; descripcion_dificultad: string }) =>
    api.post<SolicitudEstudiante>('/solicitudes', d),
  /** Estudiante. POST /solicitudes/:id/documento (multipart, campo "archivo"): documento de apoyo opcional */
  subirDocumento: (id: number, archivo: File) => api.subir<void>(`/solicitudes/${id}/documento`, archivo),
  /** URL para abrir el documento de apoyo (estudiante dueño, tutor de la franja o coordinador) */
  urlDocumento: (id: number) => `/api/solicitudes/${id}/documento`,
  /** Tutor. GET /solicitudes/pendientes */
  pendientes: () => api.get<SolicitudTutor[]>('/solicitudes/pendientes'),
  /** Tutor. POST /solicitudes/:id/aprobar  { lugar } -> crea la tutoría (RF-04/RF-07) */
  aprobar: (id: number, lugar: string) => api.post<{ id_tutoria: number }>(`/solicitudes/${id}/aprobar`, { lugar }),
  /** Tutor. POST /solicitudes/:id/rechazar  { motivo_rechazo? } */
  rechazar: (id: number, motivo_rechazo?: string) =>
    api.post<void>(`/solicitudes/${id}/rechazar`, { motivo_rechazo: motivo_rechazo || undefined }),
};

// ---------- M3 Horarios (tutor) ----------
export const horarios = {
  /** GET /horarios/mios?desde&hasta */
  mios: (desde: string, hasta: string) => api.get<Franja[]>(`/horarios/mios${qs({ desde, hasta })}`),
  /** POST /horarios  { fecha, hora_inicio, hora_fin } */
  crear: (d: { fecha: string; hora_inicio: string; hora_fin: string }) => api.post<Franja>('/horarios', d),
  /** PUT /horarios/:id  (solo franjas Disponibles sin solicitudes pendientes) */
  editar: (id: number, d: { fecha: string; hora_inicio: string; hora_fin: string }) =>
    api.put<Franja>(`/horarios/${id}`, d),
  /** DELETE /horarios/:id  (solo franjas Disponibles sin solicitudes ni tutorías) */
  eliminar: (id: number) => api.delete<void>(`/horarios/${id}`),
};

// ---------- M4 / M5 Tutorías y seguimiento ----------
export const tutorias = {
  /** Estudiante o tutor: sus tutorías (todas, más recientes primero). GET /tutorias */
  mias: () => api.get<Tutoria[]>('/tutorias'),
  /** GET /tutorias/:id (solo el estudiante o el tutor de la tutoría) */
  detalle: (id: number) => api.get<Tutoria>(`/tutorias/${id}`),
  /** Tutor. POST /tutorias/:id/cancelar { motivo } (RF-13) */
  cancelar: (id: number, motivo: string) => api.post<void>(`/tutorias/${id}/cancelar`, { motivo }),
  /** Tutor. POST /tutorias/:id/reprogramar { id_horario_propuesto, motivo } (RF-14) */
  reprogramar: (id: number, id_horario_propuesto: number, motivo: string) =>
    api.post<void>(`/tutorias/${id}/reprogramar`, { id_horario_propuesto, motivo }),
  /** Tutor. POST /tutorias/:id/seguimiento (RF-08) */
  seguimiento: (id: number, d: { asistio: boolean; nivel_progreso?: NivelProgreso; observaciones: string }) =>
    api.post<void>(`/tutorias/${id}/seguimiento`, d),
};

export const reprogramaciones = {
  /** Estudiante. POST /reprogramaciones/:id/aceptar */
  aceptar: (id: number) => api.post<void>(`/reprogramaciones/${id}/aceptar`),
  /** Estudiante. POST /reprogramaciones/:id/rechazar */
  rechazar: (id: number) => api.post<void>(`/reprogramaciones/${id}/rechazar`),
};

// ---------- M6 Notificaciones ----------
export const notificaciones = {
  /** GET /notificaciones (las del usuario, más recientes primero, máx. 50) */
  mias: () => api.get<Notificacion[]>('/notificaciones'),
  /** PATCH /notificaciones/:id/leida */
  marcarLeida: (id: number) => api.patch<void>(`/notificaciones/${id}/leida`),
  /** PATCH /notificaciones/leidas */
  marcarTodas: () => api.patch<void>('/notificaciones/leidas'),
};

// ---------- M8 Usuarios (coordinador) ----------
export interface DatosUsuario {
  rol: RolUsuario;
  nombre_usuario: string;
  nombre_completo: string;
  identificacion: string;
  correo: string;
  contrasena?: string; // obligatoria al crear; al editar, solo si se cambia
  estudiante?: { id_carrera: number; ciclo: number | null };
  tutor?: {
    id_facultad: number;
    titulo: string | null;
    departamento: string | null;
    especialidad: string;
    telefono_contacto: string | null;
    biografia: string | null;
    asignaturas: number[];
  };
}

export const usuarios = {
  /** GET /usuarios?rol&q&activo */
  listar: (f: { rol?: RolUsuario | ''; q?: string; activo?: boolean | '' } = {}) =>
    api.get<UsuarioAdmin[]>(`/usuarios${qs(f)}`),
  /** POST /usuarios */
  crear: (d: DatosUsuario) => api.post<UsuarioAdmin>('/usuarios', d),
  /** PUT /usuarios/:id */
  editar: (id: number, d: DatosUsuario) => api.put<UsuarioAdmin>(`/usuarios/${id}`, d),
  /** PATCH /usuarios/:id/activo { activo } (RF-12: desactivar, nunca eliminar) */
  cambiarActivo: (id: number, activo: boolean) => api.patch<void>(`/usuarios/${id}/activo`, { activo }),
  /** Coordinador. POST /usuarios/:id/foto (multipart "archivo") */
  subirFoto: (id: number, archivo: File) => api.subir<void>(`/usuarios/${id}/foto`, archivo),
  /** Cualquier rol. URL de la foto de perfil (404 si no tiene) */
  urlFoto: (id: number, version: number) => `/api/usuarios/${id}/foto?v=${version}`,
};

/** Cualquier rol: cambiar la foto propia. POST /perfil/foto */
export const perfil = {
  subirFoto: (archivo: File) => api.subir<void>('/perfil/foto', archivo),
};

// ---------- M7 Reportes (coordinador) ----------
export const reportes = {
  /** GET /reportes/metricas */
  metricas: () => api.get<Metricas>('/reportes/metricas'),
  /** GET /reportes (historial) */
  historial: () => api.get<ReporteGenerado[]>('/reportes'),
  /** POST /reportes/vista-previa  FiltrosReporte -> tabla */
  vistaPrevia: (f: FiltrosReporte) => api.post<VistaPreviaReporte>('/reportes/vista-previa', f),
  /** POST /reportes  FiltrosReporte + formato -> archivo (y registro en tabla reporte) */
  descargar: (f: FiltrosReporte, formato: 'PDF' | 'XLSX') =>
    api.descargar('/reportes', { ...f, formato }, `reporte.${formato.toLowerCase()}`),
  /** GET /reportes/:id/archivo  -> vuelve a generar un reporte del historial (sin crear otro registro) */
  descargarHistorial: (id: number, formato: 'PDF' | 'XLSX') =>
    api.descargar(`/reportes/${id}/archivo`, undefined, `reporte.${formato.toLowerCase()}`),
};
