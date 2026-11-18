import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, Eye, MapPin, Minus, Save, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { tutorias } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { textoFranja, yaOcurrio } from '../../lib/fechas';
import { Alerta, Badge, Boton, Campo, Cargando, Encabezado, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import { ModalCancelar, ModalReprogramar } from './ModalesTutoria';
import type { EstadoTutoria, NivelProgreso, Tutoria } from '../../types';

/** 8.2.8 Mis tutorías y seguimiento académico (Figma 26:330). RF-08, RF-13, RF-14 */
export function MisTutoriasPage() {
  const { datos, cargando, error, recargar } = useCarga(() => tutorias.mias(), []);
  const [filtro, setFiltro] = useState<EstadoTutoria | ''>('Programada');
  const [idSel, setIdSel] = useState<number | null>(null);
  const [cancelar, setCancelar] = useState<Tutoria | null>(null);
  const [reprogramar, setReprogramar] = useState<Tutoria | null>(null);

  const lista = useMemo(() => (datos ?? [])
    .filter((t) => !filtro || t.estado === filtro)
    .sort((a, b) => {
      const k = (t: Tutoria) => t.franja.fecha + t.franja.hora_inicio;
      return filtro === 'Programada' ? k(a).localeCompare(k(b)) : k(b).localeCompare(k(a));
    }), [datos, filtro]);

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;

  const sel = lista.find((t) => t.id_tutoria === idSel) ?? lista[0];
  const listo = () => { setCancelar(null); setReprogramar(null); recargar(); };
  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold ${activo ? 'border-primario bg-primario-suave text-primario-oscuro' : 'border-borde bg-white text-texto-suave hover:bg-fondo'}`;

  return (
    <div>
      <Encabezado titulo="Tutorías Programadas y Realizadas" subtitulo="Registra el seguimiento de cada sesión, reprograma o cancela tus tutorías." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(['Programada', 'Realizada', 'Cancelada', ''] as const).map((e) => (
              <button key={e || 'todas'} className={chip(filtro === e)} onClick={() => { setFiltro(e); setIdSel(null); }}>
                {e ? `${e}s` : 'Todas'} ({e ? datos.filter((t) => t.estado === e).length : datos.length})
              </button>
            ))}
          </div>

          {lista.length === 0 ? <Vacio texto="No hay tutorías en esta categoría." /> : (
            <div className="flex flex-col gap-3">
              {lista.map((t) => {
                const activa = t.id_tutoria === sel?.id_tutoria;
                return (
                  <div key={t.id_tutoria} onClick={() => setIdSel(t.id_tutoria)}
                    className={`cursor-pointer rounded-2xl border bg-white p-4 transition-colors ${activa ? 'border-primario-oscuro ring-1 ring-primario-oscuro' : 'border-borde hover:bg-fondo'}`}>
                    <div className="flex items-start gap-3">
                      <Iniciales nombre={t.estudiante.nombre_completo} className="size-10 text-sm" />
                      <div className="flex-1">
                        <p className="font-medium">{t.estudiante.nombre_completo}</p>
                        <p className="text-sm text-texto-suave">{t.asignatura.nombre}</p>
                      </div>
                      <Badge estado={t.reprogramacion_pendiente ? 'Reprogramación pendiente' : t.estado} />
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-sm"><CalendarDays size={14} /> {textoFranja(t.franja)}</p>
                    {t.lugar && <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-suave"><MapPin size={14} /> {t.lugar}</p>}
                    {activa && t.estado === 'Programada' && (
                      <div className="mt-3 flex justify-end gap-4 border-t border-borde pt-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/tutor/tutorias/${t.id_tutoria}`} className="flex items-center gap-1 text-texto-suave hover:text-primario"><Eye size={15} /> Ver detalle</Link>
                        {!t.reprogramacion_pendiente && (
                          <button onClick={() => setReprogramar(t)} className="flex items-center gap-1 text-texto-suave hover:text-primario"><CalendarClock size={15} /> Reprogramar</button>
                        )}
                        <button onClick={() => setCancelar(t)} className="flex items-center gap-1 text-peligro hover:underline"><XCircle size={15} /> Cancelar tutoría</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {sel && <PanelSeguimiento key={sel.id_tutoria} t={sel} onGuardado={recargar} />}
      </div>

      <ModalCancelar tutoria={cancelar} onCerrar={() => setCancelar(null)} onListo={listo} />
      <ModalReprogramar tutoria={reprogramar} onCerrar={() => setReprogramar(null)} onListo={listo} />
    </div>
  );
}

