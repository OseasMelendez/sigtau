/**
 * Consultas (include) y conversiones de filas de Prisma a las formas que espera
 * el frontend (frontend/src/types.ts). Se reutilizan en todos los módulos.
 */
import { Prisma } from '@prisma/client';
import { ahora, textoFecha, textoHora } from './fecha.util';

type Tx = Prisma.TransactionClient;

// ---------- Franjas ----------
export function mapFranja(h: {
  id_horario: number;
  fecha: Date;
  hora_inicio: Date;
  hora_fin: Date;
  estado: string;
}) {
  return {
    id_horario: h.id_horario,
    fecha: textoFecha(h.fecha),
    hora_inicio: textoHora(h.hora_inicio),
    hora_fin: textoHora(h.hora_fin),
    estado: h.estado,
  };
}

/** '09/11/2026 a las 09:00' para los mensajes de notificación */
export function textoFranjaCorto(h: { fecha: Date; hora_inicio: Date }) {
  const [a, m, d] = textoFecha(h.fecha).split('-');
  return `${d}/${m}/${a} a las ${textoHora(h.hora_inicio)}`;
}

export const mapAsignatura = (a: {
  id_asignatura: number;
  codigo: string;
  nombre: string;
  area?: string | null;
}) => ({
  id_asignatura: a.id_asignatura,
  codigo: a.codigo,
  nombre: a.nombre,
  area: a.area ?? null,
});

// ---------- Tutorías ----------
const REPROG_PENDIENTE = {
  where: { estado: 'Pendiente' },
  include: { horario_propuesto: true },
} satisfies Prisma.tutoria$reprogramacionArgs;

/** En el detalle de la tutoría también se traen las aceptadas, para saber si fue reprogramada */
const REPROG_TUTORIA = {
  where: { estado: { in: ['Pendiente', 'Aceptada'] } },
  include: { horario_propuesto: true },
} satisfies Prisma.tutoria$reprogramacionArgs;

export const INCLUDE_TUTORIA = {
  horario_tutor: { include: { tutor: { include: { usuario: true } } } },
  seguimiento: true,
  reprogramacion: REPROG_TUTORIA,
  solicitud_tutoria: {
    include: {
      asignatura: true,
      estudiante: { include: { usuario: true, carrera: true } },
    },
  },
} satisfies Prisma.tutoriaInclude;

type TutoriaCompleta = Prisma.tutoriaGetPayload<{
  include: typeof INCLUDE_TUTORIA;
}>;
type ReprogConFranja = Prisma.reprogramacionGetPayload<{
  include: { horario_propuesto: true };
}>;

function mapReprogramacion(r: ReprogConFranja | undefined) {
  if (!r) return null;
  return {
    id_reprogramacion: r.id_reprogramacion,
    motivo: r.motivo,
    franja_propuesta: mapFranja(r.horario_propuesto),
    fecha_propuesta: r.fecha_propuesta,
  };
}

export function mapTutoria(t: TutoriaCompleta) {
  const tutor = t.horario_tutor.tutor;
  const est = t.solicitud_tutoria.estudiante;
  return {
    id_tutoria: t.id_tutoria,
    id_solicitud: t.id_solicitud,
    estado: t.estado,
    lugar: t.lugar,
    franja: mapFranja(t.horario_tutor),
    asignatura: mapAsignatura(t.solicitud_tutoria.asignatura),
    tutor: {
      id_usuario: tutor.id_usuario,
      nombre_completo: tutor.usuario.nombre_completo,
      titulo: tutor.titulo,
      departamento: tutor.departamento,
      especialidad: tutor.especialidad,
      biografia: tutor.biografia,
    },
    estudiante: {
      id_usuario: est.id_usuario,
      nombre_completo: est.usuario.nombre_completo,
      carrera: est.carrera.nombre,
    },
    descripcion_dificultad: t.solicitud_tutoria.descripcion_dificultad,
    tiene_documento: !!t.solicitud_tutoria.documento_apoyo,
    fecha_programacion: t.fecha_programacion,
    motivo_cancelacion: t.motivo_cancelacion,
    fecha_cancelacion: t.fecha_cancelacion,
    seguimiento: t.seguimiento
      ? {
          id_seguimiento: t.seguimiento.id_seguimiento,
          asistio: t.seguimiento.asistio,
          nivel_progreso: t.seguimiento.nivel_progreso,
          observaciones: t.seguimiento.observaciones,
          fecha_registro: t.seguimiento.fecha_registro,
        }
      : null,
    reprogramacion_pendiente: mapReprogramacion(
      t.reprogramacion.find((r) => r.estado === 'Pendiente'),
    ),
    /** true si alguna vez se aceptó una reprogramación (estado "Reprogramada" del Figma) */
    reprogramada: t.reprogramacion.some((r) => r.estado === 'Aceptada'),
  };
}

