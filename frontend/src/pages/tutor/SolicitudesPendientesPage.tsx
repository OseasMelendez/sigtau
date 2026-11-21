import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paperclip, BookOpen, CalendarCheck, CalendarDays, CalendarRange, Check, Clock, HelpCircle, Info, MapPin, X } from 'lucide-react';
import { solicitudes } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { duracion, fechaConDia, haceCuanto, textoFranja } from '../../lib/fechas';
import { Alerta, Boton, Campo, Cargando, Dato, Modal, Tarjeta, Vacio, claseInput } from '../../components/ui';
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
    `rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${activo ? 'bg-primario-suave text-primario-oscuro' : 'bg-campo text-texto-suave hover:bg-borde'}`;
  const botonChico = '!rounded-md !px-3 !py-1.5 text-xs font-medium';

  return (
    <div className="max-w-5xl">
      {/* Figma 25:58: los filtros van a la derecha del título */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis Solicitudes Pendientes</h1>
          <p className="mt-1 text-sm text-texto-suave">Revisa y gestiona las solicitudes de tutoría de los estudiantes.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button className={chip(!filtro)} onClick={() => setFiltro(0)}>Todas ({datos.length})</button>
            {asignaturas.map((a) => (
              <button key={a.id_asignatura} className={chip(filtro === a.id_asignatura)} onClick={() => setFiltro(a.id_asignatura)}>
                {a.nombre} ({datos.filter((s) => s.asignatura.id_asignatura === a.id_asignatura).length})
              </button>
            ))}
          </div>
          <Link to="/tutor/programacion" className="flex items-center gap-1.5 text-xs font-semibold text-primario hover:underline">
            <CalendarRange size={14} /> Ver en calendario
          </Link>
        </div>
      </div>

      {lista.length === 0 ? <Vacio texto="No tienes solicitudes pendientes. ¡Todo al día!" /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {lista.map((s) => (
            <Tarjeta key={s.id_solicitud} className="flex flex-col !rounded-xl !p-4">
              <div className="flex items-center gap-3 border-b border-borde pb-3">
                <Iniciales id={s.estudiante.id_usuario} nombre={s.estudiante.nombre_completo} className="size-10 text-sm" />
                <div className="min-w-0">
                  <p className="font-medium">{s.estudiante.nombre_completo}</p>
                  <p className="flex items-center gap-1 text-[11px] text-texto-suave">
                    <Clock size={11} className="shrink-0" /> <span className="truncate">{haceCuanto(s.fecha_solicitud)} · {s.estudiante.carrera}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3.5 py-4">
                <Dato icono={<BookOpen size={14} />} etiqueta="Materia"><span className="font-semibold">{s.asignatura.nombre}</span></Dato>
                <Dato icono={<CalendarDays size={14} />} etiqueta="Horario seleccionado">
                  <span className="text-xs font-normal">{textoFranja(s.franja)}</span>
                </Dato>
                <Dato icono={<HelpCircle size={14} />} etiqueta="Dificultad declarada">
                  <span className="text-xs font-normal">{s.descripcion_dificultad}</span>
                  {s.tiene_documento && <><br /><a href={solicitudes.urlDocumento(s.id_solicitud)} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primario hover:underline"><Paperclip size={12} /> Ver documento de apoyo</a></>}
                </Dato>
              </div>
              <div className="mt-auto flex items-center gap-2 border-t border-borde pt-3">
                <p className="flex max-w-28 flex-1 items-center gap-1.5 text-[10px] leading-tight text-texto-suave"><Info size={13} className="shrink-0" /> Registra fecha y hora de la acción</p>
                <div className="ml-auto flex gap-2">
                  <Boton variante="peligro-borde" className={botonChico} onClick={() => setRechazar(s)}><X size={14} /> Rechazar</Boton>
                  <Boton className={botonChico} onClick={() => setAprobar(s)}><Check size={14} /> Aprobar</Boton>
                </div>
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
    <Modal abierto titulo="Aprobar solicitud" onCerrar={cerrar} ancho="max-w-md"
      claseCabecera="bg-fondo-tutor !py-3.5 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-primario-oscuro"
      pie={<>
        <Boton variante="secundario" className="!rounded-md !border-primario/60 !py-1.5 text-xs font-medium" onClick={cerrar}>Cancelar</Boton>
        <Boton cargando={enviando} className="!rounded-md !py-1.5 text-xs font-medium" onClick={confirmar}>Aprobar y confirmar</Boton>
      </>}>
      {/* Figma 276:4 */}
      <div className="rounded-xl border border-primario/30 bg-fondo-tutor p-3.5">
        <div className="flex items-center gap-3">
          <Iniciales id={s.estudiante.id_usuario} nombre={s.estudiante.nombre_completo} className="size-10 text-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{s.estudiante.nombre_completo}</p>
              <span className="rounded-full bg-primario px-2.5 py-0.5 text-[10px] text-white">Por Confirmar</span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-texto-suave"><BookOpen size={12} /> {s.asignatura.nombre}</p>
            <p className="flex items-center gap-1.5 text-xs text-texto-suave"><Clock size={12} /> Duración: {duracion(s.franja.hora_inicio, s.franja.hora_fin)}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-borde pt-3 text-xs text-texto-suave italic">"{s.descripcion_dificultad}"</p>
      </div>

      <p className="mt-4 mb-1.5 text-xs font-medium">Horario Solicitado</p>
      <div className="flex items-center gap-3 rounded-lg border border-borde bg-campo/60 px-4 py-3 text-sm" aria-readonly>
        <CalendarCheck size={18} className="shrink-0 text-primario" />
        <div>
          <p>{fechaConDia(s.franja.fecha)}</p>
          <p className="text-texto-suave">{s.franja.hora_inicio} – {s.franja.hora_fin}</p>
        </div>
      </div>

      <p className="mt-4 mb-1.5 text-xs font-medium">Modalidad</p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-campo px-3 py-1.5 text-xs"><MapPin size={13} /> Presencial</span>

      <div className="mt-4 [&_label]:text-xs [&_label]:font-medium">
        <Campo etiqueta="Lugar" htmlFor="lugar" error={error && !lugar.trim() ? error : undefined}>
          <input id="lugar" className={`${claseInput} border-borde bg-campo/60!`} maxLength={100} placeholder="Ej: Aula 21, Edificio de Ingeniería" autoFocus
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
    <Modal abierto titulo="Rechazar solicitud" onCerrar={cerrar} ancho="max-w-md"
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
