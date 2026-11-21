import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Paperclip, CalendarClock, CalendarDays, ClipboardCheck, Clock, FileText, Lightbulb, MapPin, Timer, TrendingUp, UserCheck, XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { solicitudes, tutorias } from '../services';
import { useCarga } from '../lib/hooks';
import { nombreTutor } from '../lib/nombres';
import { duracion, fechaConDia, fechaHora, textoFranja, yaOcurrio } from '../lib/fechas';
import { Alerta, Badge, Boton, Cargando, Tarjeta } from '../components/ui';
import { Iniciales } from '../components/Layout';
import { ModalReprogramacion } from '../components/ModalReprogramacion';
import { ModalCancelar, ModalReprogramar } from './tutor/ModalesTutoria';

/** Dato con ícono en un cuadro lila, como en "Detalles de la Sesión" del Figma */
function DatoSesion({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primario-suave/70 text-primario">{icono}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-texto-suave">{etiqueta}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

/**
 * Detalle de una tutoría (Figma 65:1362 "Detalles de Sesión").
 * Lo usan el estudiante y el tutor (el Figma solo tiene la vista del estudiante).
 * En lugar de "modalidad / enlace virtual" del prototipo se muestra el lugar,
 * porque SIGTAU solo maneja tutorías presenciales (CP-03).
 */
export function DetalleTutoriaPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const esEstudiante = usuario?.rol === 'Estudiante';
  const { datos: t, cargando, error, recargar } = useCarga(() => tutorias.detalle(Number(id)), [id]);
  const [accion, setAccion] = useState<'aceptar' | 'rechazar' | null>(null);
  const [modalTutor, setModalTutor] = useState<'cancelar' | 'reprogramar' | null>(null);

  if (cargando) return <Cargando />;
  if (error || !t) return <Alerta>{error}</Alerta>;

  const volver = esEstudiante ? '/estudiante/solicitudes' : '/tutor/tutorias';
  const persona = esEstudiante ? t.tutor : t.estudiante;
  const programada = t.estado === 'Programada';
  const botonChico = '!rounded-md !px-3 !py-1.5 text-xs font-medium';

  return (
    <div className="max-w-5xl">
      <Link to={volver} className="mb-4 inline-flex items-center gap-2 text-xs text-texto-suave hover:text-primario">
        <ArrowLeft size={15} className="text-primario" /> {esEstudiante ? 'Mis Solicitudes' : 'Mis Tutorías'} / Detalle de la tutoría
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t.asignatura.nombre}</h1>
        <Badge estado={t.reprogramacion_pendiente ? 'Reprogramación pendiente' : t.estado} className="!px-2 !py-0 !text-[10px]" />

        {/* Acciones del tutor (no están en el Figma: son las mismas de "Mis Tutorías") */}
        {!esEstudiante && programada && (
          <div className="ml-auto flex flex-wrap gap-2">
            {yaOcurrio(t.franja) && (
              <Link to={`/tutor/tutorias?tutoria=${t.id_tutoria}`}>
                <Boton className={botonChico}><ClipboardCheck size={14} /> Registrar seguimiento</Boton>
              </Link>
            )}
            {!t.reprogramacion_pendiente && (
              <Boton variante="secundario" className={botonChico} onClick={() => setModalTutor('reprogramar')}><CalendarClock size={14} /> Reprogramar</Boton>
            )}
            <Boton variante="peligro-borde" className={botonChico} onClick={() => setModalTutor('cancelar')}><XCircle size={14} /> Cancelar tutoría</Boton>
          </div>
        )}
      </div>

      {t.reprogramacion_pendiente && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm">
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Reprogramación propuesta: {textoFranja(t.reprogramacion_pendiente.franja_propuesta)}</p>
            <p className="text-xs text-amber-700">Motivo: {t.reprogramacion_pendiente.motivo}</p>
          </div>
          {esEstudiante ? (
            <div className="flex gap-2">
              <Boton variante="exito" className={botonChico} onClick={() => setAccion('aceptar')}>Aceptar</Boton>
              <Boton variante="peligro" className={botonChico} onClick={() => setAccion('rechazar')}>Rechazar</Boton>
            </div>
          ) : <p className="text-xs text-amber-700">Esperando respuesta del estudiante.</p>}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_17rem]">
        <div className="flex flex-col gap-5">
          <Tarjeta className="flex items-center gap-4 !p-5">
            <Iniciales nombre={persona.nombre_completo} className="size-16 text-xl" />
            <div className="min-w-0">
              <p className="text-[10px] text-texto-suave">{esEstudiante ? 'Tutor' : 'Estudiante'}</p>
              <p className="text-lg font-medium">{esEstudiante ? nombreTutor(t.tutor) : persona.nombre_completo}</p>
              <span className="mt-0.5 inline-block rounded-full bg-campo px-2 py-0.5 text-[10px] text-texto-suave">
                {esEstudiante ? t.tutor.especialidad : t.estudiante.carrera}
              </span>
              {esEstudiante && t.tutor.departamento && <span className="ml-1.5 text-[10px] text-texto-suave">{t.tutor.departamento}</span>}
              {esEstudiante && t.tutor.biografia && <p className="mt-2 max-w-md text-xs text-texto-suave">{t.tutor.biografia}</p>}
            </div>
          </Tarjeta>

          <Tarjeta className="!p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><FileText size={16} /> Descripción del problema</h2>
            <p className="rounded-lg bg-campo/70 p-4 text-xs leading-relaxed text-texto-suave">"{t.descripcion_dificultad}"</p>
            {t.tiene_documento && <a href={solicitudes.urlDocumento(t.id_solicitud)} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primario hover:underline"><Paperclip size={12} /> Ver documento de apoyo</a>}
          </Tarjeta>

          {t.estado === 'Cancelada' && (
            <Alerta>Tutoría cancelada el {t.fecha_cancelacion && fechaHora(t.fecha_cancelacion)}. Motivo: {t.motivo_cancelacion}</Alerta>
          )}

          {t.seguimiento && (
            <Tarjeta className="!p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-medium"><Lightbulb size={16} /> Seguimiento académico</h2>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <DatoSesion icono={<UserCheck size={15} />} etiqueta="Asistencia">{t.seguimiento.asistio ? 'Asistió' : 'No asistió'}</DatoSesion>
                <DatoSesion icono={<TrendingUp size={15} />} etiqueta="Nivel alcanzado">{t.seguimiento.nivel_progreso ?? '—'}</DatoSesion>
              </div>
              <p className="rounded-lg bg-primario-suave/50 p-4 text-xs leading-relaxed text-primario-oscuro">"{t.seguimiento.observaciones}"</p>
            </Tarjeta>
          )}
        </div>

        <Tarjeta className="flex flex-col gap-4 !p-5">
          <h2 className="text-sm font-medium">Detalles de la Sesión</h2>
          <DatoSesion icono={<CalendarDays size={15} />} etiqueta="Fecha">{fechaConDia(t.franja.fecha)}</DatoSesion>
          <DatoSesion icono={<Clock size={15} />} etiqueta="Hora">{t.franja.hora_inicio} – {t.franja.hora_fin}</DatoSesion>
          <DatoSesion icono={<Timer size={15} />} etiqueta="Duración">{duracion(t.franja.hora_inicio, t.franja.hora_fin)}</DatoSesion>
          {/* El Figma muestra aquí "Modalidad: Virtual" y el enlace de reunión: descartado, el sistema es presencial (CP-03) */}
          <DatoSesion icono={<MapPin size={15} />} etiqueta="Lugar">{t.lugar || 'Por confirmar'}</DatoSesion>
          <p className="border-t border-borde pt-3 text-[11px] text-texto-suave">Programada el {fechaHora(t.fecha_programacion)}</p>
        </Tarjeta>
      </div>

      {accion && (
        <ModalReprogramacion reprogramacion={t.reprogramacion_pendiente} accion={accion}
          asignatura={t.asignatura.nombre} tutor={nombreTutor(t.tutor)}
          onCerrar={() => setAccion(null)} onListo={() => { setAccion(null); recargar(); }} />
      )}
      <ModalCancelar tutoria={modalTutor === 'cancelar' ? t : null} onCerrar={() => setModalTutor(null)} onListo={() => { setModalTutor(null); recargar(); }} />
      <ModalReprogramar tutoria={modalTutor === 'reprogramar' ? t : null} onCerrar={() => setModalTutor(null)} onListo={() => { setModalTutor(null); recargar(); }} />
    </div>
  );
}
