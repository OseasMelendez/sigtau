import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, XCircle } from 'lucide-react';
import { solicitudes } from '../../services';
import { useCarga } from '../../lib/hooks';
import { fechaLarga, textoFranja } from '../../lib/fechas';
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
      <Encabezado titulo="Mis Solicitudes" subtitulo="Gestiona tus solicitudes de tutoría y responde a las reprogramaciones.">
        <Link to="/estudiante/nueva-solicitud"><Boton>Nueva Solicitud</Boton></Link>
      </Encabezado>

      <div className="mb-5 flex flex-wrap gap-2">
        {(['Todas', 'Pendiente', 'Aprobada', 'Rechazada'] as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`rounded-full border px-3.5 py-1 text-xs font-semibold ${filtro === f ? 'border-primario bg-primario-suave text-primario-oscuro' : 'border-borde bg-white text-texto-suave hover:bg-fondo'}`}>
            {f === 'Todas' ? 'Todas' : `${f}s`} ({cuenta(f)})
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? <Vacio texto="No hay solicitudes en esta categoría." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((s) => <TarjetaSolicitud key={s.id_solicitud} s={s} onResponder={(accion) => setModal({ s, accion })} />)}
        </div>
      )}

      {modal && (
        <ModalReprogramacion reprogramacion={modal.s.tutoria!.reprogramacion_pendiente} accion={modal.accion}
          asignatura={modal.s.asignatura.nombre} tutor={modal.s.tutor.nombre_completo}
          onCerrar={() => setModal(null)} onListo={() => { setModal(null); recargar(); }} />
      )}
    </div>
  );
}

function TarjetaSolicitud({ s, onResponder }: { s: SolicitudEstudiante; onResponder: (a: 'aceptar' | 'rechazar') => void }) {
  const estado = estadoVisible(s);
  const t = s.tutoria;

  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{s.asignatura.nombre}</h3>
        <Badge estado={estado} />
      </div>
      <p className="text-xs text-texto-suave">Enviada: {fechaLarga(s.fecha_solicitud)}</p>

      <div className="flex items-center gap-3 rounded-lg bg-fondo px-3 py-2">
        <Iniciales nombre={s.tutor.nombre_completo} className="size-8 text-xs" />
        <div>
          <p className="text-[11px] text-texto-suave">Tutor solicitado</p>
          <p className="text-sm font-medium">{s.tutor.nombre_completo}</p>
        </div>
      </div>

      <p className="text-sm"><span className="text-texto-suave">Horario: </span>{textoFranja(t?.franja ?? s.franja)}</p>

      {s.estado === 'Rechazada' && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-texto-suave italic">
          Motivo: {s.motivo_rechazo || 'El tutor no indicó un motivo.'}
        </p>
      )}
      {t?.estado === 'Cancelada' && (
        <p className="rounded-lg bg-peligro-suave/60 p-3 text-sm text-peligro">Motivo de cancelación: {t.motivo_cancelacion}</p>
      )}
      {t?.reprogramacion_pendiente && (
        <div className="rounded-lg border border-borde bg-slate-50 p-3 text-sm">
          <p className="font-medium text-primario-oscuro">Nueva fecha propuesta:</p>
          <p>{textoFranja(t.reprogramacion_pendiente.franja_propuesta)}</p>
          <p className="mt-1 text-xs text-texto-suave">Motivo: {t.reprogramacion_pendiente.motivo}</p>
        </div>
      )}

      <div className="mt-auto border-t border-borde pt-3">
        {s.estado === 'Pendiente' && (
          <p className="flex items-center gap-2 text-sm text-texto-suave"><Clock size={16} /> En revisión por el tutor</p>
        )}
        {s.estado === 'Rechazada' && (
          <Link to={`/estudiante/nueva-solicitud?asignatura=${s.asignatura.id_asignatura}`}>
            <Boton variante="peligro-borde" className="w-full"><XCircle size={16} /> Buscar otro tutor</Boton>
          </Link>
        )}
        {t?.reprogramacion_pendiente ? (
          <div className="grid grid-cols-2 gap-3">
            <Boton variante="exito" onClick={() => onResponder('aceptar')}>Aceptar</Boton>
            <Boton variante="peligro" onClick={() => onResponder('rechazar')}>Rechazar</Boton>
          </div>
        ) : t && (
          <Link to={`/estudiante/tutorias/${t.id_tutoria}`}><Boton className="w-full">Ver Detalle</Boton></Link>
        )}
      </div>
    </Tarjeta>
  );
}
