import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { horarios } from '../../services';
import { mensajeError } from '../../lib/hooks';
import { fechaConDia, hoyISO, lunesDe, sumarDias } from '../../lib/fechas';
import { Alerta, Boton, Campo, Encabezado, Modal, Tarjeta, claseInput } from '../../components/ui';
import { SemanaFranjas } from '../../components/SemanaFranjas';
import { useToast } from '../../components/Toast';
import type { Franja } from '../../types';

interface Form { fecha: string; hora_inicio: string; hora_fin: string }

/** 8.2.9 Gestionar horarios (Figma 82:804). RF-05, RF-06 */
export function GestionarHorariosPage() {
  const [lunes, setLunes] = useState(lunesDe(hoyISO()));
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<Franja | 'nueva' | null>(null);

  const cargar = useCallback(() => {
    horarios.mios(lunes, sumarDias(lunes, 6)).then(setFranjas).catch((e) => setError(mensajeError(e)));
  }, [lunes]);
  useEffect(cargar, [cargar]);

  const disponibles = franjas.filter((f) => f.estado === 'Disponible').length;

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Gestionar Horarios" subtitulo="Administra tu disponibilidad semanal y gestiona tus franjas horarias.">
        <Boton onClick={() => setEditando('nueva')}><Plus size={16} /> Nueva franja</Boton>
      </Encabezado>
      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}

      <Tarjeta>
        <p className="mb-2 text-sm text-texto-suave">
          {franjas.length} franjas esta semana · {disponibles} disponibles · {franjas.length - disponibles} con tutoría agendada.
          Haz clic en una franja disponible para editarla o eliminarla.
        </p>
        <SemanaFranjas lunes={lunes} onCambiarSemana={setLunes} franjas={franjas} onElegir={(f) => setEditando(f)}
          deshabilitar={(f) => f.estado === 'Ocupado' || f.fecha < hoyISO()} />
      </Tarjeta>

      {editando && (
        <ModalFranja franja={editando === 'nueva' ? null : editando} fechaInicial={lunes < hoyISO() ? hoyISO() : lunes}
          onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); cargar(); }} />
      )}
    </div>
  );
}

function ModalFranja({ franja, fechaInicial, onCerrar, onListo }: {
  franja: Franja | null; fechaInicial: string; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState<Form>(
    franja ? { fecha: franja.fecha, hora_inicio: franja.hora_inicio, hora_fin: franja.hora_fin }
      : { fecha: fechaInicial, hora_inicio: '08:00', hora_fin: '09:00' },
  );
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState<'guardar' | 'eliminar' | null>(null);
  const avisar = useToast();

  const validar = () => {
    if (!form.fecha || !form.hora_inicio || !form.hora_fin) return 'Completa la fecha y las horas';
    if (form.fecha < hoyISO()) return 'La fecha no puede ser anterior a hoy';
    if (form.hora_fin <= form.hora_inicio) return 'La hora de fin debe ser posterior a la hora de inicio.';
    return '';
  };

  const guardar = async () => {
    const v = validar();
    if (v) return setError(v);
    setEnviando('guardar');
    setError('');
    try {
      if (franja) await horarios.editar(franja.id_horario, form);
      else await horarios.crear(form);
      avisar(franja ? 'Franja actualizada.' : 'Franja registrada.');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(null);
    }
  };

  const eliminar = async () => {
    if (!franja || !confirm('¿Eliminar esta franja?')) return;
    setEnviando('eliminar');
    try {
      await horarios.eliminar(franja.id_horario);
      avisar('Franja eliminada.');
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Modal abierto titulo={franja ? 'Editar franja' : 'Nueva franja'} onCerrar={onCerrar} ancho="max-w-sm"
      pie={<>
        {franja && <Boton variante="peligro-borde" className="mr-auto" cargando={enviando === 'eliminar'} onClick={eliminar}><Trash2 size={15} /> Eliminar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton cargando={enviando === 'guardar'} onClick={guardar}>Guardar</Boton>
      </>}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Fecha" htmlFor="f-fecha" ayuda={form.fecha ? fechaConDia(form.fecha) : undefined}>
          <input id="f-fecha" type="date" min={hoyISO()} className={claseInput} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Hora de inicio" htmlFor="f-inicio">
            <input id="f-inicio" type="time" step={900} className={claseInput} value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
          </Campo>
          <Campo etiqueta="Hora de fin" htmlFor="f-fin">
            <input id="f-fin" type="time" step={900} className={claseInput} value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} />
          </Campo>
        </div>
        {error && <Alerta>{error}</Alerta>}
      </div>
    </Modal>
  );
}
