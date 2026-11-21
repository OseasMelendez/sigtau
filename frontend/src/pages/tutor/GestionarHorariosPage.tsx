import { useCallback, useEffect, useState } from 'react';
import { Clock, Lock, Plus, Trash2 } from 'lucide-react';
import { horarios } from '../../services';
import { mensajeError } from '../../lib/hooks';
import { fechaConDia, hoyISO, lunesDe, sumarDias } from '../../lib/fechas';
import { Alerta, Boton, Campo, Modal, claseInput } from '../../components/ui';
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
  /** Fecha y hora del hueco pulsado en el calendario (prellenan la nueva franja) */
  const [hueco, setHueco] = useState<Form | null>(null);

  const cargar = useCallback(() => {
    horarios.mios(lunes, sumarDias(lunes, 6)).then(setFranjas).catch((e) => setError(mensajeError(e)));
  }, [lunes]);
  useEffect(cargar, [cargar]);

  const disponibles = franjas.filter((f) => f.estado === 'Disponible').length;

  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestionar Horarios</h1>
          <p className="mt-1 text-sm text-texto-suave">Administra tu disponibilidad semanal y gestiona tus franjas horarias.</p>
        </div>
        <Boton className="!rounded-md !py-1.5 text-xs font-medium" onClick={() => { setHueco(null); setEditando('nueva'); }}>
          <Plus size={14} /> Nueva franja
        </Boton>
      </div>
      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}

      {/* Figma 82:804 */}
      <SemanaFranjas cuadricula aspecto="calendario" leyenda={false}
        lunes={lunes} onCambiarSemana={setLunes} franjas={franjas} onElegir={(f) => setEditando(f)}
        deshabilitar={(f) => f.estado === 'Ocupado' || f.fecha < hoyISO()}
        onElegirHueco={(fecha, h) => {
          const hh = (n: number) => `${String(n).padStart(2, '0')}:00`;
          setHueco({ fecha, hora_inicio: hh(h), hora_fin: hh(Math.min(h + 1, 23)) });
          setEditando('nueva');
        }}
        estilo={(f) => f.estado === 'Ocupado' ? 'bg-primario-oscuro text-white'
          : f.fecha < hoyISO() ? 'border-l-4 border-primario/40 bg-primario-suave/50 text-primario-oscuro/60'
          : 'border-l-4 border-primario bg-primario-suave text-primario-oscuro'}
        renderContenido={(f) => {
          const hora = <span className="font-semibold">{f.hora_inicio} – {f.hora_fin}</span>;
          return f.estado === 'Ocupado' ? (
            <span className="flex size-full flex-col leading-tight">
              <span className="flex items-start justify-between gap-1">{hora}<Lock size={11} className="shrink-0" /></span>
              <span className="mt-auto text-white/80">Tutoría Agendada</span>
            </span>
          ) : (
            <span className="flex w-full flex-col leading-tight">
              <span className="flex items-center gap-1"><Clock size={10} className="shrink-0" />{hora}</span>
              <span className="mt-0.5 text-primario/70">Disponible</span>
            </span>
          );
        }} />
      <p className="mt-3 text-[11px] text-texto-suave">
        {franjas.length} franjas esta semana · {disponibles} disponibles · {franjas.length - disponibles} con tutoría agendada.
        Haz clic en una hora vacía para agregar una franja, o en una franja disponible para editarla o eliminarla.
      </p>

      {editando && (
        <ModalFranja franja={editando === 'nueva' ? null : editando}
          inicial={hueco ?? { fecha: lunes < hoyISO() ? hoyISO() : lunes, hora_inicio: '08:00', hora_fin: '09:00' }}
          onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); cargar(); }} />
      )}
    </div>
  );
}

function ModalFranja({ franja, inicial, onCerrar, onListo }: {
  franja: Franja | null; inicial: Form; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState<Form>(
    franja ? { fecha: franja.fecha, hora_inicio: franja.hora_inicio, hora_fin: franja.hora_fin } : inicial,
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
    <Modal abierto titulo={franja ? 'Editar Franja' : 'Nueva Franja'} onCerrar={onCerrar} ancho="max-w-xs"
      claseCabecera="border-b-0 !px-5 !pt-4 !pb-1 [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-primario-oscuro"
      pie={<>
        {franja && <Boton variante="peligro-borde" className="mr-auto !rounded-md !px-2.5 !py-1.5 text-xs font-medium" cargando={enviando === 'eliminar'} onClick={eliminar}><Trash2 size={13} /> Eliminar</Boton>}
        <Boton variante="fantasma" className="!rounded-md !px-3 !py-1.5 text-xs font-medium !text-texto-suave" onClick={onCerrar}>Cancelar</Boton>
        <Boton cargando={enviando === 'guardar'} className="!rounded-md !bg-primario-oscuro !px-3 !py-1.5 text-xs font-medium hover:!bg-primario" onClick={guardar}>Guardar</Boton>
      </>}>
      {/* Figma 82:804: ventana "Nueva Franja" con campos rellenos */}
      <div className="flex flex-col gap-3 [&_label]:text-xs [&_label]:font-normal">
        <Campo etiqueta="Fecha" htmlFor="f-fecha" ayuda={form.fecha ? fechaConDia(form.fecha) : undefined}>
          <input id="f-fecha" type="date" min={hoyISO()} className={`${claseInput} !py-2 bg-campo!`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta="Hora de inicio" htmlFor="f-inicio">
          <input id="f-inicio" type="time" step={900} className={`${claseInput} !py-2 bg-campo!`} value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Hora de fin" htmlFor="f-fin">
          <input id="f-fin" type="time" step={900} className={`${claseInput} !py-2 bg-campo!`} value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} />
        </Campo>
        {error && <Alerta>{error}</Alerta>}
      </div>
    </Modal>
  );
}