// ---------- Solicitudes ----------
export const INCLUDE_SOLICITUD = {
  asignatura: true,
  horario_tutor: { include: { tutor: { include: { usuario: true } } } },
  estudiante: { include: { usuario: true, carrera: true } },
  tutoria: {
    include: { horario_tutor: true, reprogramacion: REPROG_PENDIENTE },
  },
} satisfies Prisma.solicitud_tutoriaInclude;

type SolicitudCompleta = Prisma.solicitud_tutoriaGetPayload<{
  include: typeof INCLUDE_SOLICITUD;
}>;

export function mapSolicitudEstudiante(s: SolicitudCompleta) {
  const t = s.tutoria;
  return {
    id_solicitud: s.id_solicitud,
    estado: s.estado,
    descripcion_dificultad: s.descripcion_dificultad,
    tiene_documento: !!s.documento_apoyo,
    motivo_rechazo: s.motivo_rechazo,
    fecha_solicitud: s.fecha_solicitud,
    fecha_respuesta: s.fecha_respuesta,
    asignatura: mapAsignatura(s.asignatura),
    tutor: {
      id_usuario: s.horario_tutor.tutor.id_usuario,
      nombre_completo: s.horario_tutor.tutor.usuario.nombre_completo,
      titulo: s.horario_tutor.tutor.titulo,
    },
    franja: mapFranja(s.horario_tutor),
    tutoria: t
      ? {
          id_tutoria: t.id_tutoria,
          estado: t.estado,
          lugar: t.lugar,
          franja: mapFranja(t.horario_tutor),
          motivo_cancelacion: t.motivo_cancelacion,
          reprogramacion_pendiente: mapReprogramacion(t.reprogramacion[0]),
        }
      : null,
  };
}

export function mapSolicitudTutor(s: SolicitudCompleta) {
  return {
    id_solicitud: s.id_solicitud,
    fecha_solicitud: s.fecha_solicitud,
    descripcion_dificultad: s.descripcion_dificultad,
    tiene_documento: !!s.documento_apoyo,
    asignatura: mapAsignatura(s.asignatura),
    franja: mapFranja(s.horario_tutor),
    estudiante: {
      id_usuario: s.estudiante.id_usuario,
      nombre_completo: s.estudiante.usuario.nombre_completo,
      carrera: s.estudiante.carrera.nombre,
    },
  };
}

// ---------- Notificaciones (M6) ----------
export type TipoNotificacion =
  | 'Solicitud'
  | 'Tutoría'
  | 'Reprogramación'
  | 'Cancelación'
  | 'Recordatorio'
  | 'Seguimiento'
  | 'Usuario'
  | 'Reporte'
  | 'Sistema';

/** Crea una notificación dentro de la transacción en curso (RF-10). */
export function notificar(
  tx: Tx,
  id_usuario: number,
  tipo: TipoNotificacion,
  titulo: string,
  mensaje: string,
) {
  return tx.notificacion.create({
    data: {
      id_usuario,
      tipo,
      titulo: titulo.slice(0, 100),
      mensaje: mensaje.length > 255 ? `${mensaje.slice(0, 252)}...` : mensaje,
      fecha_envio: ahora(),
    },
  });
}
