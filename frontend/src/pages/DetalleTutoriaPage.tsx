import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, FileText, Lightbulb, MapPin, Timer, TrendingUp, UserCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { tutorias } from '../services';
import { useCarga } from '../lib/hooks';
import { duracion, fechaConDia, fechaHora, textoFranja } from '../lib/fechas';
import { Alerta, Badge, Boton, Cargando, Dato, Tarjeta } from '../components/ui';
import { Iniciales } from '../components/Layout';
import { ModalReprogramacion } from '../components/ModalReprogramacion';

/**
 * Detalle de una tutoría (Figma 65:1362 "Detalles de Sesión").
 * Lo usan el estudiante y el tutor. En lugar de "modalidad / enlace virtual" del
 * prototipo se muestra el lugar, porque SIGTAU solo maneja tutorías presenciales (CP-03).
 */
export function DetalleTutoriaPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const esEstudiante = usuario?.rol === 'Estudiante';
  const { datos: t, cargando, error, recargar } = useCarga(() => tutorias.detalle(Number(id)), [id]);
  const [accion, setAccion] = useState<'aceptar' | 'rechazar' | null>(null);

  if (cargando) return <Cargando />;
  if (error || !t) return <Alerta>{error}</Alerta>;

  const volver = esEstudiante ? '/estudiante/solicitudes' : '/tutor/tutorias';
  const persona = esEstudiante ? t.tutor : t.estudiante;

  return (
    <div className="max-w-5xl">
      <Link to={volver} className="mb-5 inline-flex items-center gap-2 text-sm text-texto-suave hover:text-primario">
        <ArrowLeft size={18} /> {esEstudiante ? 'Mis Solicitudes' : 'Mis Tutorías'} / Detalle de la tutoría
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-3xl font-bold">{t.asignatura.nombre}</h1>
        <Badge estado={t.reprogramacion_pendiente ? 'Reprogramación pendiente' : t.estado} />
      </div>

      {t.reprogramacion_pendiente && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm">
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Reprogramación propuesta: {textoFranja(t.reprogramacion_pendiente.franja_propuesta)}</p>
            <p className="text-amber-700">Motivo: {t.reprogramacion_pendiente.motivo}</p>
          </div>
          {esEstudiante ? (
            <div className="flex gap-2">
              <Boton variante="exito" onClick={() => setAccion('aceptar')}>Aceptar</Boton>
              <Boton variante="peligro" onClick={() => setAccion('rechazar')}>Rechazar</Boton>
            </div>
          ) : <p className="text-amber-700">Esperando respuesta del estudiante.</p>}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          <Tarjeta className="flex items-center gap-5">
            <Iniciales nombre={persona.nombre_completo} className="size-20 text-2xl" />
            <div>
              <p className="text-xs text-texto-suave">{esEstudiante ? 'Tutor' : 'Estudiante'}</p>
              <p className="text-xl font-medium">{persona.nombre_completo}</p>
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-texto-suave">
                {esEstudiante ? t.tutor.especialidad : t.estudiante.carrera}
              </span>
              {esEstudiante && t.tutor.biografia && <p className="mt-2 max-w-md text-sm text-texto-suave">{t.tutor.biografia}</p>}
            </div>
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText size={18} /> Descripción del problema</h2>
            <p className="rounded-lg bg-fondo p-4 text-sm text-texto-suave">"{t.descripcion_dificultad}"</p>
          </Tarjeta>

          {t.estado === 'Cancelada' && (
            <Alerta>Tutoría cancelada el {t.fecha_cancelacion && fechaHora(t.fecha_cancelacion)}. Motivo: {t.motivo_cancelacion}</Alerta>
          )}

          {t.seguimiento && (
            <Tarjeta>
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><Lightbulb size={18} /> Seguimiento académico</h2>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Dato icono={<UserCheck size={15} />} etiqueta="Asistencia">{t.seguimiento.asistio ? 'Asistió' : 'No asistió'}</Dato>
                <Dato icono={<TrendingUp size={15} />} etiqueta="Nivel alcanzado">{t.seguimiento.nivel_progreso ?? '—'}</Dato>
              </div>
              <p className="rounded-lg bg-primario-suave/50 p-4 text-sm text-primario-oscuro">"{t.seguimiento.observaciones}"</p>
            </Tarjeta>
          )}
        </div>

        <Tarjeta className="flex flex-col gap-4">
          <h2 className="font-semibold">Detalles de la Sesión</h2>
          <Dato icono={<CalendarDays size={15} />} etiqueta="Fecha">{fechaConDia(t.franja.fecha)}</Dato>
          <Dato icono={<Clock size={15} />} etiqueta="Hora">{t.franja.hora_inicio} – {t.franja.hora_fin}</Dato>
          <Dato icono={<Timer size={15} />} etiqueta="Duración">{duracion(t.franja.hora_inicio, t.franja.hora_fin)}</Dato>
          <Dato icono={<MapPin size={15} />} etiqueta="Lugar">{t.lugar || 'Por confirmar'}</Dato>
          <p className="border-t border-borde pt-3 text-xs text-texto-suave">Programada el {fechaHora(t.fecha_programacion)}</p>
        </Tarjeta>
      </div>

      {accion && (
        <ModalReprogramacion reprogramacion={t.reprogramacion_pendiente} accion={accion}
          asignatura={t.asignatura.nombre} tutor={t.tutor.nombre_completo}
          onCerrar={() => setAccion(null)} onListo={() => { setAccion(null); recargar(); }} />
      )}
    </div>
  );
}
