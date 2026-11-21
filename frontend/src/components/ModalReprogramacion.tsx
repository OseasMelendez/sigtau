import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { reprogramaciones } from '../services';
import { mensajeError } from '../lib/hooks';
import { textoFranja } from '../lib/fechas';
import { Alerta, Boton, Modal } from './ui';
import { useToast } from './Toast';
import type { Reprogramacion } from '../types';

/**
 * Confirmar o rechazar la reprogramación propuesta por el tutor (Figma 87:1932). RF-14
 * Al aceptar, el disparador cambia el horario de la tutoría y libera la franja anterior.
 */
export function ModalReprogramacion({
  reprogramacion, asignatura, tutor, accion, onCerrar, onListo,
}: {
  reprogramacion: Reprogramacion | null;
  asignatura: string;
  tutor: string;
  accion: 'aceptar' | 'rechazar';
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const avisar = useToast();
  if (!reprogramacion) return null;

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      if (accion === 'aceptar') await reprogramaciones.aceptar(reprogramacion.id_reprogramacion);
      else await reprogramaciones.rechazar(reprogramacion.id_reprogramacion);
      avisar(accion === 'aceptar' ? 'Reprogramación aceptada. Tu tutoría cambió de horario.' : 'Reprogramación rechazada. Se mantiene el horario original.');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto titulo={accion === 'aceptar' ? 'Confirmar Reprogramación' : 'Rechazar Reprogramación'}
      icono={<CalendarClock size={20} className="text-amber-500" />} onCerrar={onCerrar} ancho="max-w-md"
      pie={<div className="flex w-full gap-3">
        {/* Figma 87:1932: Confirmar a la izquierda, ambos del mismo ancho */}
        <Boton variante={accion === 'aceptar' ? 'primario' : 'peligro'} cargando={enviando} onClick={confirmar}
          className={`flex-1 !rounded-md font-medium ${accion === 'aceptar' ? '!bg-primario-oscuro hover:!bg-primario' : ''}`}>
          {accion === 'aceptar' ? 'Confirmar' : 'Rechazar propuesta'}
        </Boton>
        <Boton variante="secundario" onClick={onCerrar} className="flex-1 !rounded-md font-medium !text-texto-suave">Cancelar</Boton>
      </div>}>
      <div className="rounded-lg bg-fondo-tutor p-4 text-[13px]">
        <p className="flex justify-between gap-4"><span className="text-texto-suave">Asignatura:</span> <b className="font-semibold">{asignatura}</b></p>
        <p className="mt-2 flex justify-between gap-4"><span className="text-texto-suave">Tutor:</span> <b className="font-semibold">{tutor}</b></p>
        <p className="mt-2 flex justify-between gap-4"><span className="text-texto-suave">Motivo:</span> <span className="text-right">{reprogramacion.motivo}</span></p>
        <div className="mt-3 border-t border-borde pt-3">
          <p className="text-texto-suave">Nueva fecha propuesta:</p>
          <p className="mt-0.5 font-semibold text-primario-oscuro">{textoFranja(reprogramacion.franja_propuesta)}</p>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-texto-suave">
        {accion === 'aceptar'
          ? '¿Estás de acuerdo con la nueva fecha y hora propuesta por el tutor?'
          : '¿Rechazar la propuesta? La tutoría se mantendrá en su horario original.'}
      </p>
      {error && <div className="mt-3"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}
