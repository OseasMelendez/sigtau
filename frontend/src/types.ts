/**
 * Tipos de los datos que devuelve la API. Son el CONTRATO entre frontend y
 * backend: el backend debe responder exactamente con estas formas (ver API.md).
 *
 * Convención de fechas:
 *  - Franja.fecha: 'YYYY-MM-DD'; hora_inicio / hora_fin: 'HH:mm'  (texto plano)
 *  - Campos fecha_* (timestamps): ISO tal como los serializa Prisma; se formatean
 *    con src/lib/fechas.ts
 */

export type EstadoSolicitud = 'Pendiente' | 'Aprobada' | 'Rechazada';
export type EstadoTutoria = 'Programada' | 'Realizada' | 'Cancelada';
export type EstadoFranja = 'Disponible' | 'Ocupado';
export type NivelProgreso = 'Bajo' | 'Medio' | 'Avanzado';
export type RolUsuario = 'Estudiante' | 'Tutor' | 'Coordinador';

export interface Asignatura {
  id_asignatura: number;
  codigo: string;
  nombre: string;
}

export interface Franja {
  id_horario: number;
  fecha: string;        // 'YYYY-MM-DD'
  hora_inicio: string;  // 'HH:mm'
  hora_fin: string;     // 'HH:mm'
  estado: EstadoFranja;
}

export interface PersonaResumen {
  id_usuario: number;
  nombre_completo: string;
}

/** Tarjeta de tutor en Nueva Solicitud */
export interface TutorResumen extends PersonaResumen {
  especialidad: string;
  franjas_disponibles: number;  // franjas Disponibles desde hoy
  dias_disponibles: number[];   // días de la semana con franjas disponibles, 1 = lunes ... 7 = domingo
}

export interface TutorDetalle extends PersonaResumen {
  especialidad: string;
  biografia: string | null;
  telefono_contacto: string | null;
  asignaturas: Asignatura[];
}

export interface Reprogramacion {
  id_reprogramacion: number;
  motivo: string;
  franja_propuesta: Franja;
  fecha_propuesta: string;
}

export interface Seguimiento {
  id_seguimiento: number;
  asistio: boolean;
  nivel_progreso: NivelProgreso | null;
  observaciones: string;
  fecha_registro: string;
}

/** Tutoría con todo lo necesario para listas y detalle (estudiante y tutor) */
export interface Tutoria {
  id_tutoria: number;
  id_solicitud: number;
  estado: EstadoTutoria;
  lugar: string | null;
  franja: Franja;              // horario vigente
  asignatura: Asignatura;
  tutor: PersonaResumen & { especialidad: string; biografia: string | null };
  estudiante: PersonaResumen & { carrera: string };
  descripcion_dificultad: string;
  fecha_programacion: string;
  motivo_cancelacion: string | null;
  fecha_cancelacion: string | null;
  seguimiento: Seguimiento | null;
  reprogramacion_pendiente: Reprogramacion | null;
  /** true si se aceptó alguna reprogramación (se muestra "Reprogramada") */
  reprogramada: boolean;
}

/** Solicitud vista por el estudiante (Mis Solicitudes) */
export interface SolicitudEstudiante {
  id_solicitud: number;
  estado: EstadoSolicitud;
  descripcion_dificultad: string;
  motivo_rechazo: string | null;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  asignatura: Asignatura;
  tutor: PersonaResumen;
  franja: Franja;              // franja que eligió el estudiante
  tutoria: {
    id_tutoria: number;
    estado: EstadoTutoria;
    lugar: string | null;
    franja: Franja;
    motivo_cancelacion: string | null;
    reprogramacion_pendiente: Reprogramacion | null;
  } | null;
}

/** Solicitud pendiente vista por el tutor */
export interface SolicitudTutor {
  id_solicitud: number;
  fecha_solicitud: string;
  descripcion_dificultad: string;
  asignatura: Asignatura;
  franja: Franja;
  estudiante: PersonaResumen & { carrera: string };
}

export interface Notificacion {
  id_notificacion: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_envio: string;
}

export interface UsuarioAdmin {
  id_usuario: number;
  nombre_usuario: string;
  nombre_completo: string;
  identificacion: string;
  correo: string;
  rol: RolUsuario;
  activo: boolean;
  ultimo_acceso: string | null;
  fecha_registro: string;
  estudiante: { id_carrera: number; carrera: string; ciclo: number | null } | null;
  tutor: {
    id_facultad: number;
    especialidad: string;
    telefono_contacto: string | null;
    biografia: string | null;
    asignaturas: Asignatura[];
  } | null;
}

export interface Catalogos {
  facultades: { id_facultad: number; nombre: string }[];
  carreras: { id_carrera: number; codigo: string; nombre: string; id_facultad: number }[];
  asignaturas: Asignatura[];
}

export interface Metricas {
  total_usuarios: number;
  usuarios_por_rol: Record<RolUsuario, number>;
  usuarios_activos: number;
  sesiones_activas: number;
  solicitudes_pendientes: number;
  tutorias_por_estado: Record<EstadoTutoria, number>;
  demanda_por_asignatura: { asignatura: string; total: number }[];
  /** Solicitudes por carrera del estudiante (Figma "Participación por Facultad") */
  participacion_por_carrera: { carrera: string; total: number }[];
  tasa_asistencia: number; // 0 a 100
}

export const TIPOS_REPORTE = [
  'Tutorías realizadas',
  'Asistencia estudiantil',
  'Progreso académico',
  'Demanda por asignatura',
  'Gestión de solicitudes',
] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export interface FiltrosReporte {
  tipo: TipoReporte;
  fecha_desde: string; // 'YYYY-MM-DD'
  fecha_hasta: string;
  id_tutor?: number;
  id_asignatura?: number;
  estado_filtro?: EstadoTutoria;
}

export interface VistaPreviaReporte {
  titulo: string;
  total_tutorias: number;   // tutorías que cumplen los filtros
  tasa_asistencia: number;  // 0 a 100, de esas tutorías con seguimiento
  columnas: string[];
  filas: (string | number)[][];
}

export interface ReporteGenerado {
  id_reporte: number;
  tipo: TipoReporte;
  fecha_desde: string;       // 'YYYY-MM-DD'
  fecha_hasta: string;
  id_tutor: number | null;
  tutor: string | null;      // nombre del tutor filtrado
  id_asignatura: number | null;
  asignatura: string | null; // nombre de la asignatura filtrada
  estado_filtro: EstadoTutoria | null;
  formato: 'PDF' | 'XLSX';
  fecha_generacion: string;
  responsable: string;       // nombre del coordinador que lo generó
}
