import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, CalendarX, User, XCircle } from 'lucide-react';
import { horarios, tutorias } from '../../services';
import { mensajeError } from '../../lib/hooks';
import { fechaConDia, horaActual, hoyISO, textoFranja } from '../../lib/fechas';
import { Alerta, Boton, Campo, Modal, claseInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import type { Franja, Tutoria } from '../../types';

/** Modal "Cancelar tutoría" (Figma 87:2668). RF-13 / CP-04: sin motivo, el botón queda deshabilitado. */
export function ModalCancelar({ tutoria: t, onCerrar, onListo }: { tutoria: Tutoria | null; onCerrar: () => void; onListo: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const avisar = useToast();
  if (!t) return null;

  const cerrar = () => { setMotivo(''); setError(''); onCerrar(); };
  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      await tutorias.cancelar(t.id_tutoria, motivo.trim());
      avisar('Tutoría cancelada. La franja quedó disponible otra vez.');
      setMotivo('');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto titulo="Cancelar Tutoría" icono={<XCircle size={22} className="text-peligro" />} onCerrar={cerrar} ancho="max-w-md">
      <div className="rounded-xl border border-borde bg-fondo p-4 text-sm">
        <p className="font-medium">{t.estudiante.nombre_completo}</p>
        <p className="text-texto-suave">{t.asignatura.nombre}</p>
        <p className="mt-1 flex items-center gap-1.5"><CalendarDays size={14} /> {textoFranja(t.franja)}</p>
      </div>
      <div className="mt-5">
        <Campo etiqueta="Motivo de cancelación" htmlFor="motivo-cancelacion" derecha={`${motivo.length}/255`}
          ayuda={!motivo.trim() ? 'Indica el motivo para continuar' : undefined}>
          <textarea id="motivo-cancelacion" rows={3} maxLength={255} className={`${claseInput} resize-none`} autoFocus
            placeholder="Escribe el motivo aquí…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>
      {error && <div className="mt-3"><Alerta>{error}</Alerta></div>}
      <Boton variante="peligro" className="mt-5 w-full" disabled={!motivo.trim()} cargando={enviando} onClick={confirmar}>
        Confirmar cancelación
      </Boton>
      <button onClick={cerrar} className="mt-3 w-full text-sm text-texto-suave hover:text-texto">Volver</button>
    </Modal>
  );
}

/**
 * Modal "Reprogramar tutoría" (Figma 87:2303). RF-14
 * El tutor elige una fecha y una de SUS franjas Disponibles de ese día; el estudiante
 * debe aceptar la propuesta para que el horario cambie.
 */
export function ModalReprogramar({ tutoria: t, onCerrar, onListo }: { tutoria: Tutoria | null; onCerrar: () => void; onListo: () => void }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [franjas, setFranjas] = useState<Franja[] | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const avisar = useToast();

  useEffect(() => {
    if (!t || !fecha) return;
    setFranjas(null);
    setElegida(null);
    horarios.mios(fecha, fecha).then((fs) => {
      const ahora = horaActual();
      setFranjas(fs.filter((f) => f.estado === 'Disponible' && f.id_horario !== t.franja.id_horario &&
        !(f.fecha === hoyISO() && f.hora_inicio <= ahora)));
    }).catch((e) => setError(mensajeError(e)));
  }, [t, fecha]);

  if (!t) return null;
  const cerrar = () => { setMotivo(''); setError(''); setElegida(null); onCerrar(); };

  const confirmar = async () => {
    if (!elegida) return setError('Selecciona un nuevo horario');
    if (!motivo.trim()) return setError('Indica el motivo de la reprogramación');
    setEnviando(true);
    setError('');
    try {
      await tutorias.reprogramar(t.id_tutoria, elegida, motivo.trim());
      avisar('Propuesta enviada. El estudiante debe aceptarla.');
      setMotivo('');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto titulo="Reprogramar Tutoría" onCerrar={cerrar}
      pie={<><Boton variante="secundario" onClick={cerrar}>Cancelar</Boton><Boton cargando={enviando} onClick={confirmar}>Confirmar reprogramación</Boton></>}>
      <div className="rounded-xl border border-borde bg-fondo p-4 text-sm">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">Detalles actuales</p>
        <div className="grid grid-cols-2 gap-3">
          <p className="flex items-center gap-2"><User size={15} className="text-primario" /> {t.estudiante.nombre_completo}</p>
          <p className="flex items-center gap-2"><BookOpen size={15} className="text-primario" /> {t.asignatura.nombre}</p>
        </div>
        <p className="mt-2 flex items-center gap-2 text-peligro"><CalendarX size={15} /> <span className="line-through">{textoFranja(t.franja)}</span></p>
      </div>

      <p className="mt-5 mb-3 font-semibold text-primario-oscuro">Seleccionar nuevo horario</p>
      <Campo etiqueta="Fecha" htmlFor="fecha-reprog">
        <input id="fecha-reprog" type="date" min={hoyISO()} className={claseInput} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>

      <p className="mt-4 mb-2 text-sm font-semibold">Horarios disponibles {fecha && `(${fechaConDia(fecha)})`}</p>
      {franjas === null ? <p className="text-sm text-texto-suave">Cargando…</p> : franjas.length === 0 ? (
        <p className="text-sm text-texto-suave">
          No tienes franjas disponibles ese día. <Link to="/tutor/horarios" className="font-semibold text-primario hover:underline">Agregar en Gestionar Horarios</Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {franjas.map((f) => (
            <button key={f.id_horario} onClick={() => setElegida(f.id_horario)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${elegida === f.id_horario ? 'bg-primario-oscuro text-white' : 'bg-slate-100 hover:bg-primario-suave'}`}>
              {f.hora_inicio} – {f.hora_fin}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Campo etiqueta="Motivo de reprogramación" htmlFor="motivo-reprog" derecha={`${motivo.length}/255`}>
          <textarea id="motivo-reprog" rows={3} maxLength={255} className={`${claseInput} resize-none`}
            placeholder="Indique la razón del cambio…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>
      {error && <div className="mt-3"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}