const NIVELES: { valor: NivelProgreso; icono: React.ReactNode }[] = [
  { valor: 'Bajo', icono: <TrendingDown size={16} /> },
  { valor: 'Medio', icono: <Minus size={16} /> },
  { valor: 'Avanzado', icono: <TrendingUp size={16} /> },
];

/** Formulario de seguimiento (RF-08). CP-05: solo en tutorías que ya ocurrieron. */
function PanelSeguimiento({ t, onGuardado }: { t: Tutoria; onGuardado: () => void }) {
  const [asistio, setAsistio] = useState(true);
  const [nivel, setNivel] = useState<NivelProgreso | null>(null);
  const [obs, setObs] = useState('');
  const [errores, setErrores] = useState<{ nivel?: string; obs?: string }>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const avisar = useToast();

  const ocurrio = yaOcurrio(t.franja);
  const editable = t.estado === 'Programada' && ocurrio;
  const s = t.seguimiento;

  const guardar = async () => {
    const err: typeof errores = {};
    if (asistio && !nivel) err.nivel = 'Selecciona el nivel de progreso';
    if (!obs.trim()) err.obs = 'Las observaciones son obligatorias';
    setErrores(err);
    if (Object.keys(err).length) return;
    setEnviando(true);
    setError('');
    try {
      await tutorias.seguimiento(t.id_tutoria, { asistio, nivel_progreso: asistio ? nivel! : undefined, observaciones: obs.trim() });
      avisar('Seguimiento guardado. La tutoría pasó a Realizada.');
      onGuardado();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const opcion = (activo: boolean) =>
    `flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 text-sm font-medium transition-colors disabled:opacity-50 ${activo ? 'border-primario bg-primario-suave text-primario-oscuro' : 'border-borde hover:bg-fondo'}`;

  return (
    <div className="rounded-3xl border border-borde bg-white p-6 shadow-sm lg:sticky lg:top-24">
      <h2 className="border-b border-borde pb-4 text-xl font-semibold">Seguimiento de Sesión – {t.estudiante.nombre_completo}</h2>

      {t.estado === 'Cancelada' && <div className="mt-5"><Alerta>Tutoría cancelada. Motivo: {t.motivo_cancelacion}</Alerta></div>}

      {t.estado === 'Realizada' && s && (
        <div className="mt-5 flex flex-col gap-4 text-sm">
          <p><span className="text-texto-suave">Asistencia:</span> <b>{s.asistio ? 'Asistió' : 'No asistió'}</b></p>
          <p><span className="text-texto-suave">Nivel de progreso:</span> <b>{s.nivel_progreso ?? '—'}</b></p>
          <p className="rounded-lg bg-primario-suave/50 p-4 text-primario-oscuro">"{s.observaciones}"</p>
        </div>
      )}

      {t.estado === 'Programada' && (
        <fieldset disabled={!editable} className="mt-5 flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Asistencia</p>
            <div className="inline-flex rounded-xl border border-borde p-1">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => { setAsistio(v); if (!v) setNivel(null); }}
                  className={`rounded-lg px-5 py-1.5 text-sm font-medium ${asistio === v ? 'bg-primario text-white' : 'text-texto-suave'}`}>
                  {v ? 'Asistió' : 'No asistió'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Nivel de progreso del estudiante</p>
            <div className="flex gap-3">
              {NIVELES.map((n) => (
                <button key={n.valor} type="button" disabled={!asistio} onClick={() => setNivel(n.valor)} className={opcion(nivel === n.valor)}>
                  {n.icono} {n.valor}
                </button>
              ))}
            </div>
            {errores.nivel && <p className="mt-1 text-xs text-peligro">{errores.nivel}</p>}
          </div>

          <Campo etiqueta="Observaciones de la sesión" htmlFor="obs" error={errores.obs}>
            <textarea id="obs" rows={4} className={`${claseInput} resize-none bg-fondo`} value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Detalle los temas cubiertos, dificultades observadas y próximos pasos…" aria-invalid={!!errores.obs} />
          </Campo>

          <Alerta tipo="info">
            {ocurrio
              ? <>Al guardar, el estado de la tutoría cambiará automáticamente a <b>Realizada</b>.</>
              : 'Solo se puede registrar seguimiento de tutorías ya realizadas'}
          </Alerta>
          {error && <Alerta>{error}</Alerta>}

          <div className="flex justify-end">
            <Boton cargando={enviando} onClick={guardar}><Save size={16} /> Guardar seguimiento</Boton>
          </div>
        </fieldset>
      )}
    </div>
  );
}
