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
    <Modal abierto titulo="Cancelar Tutoría" icono={<XCircle size={20} className="text-peligro" />} onCerrar={cerrar} ancho="max-w-sm"
      claseCabecera="border-b-0 !pb-1 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-peligro">
      {/* Figma 87:2668 */}
      <div className="rounded-lg bg-fondo-tutor p-3 text-xs">
        <p className="text-sm font-medium">{t.estudiante.nombre_completo}</p>
        <p className="text-texto-suave">{t.asignatura.nombre}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-texto-suave"><CalendarDays size={13} /> {textoFranja(t.franja)}</p>
      </div>
      <div className="mt-4 [&_label]:text-xs [&_label]:font-medium">
        {/* CP-04: sin motivo el botón queda deshabilitado y se muestra este texto exacto */}
        <Campo etiqueta="Motivo de cancelación" htmlFor="motivo-cancelacion" derecha={`${motivo.length}/255`}
          ayuda={!motivo.trim() ? 'Indica el motivo para continuar' : undefined}>
          <textarea id="motivo-cancelacion" rows={3} maxLength={255} className={`${claseInput} resize-none bg-campo!`} autoFocus
            placeholder="Escribe el motivo aquí…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>
      {error && <div className="mt-3"><Alerta>{error}</Alerta></div>}
      <Boton variante="peligro" className="mt-4 w-full !rounded-md !py-2 text-xs font-medium" disabled={!motivo.trim()} cargando={enviando} onClick={confirmar}>
        Confirmar cancelación
      </Boton>
      <button onClick={cerrar} className="mt-2 w-full py-1 text-xs text-texto-suave hover:text-texto">Volver</button>
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
    <Modal abierto titulo="Reprogramar Tutoría" onCerrar={cerrar} ancho="max-w-md"
      claseCabecera="bg-fondo-tutor !py-3.5 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-primario-oscuro"
      pie={<>
        <Boton variante="secundario" className="!rounded-md !border-primario/60 !py-1.5 text-xs font-medium" onClick={cerrar}>Cancelar</Boton>
        <Boton cargando={enviando} className="!rounded-md !py-1.5 text-xs font-medium" onClick={confirmar}>Confirmar reprogramación</Boton>
      </>}>
      {/* Figma 87:2303 */}
      <div className="rounded-lg border border-borde bg-fondo-tutor p-3.5 text-xs">
        <p className="mb-2.5 text-[10px] tracking-wide text-texto-suave uppercase">Detalles actuales</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <User size={14} className="mt-0.5 text-primario" />
            <div><p className="text-[10px] text-texto-suave">Estudiante</p><p className="font-medium">{t.estudiante.nombre_completo}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <BookOpen size={14} className="mt-0.5 text-primario" />
            <div><p className="text-[10px] text-texto-suave">Asignatura</p><p className="font-medium">{t.asignatura.nombre}</p></div>
          </div>
        </div>
        <div className="mt-2.5 flex items-start gap-2 text-peligro">
          <CalendarX size={14} className="mt-0.5" />
          <div><p className="text-[10px]">Horario actual</p><p className="line-through">{textoFranja(t.franja)}</p></div>
        </div>
      </div>

      <p className="mt-4 mb-2 text-xs font-medium text-primario-oscuro">Seleccionar Nuevo Horario</p>
      <div className="[&_label]:text-xs [&_label]:font-medium">
        <Campo etiqueta="Fecha" htmlFor="fecha-reprog">
          <input id="fecha-reprog" type="date" min={hoyISO()} className={`${claseInput} !py-2 bg-campo!`} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
      </div>

      {/* Figma 87:2303: fecha sin año entre paréntesis, p. ej. "(Viernes, 20 de noviembre)" */}
      <p className="mt-4 mb-2 text-xs font-medium">
        Horarios Disponibles {fecha && <span className="font-normal text-texto-suave">({fechaConDia(fecha).split(' de 20')[0]})</span>}
      </p>
      {franjas === null ? <p className="text-xs text-texto-suave">Cargando…</p> : franjas.length === 0 ? (
        <p className="text-xs text-texto-suave">
          No tienes franjas disponibles ese día. <Link to="/tutor/horarios" className="font-semibold text-primario hover:underline">Agregar en Gestionar Horarios</Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {franjas.map((f) => (
            <button key={f.id_horario} onClick={() => setElegida(f.id_horario)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${elegida === f.id_horario ? 'bg-primario-oscuro text-white' : 'bg-campo hover:bg-primario-suave'}`}>
              {f.hora_inicio} – {f.hora_fin}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 [&_label]:text-xs [&_label]:font-medium">
        <Campo etiqueta="Motivo de reprogramación (Obligatorio)" htmlFor="motivo-reprog" derecha={`${motivo.length}/255`}>
          <textarea id="motivo-reprog" rows={3} maxLength={255} className={`${claseInput} resize-none bg-campo!`}
            placeholder="Indique la razón del cambio…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>
      {error && <div className="mt-3"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}
