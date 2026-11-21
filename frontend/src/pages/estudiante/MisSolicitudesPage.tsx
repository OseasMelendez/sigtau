import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Paperclip, XCircle } from 'lucide-react';
import { solicitudes } from '../../services';
import { useCarga } from '../../lib/hooks';
import { nombreTutor } from '../../lib/nombres';
import { diaMes, textoFranja } from '../../lib/fechas';
import { Alerta, Badge, Boton, Cargando, Encabezado, Tarjeta, Vacio } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { ModalReprogramacion } from '../../components/ModalReprogramacion';
import type { SolicitudEstudiante } from '../../types';

type Filtro = 'Todas' | 'Pendiente' | 'Aprobada' | 'Rechazada';

/** Estado visible de la solicitud, considerando su tutoría. */
function estadoVisible(s: SolicitudEstudiante) {
  if (s.tutoria?.reprogramacion_pendiente) return 'Reprogramación pendiente';
  if (s.tutoria && s.tutoria.estado !== 'Programada') return s.tutoria.estado; // Realizada / Cancelada
  return s.estado;
}

/** 8.2.4 Mis solicitudes (Figma 8:2 "Tutorías Dashboard"). RF-03, RF-14 */
export function MisSolicitudesPage() {
  const { datos, cargando, error, recargar } = useCarga(() => solicitudes.mias(), []);
  const [filtro, setFiltro] = useState<Filtro>('Todas');
  const [modal, setModal] = useState<{ s: SolicitudEstudiante; accion: 'aceptar' | 'rechazar' } | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;

  const filtradas = filtro === 'Todas' ? datos : datos.filter((s) => s.estado === filtro);
  const cuenta = (f: Filtro) => (f === 'Todas' ? datos.length : datos.filter((s) => s.estado === f).length);

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Mis Solicitudes" subtitulo="Gestiona tus solicitudes y mantente al día con tus notificaciones." />

      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
        {(['Todas', 'Pendiente', 'Aprobada', 'Rechazada'] as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${filtro === f ? 'border-primario bg-primario-suave text-primario-oscuro' : 'border-borde bg-white text-texto-suave hover:bg-fondo'}`}>
            {f === 'Todas' ? 'Todas' : `${f}s`} ({cuenta(f)})
          </button>
        ))}
        </div>
      </div>

      {filtradas.length === 0 ? <Vacio texto="No hay solicitudes en esta categoría." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((s) => <TarjetaSolicitud key={s.id_solicitud} s={s} onResponder={(accion) => setModal({ s, accion })} />)}
        </div>
      )}

      {modal && (
        <ModalReprogramacion reprogramacion={modal.s.tutoria!.reprogramacion_pendiente} accion={modal.accion}
          asignatura={modal.s.asignatura.nombre} tutor={nombreTutor(modal.s.tutor)}
          onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />
      )}
    </div>
  );
}

function TarjetaSolicitud({ s, onResponder }: { s: SolicitudEstudiante; onResponder: (a: 'aceptar' | 'rechazar') => void }) {
  const estado = estadoVisible(s);
  const t = s.tutoria;

  return (
    <Tarjeta className="flex min-h-64 flex-col gap-3 !rounded-xl !p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{s.asignatura.nombre}</h3>
        <Badge estado={estado} className="shrink-0 !px-2 !text-[10px]" />
      </div>
      {s.estado === 'Pendiente' && (
        <p className="text-[11px] text-texto-suave">Enviada: {diaMes(s.fecha_solicitud)} {s.fecha_solicitud.slice(0, 4)}</p>
      )}

      <div className="flex items-center gap-2.5 rounded-lg bg-fondo-tutor px-2.5 py-2">
        <Iniciales id={s.tutor.id_usuario} nombre={s.tutor.nombre_completo} className="size-8 text-[11px]" />
        <div>
          <p className="text-[10px] text-texto-suave">{s.estado === 'Aprobada' ? 'Tutor' : 'Tutor solicitado'}</p>
          <p className="text-xs font-semibold">{nombreTutor(s.tutor)}</p>
        </div>
      </div>

      {s.tiene_documento && <a href={solicitudes.urlDocumento(s.id_solicitud)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primario hover:underline"><Paperclip size={12} /> Ver documento de apoyo</a>}
      {!t?.reprogramacion_pendiente && (
        <p className="flex items-start gap-1.5 text-[11px] text-texto-suave">
          <CalendarDays size={13} className="mt-px shrink-0" /> {textoFranja(t?.franja ?? s.franja)}
        </p>
      )}

      {s.estado === 'Rechazada' && (
        <p className="min-h-20 flex-1 rounded-lg bg-campo p-3 text-[11px] text-texto-suave italic">
          Motivo: {s.motivo_rechazo || 'El tutor no indicó un motivo.'}
        </p>
      )}
      {t?.estado === 'Cancelada' && (
        <p className="rounded-lg bg-peligro-suave/60 p-3 text-[11px] text-peligro">Motivo de cancelación: {t.motivo_cancelacion}</p>
      )}
      {t?.reprogramacion_pendiente && (
        <div className="rounded-lg border border-borde bg-campo/70 p-3 text-xs">
          <p className="font-medium text-primario-oscuro">Nueva fecha propuesta:</p>
          <p className="text-texto-suave">{textoFranja(t.reprogramacion_pendiente.franja_propuesta)}</p>
        </div>
      )}

      <div className="mt-auto border-t border-borde pt-3">
        {s.estado === 'Pendiente' && (
          <p className="flex items-center gap-2 text-[11px] text-texto-suave"><Clock size={14} /> En revisión por el tutor</p>
        )}
        {s.estado === 'Rechazada' && (
          <Link to={`/estudiante/nueva-solicitud?asignatura=${s.asignatura.id_asignatura}`}>
            <Boton variante="peligro-borde" className="w-full !rounded-md !py-1.5 text-xs font-medium"><XCircle size={14} /> Buscar otro tutor</Boton>
          </Link>
        )}
        {t?.reprogramacion_pendiente ? (
          <div className="grid grid-cols-2 gap-3">
            <Boton variante="exito" className="!rounded-md !py-1.5 text-xs font-medium" onClick={() => onResponder('aceptar')}>Aceptar</Boton>
            <Boton variante="peligro" className="!rounded-md !py-1.5 text-xs font-medium" onClick={() => onResponder('rechazar')}>Rechazar</Boton>
          </div>
        ) : t && (
          <Link to={`/estudiante/tutorias/${t.id_tutoria}`}><Boton className="w-full !rounded-md !py-1.5 text-xs font-medium">Ver Detalle</Boton></Link>
        )}
      </div>
    </Tarjeta>
  );
}
