import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarCheck, CalendarDays, CalendarRange, Check, Clock, HelpCircle, Info, MapPin, X } from 'lucide-react';
import { solicitudes } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { duracion, haceCuanto, textoFranja } from '../../lib/fechas';
import { Alerta, Boton, Campo, Cargando, Dato, Encabezado, Modal, Tarjeta, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import type { SolicitudTutor } from '../../types';

/** 8.2.6 Solicitudes pendientes del tutor (Figma 25:58). RF-04, RF-07 */
export function SolicitudesPendientesPage() {
  const { datos, cargando, error, recargar } = useCarga(() => solicitudes.pendientes(), []);
  const [filtro, setFiltro] = useState(0);
  const [aprobar, setAprobar] = useState<SolicitudTutor | null>(null);
  const [rechazar, setRechazar] = useState<SolicitudTutor | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;

  const asignaturas = [...new Map(datos.map((s) => [s.asignatura.id_asignatura, s.asignatura])).values()];
  const lista = filtro ? datos.filter((s) => s.asignatura.id_asignatura === filtro) : datos;
  const chip = (activo: boolean) =>
    `rounded-full border px-3.5 py-1 text-xs font-semibold ${activo ? 'border-primario bg-primario-suave text-primario-oscuro' : 'border-borde bg-white text-texto-suave hover:bg-fondo'}`;

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Mis Solicitudes Pendientes" subtitulo="Revisa y gestiona las solicitudes de tutoría de los estudiantes.">
        <Link to="/tutor/programacion" className="flex items-center gap-1.5 text-sm font-semibold text-primario hover:underline">
          <CalendarRange size={16} /> Ver en calendario
        </Link>
      </Encabezado>
      <div className="-mt-2 mb-5 flex flex-wrap gap-2">
          <button className={chip(!filtro)} onClick={() => setFiltro(0)}>Todas ({datos.length})</button>
          {asignaturas.map((a) => (
            <button key={a.id_asignatura} className={chip(filtro === a.id_asignatura)} onClick={() => setFiltro(a.id_asignatura)}>
              {a.nombre} ({datos.filter((s) => s.asignatura.id_asignatura === a.id_asignatura).length})
            </button>
          ))}
      </div>

      {lista.length === 0 ? <Vacio texto="No tienes solicitudes pendientes. ¡Todo al día!" /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {lista.map((s) => (
            <Tarjeta key={s.id_solicitud} className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-borde pb-4">
                <Iniciales nombre={s.estudiante.nombre_completo} className="size-11" />
                <div>
                  <p className="text-lg font-medium">{s.estudiante.nombre_completo}</p>
                  <p className="flex items-center gap-1 text-xs text-texto-suave"><Clock size={12} /> {haceCuanto(s.fecha_solicitud)} · {s.estudiante.carrera}</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 py-4">
                <Dato icono={<BookOpen size={14} />} etiqueta="Materia">{s.asignatura.nombre}</Dato>
                <Dato icono={<CalendarDays size={14} />} etiqueta="Horario seleccionado">
                  <span className="font-normal">{textoFranja(s.franja)}</span>
                </Dato>
                <Dato icono={<HelpCircle size={14} />} etiqueta="Dificultad declarada">
                  <span className="font-normal">{s.descripcion_dificultad}</span>
                </Dato>
              </div>
              <div className="mt-auto flex items-center gap-3 border-t border-borde pt-4">
                <p className="flex flex-1 items-center gap-1.5 text-xs text-texto-suave"><Info size={14} /> Registra fecha y hora de la acción</p>
                <Boton variante="peligro-borde" onClick={() => setRechazar(s)}><X size={16} /> Rechazar</Boton>
                <Boton onClick={() => setAprobar(s)}><Check size={16} /> Aprobar</Boton>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      <ModalAprobar solicitud={aprobar} onCerrar={() => setAprobar(null)} onListo={() => { setAprobar(null); recargar(); }} />
      <ModalRechazar solicitud={rechazar} onCerrar={() => setRechazar(null)} onListo={() => { setRechazar(null); recargar(); }} />
    </div>
  );
}

/** Modal "Aprobar solicitud" (Figma 276:4). Horario en solo lectura; solo se indica el lugar (CP-03). */
export function ModalAprobar({ solicitud: s, onCerrar, onListo }: { solicitud: SolicitudTutor | null; onCerrar: () => void; onListo: () => void }) {
  const [lugar, setLugar] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const avisar = useToast();
  if (!s) return null;

  const cerrar = () => { setLugar(''); setError(''); onCerrar(); };
  const confirmar = async () => {
    if (!lugar.trim()) return setError('Indica el lugar de la tutoría');
    setEnviando(true);
    setError('');
    try {
      await solicitudes.aprobar(s.id_solicitud, lugar.trim());
      avisar('Solicitud aprobada. La tutoría quedó programada.');
      setLugar('');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto titulo="Aprobar solicitud" onCerrar={cerrar}
      pie={<><Boton variante="secundario" onClick={cerrar}>Cancelar</Boton><Boton cargando={enviando} onClick={confirmar}>Aprobar y confirmar</Boton></>}>
      <div className="rounded-xl border border-borde bg-fondo/60 p-4">
        <div className="flex items-center gap-3">
          <Iniciales nombre={s.estudiante.nombre_completo} className="size-11" />
          <div>
            <p className="font-semibold">{s.estudiante.nombre_completo}</p>
            <p className="flex items-center gap-1.5 text-sm text-texto-suave"><BookOpen size={14} /> {s.asignatura.nombre}</p>
            <p className="flex items-center gap-1.5 text-sm text-texto-suave"><Clock size={14} /> Duración: {duracion(s.franja.hora_inicio, s.franja.hora_fin)}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-borde pt-3 text-sm text-texto-suave italic">"{s.descripcion_dificultad}"</p>
      </div>

      <p className="mt-5 mb-1.5 text-sm font-semibold">Horario solicitado</p>
      <div className="flex items-center gap-3 rounded-lg border border-borde bg-fondo px-4 py-3 text-sm" aria-readonly>
        <CalendarCheck size={20} className="text-primario" /> {textoFranja(s.franja)}
      </div>

      <p className="mt-5 mb-1.5 text-sm font-semibold">Modalidad</p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm"><MapPin size={14} /> Presencial</span>

      <div className="mt-5">
        <Campo etiqueta="Lugar" htmlFor="lugar" error={error && !lugar.trim() ? error : undefined}>
          <input id="lugar" className={claseInput} maxLength={100} placeholder="Ej: Aula 21, Edificio de Ingeniería" autoFocus
            value={lugar} onChange={(e) => setLugar(e.target.value)} aria-invalid={!!error && !lugar.trim()} />
        </Campo>
      </div>
      {error && lugar.trim() && <div className="mt-3"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}

function ModalRechazar({ solicitud: s, onCerrar, onListo }: { solicitud: SolicitudTutor | null; onCerrar: () => void; onListo: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const avisar = useToast();
  if (!s) return null;

  const cerrar = () => { setMotivo(''); setError(''); onCerrar(); };
  const confirmar = async () => {
    setEnviando(true);
    try {
      await solicitudes.rechazar(s.id_solicitud, motivo.trim());
      avisar('Solicitud rechazada. Se notificó al estudiante.');
      setMotivo('');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto titulo="Rechazar solicitud" icono={<X size={20} className="text-peligro" />} onCerrar={cerrar} ancho="max-w-md"
      pie={<><Boton variante="secundario" onClick={cerrar}>Volver</Boton><Boton variante="peligro" cargando={enviando} onClick={confirmar}>Rechazar solicitud</Boton></>}>
      <p className="mb-4 text-sm">
        Vas a rechazar la solicitud de <b>{s.estudiante.nombre_completo}</b> para <b>{s.asignatura.nombre}</b>. La franja quedará libre.
      </p>
      <Campo etiqueta="Motivo del rechazo" opcional htmlFor="motivo-rechazo" derecha={`${motivo.length}/255`}>
        <textarea id="motivo-rechazo" rows={3} maxLength={255} className={`${claseInput} resize-none`} value={motivo}
          placeholder="Ej: Cupo máximo alcanzado este semestre." onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      {error && <div className="mt-3"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}
