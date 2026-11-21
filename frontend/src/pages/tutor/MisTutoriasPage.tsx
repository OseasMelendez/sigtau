import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, CalendarDays, Eye, Info, MapPin, Save, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { tutorias } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { yaOcurrio } from '../../lib/fechas';
import { Alerta, Badge, Boton, Campo, Cargando, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import { ModalCancelar, ModalReprogramar } from './ModalesTutoria';
import type { EstadoTutoria, NivelProgreso, Tutoria } from '../../types';

/** '15 jun 2026 · 10:00 – 11:30' (versión corta, como en el Figma) */
const fechaCorta = (t: Tutoria) => {
  const dia = new Date(`${t.franja.fecha}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  return `${dia} · ${t.franja.hora_inicio} – ${t.franja.hora_fin}`;
};

/** Colores de la etiqueta de estado en esta pantalla (Figma 26:330) */
const BADGE: Record<string, string> = {
  Programada: '!border-primario !bg-primario !text-white',
  Realizada: '',
  Cancelada: '',
  'Reprogramación pendiente': '',
};

/** 8.2.8 Mis tutorías y seguimiento académico (Figma 26:330). RF-08, RF-13, RF-14 */
export function MisTutoriasPage() {
  const { datos, cargando, error, recargar } = useCarga(() => tutorias.mias(), []);
  const [filtro, setFiltro] = useState<EstadoTutoria | ''>('Programada');
  // ?tutoria=ID abre la página con esa tutoría seleccionada (desde "Registrar seguimiento" del detalle)
  const [params] = useSearchParams();
  const [idSel, setIdSel] = useState<number | null>(Number(params.get('tutoria')) || null);
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
  const elegirFiltro = (e: EstadoTutoria | '') => { setFiltro(e); setIdSel(null); };
  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${activo ? 'bg-primario-suave text-primario-oscuro' : 'bg-campo text-texto-suave hover:bg-borde'}`;

  return (
    <div className="max-w-6xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Tutorías y Seguimiento</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Mis Tutorías</h2>
            <button onClick={() => elegirFiltro('')}
              className={`text-xs font-medium hover:underline ${filtro === '' ? 'text-texto-suave' : 'text-primario'}`}>
              Ver todas ({datos.length})
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(['Programada', 'Realizada', 'Cancelada'] as const).map((e) => (
              <button key={e} className={chip(filtro === e)} onClick={() => elegirFiltro(e)}>
                {e}s ({datos.filter((t) => t.estado === e).length})
              </button>
            ))}
          </div>

          {lista.length === 0 ? <Vacio texto="No hay tutorías en esta categoría." /> : (
            <div className="flex flex-col gap-3">
              {lista.map((t) => {
                const activa = t.id_tutoria === sel?.id_tutoria;
                const estado = t.reprogramacion_pendiente ? 'Reprogramación pendiente' : t.estado;
                return (
                  <div key={t.id_tutoria} onClick={() => setIdSel(t.id_tutoria)}
                    className={`cursor-pointer rounded-xl border bg-fondo-tutor p-4 transition-colors ${activa ? 'border-2 border-primario-oscuro' : 'border-borde hover:bg-campo/50'}`}>
                    <div className="flex items-start gap-3">
                      <Iniciales id={t.estudiante.id_usuario} nombre={t.estudiante.nombre_completo} className="size-9 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.estudiante.nombre_completo}</p>
                        <p className="text-xs text-texto-suave">{t.asignatura.nombre}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge estado={estado} className={`!px-2 !py-0 !text-[10px] ${BADGE[estado] ?? ''}`} />
                        {/* La sesión ya ocurrió y falta registrar el seguimiento */}
                        {t.estado === 'Programada' && yaOcurrio(t.franja) && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700">Seguimiento pendiente</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-texto-suave">
                      <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {fechaCorta(t)}</span>
                      {t.lugar && <span className="flex items-center gap-1.5"><MapPin size={12} /> {t.lugar}</span>}
                    </div>
                    {activa && t.estado === 'Programada' && (
                      <div className="mt-3 flex flex-wrap justify-end gap-4 border-t border-borde pt-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/tutor/tutorias/${t.id_tutoria}`} className="flex items-center gap-1 text-texto-suave hover:text-primario"><Eye size={14} /> Ver detalle</Link>
                        {!t.reprogramacion_pendiente && (
                          <button onClick={() => setReprogramar(t)} className="flex items-center gap-1 text-texto-suave hover:text-primario"><CalendarClock size={14} /> Reprogramar</button>
                        )}
                        <button onClick={() => setCancelar(t)} className="flex items-center gap-1 text-peligro hover:underline"><XCircle size={14} /> Cancelar tutoría</button>
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
  { valor: 'Medio', icono: <ArrowRight size={16} /> },
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
    `flex flex-1 flex-col items-center gap-1 rounded-lg border py-2.5 text-xs transition-colors disabled:opacity-50 ${
      activo ? 'border-primario-oscuro bg-fondo-tutor font-medium text-primario-oscuro' : 'border-borde text-texto-suave hover:bg-fondo'}`;

  return (
    <div className="rounded-2xl border border-borde bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <h2 className="border-b border-borde pb-3 text-lg font-medium">Seguimiento de Sesión – {t.estudiante.nombre_completo}</h2>

      {t.estado === 'Cancelada' && <div className="mt-5"><Alerta>Tutoría cancelada. Motivo: {t.motivo_cancelacion}</Alerta></div>}

      {/* Realizada: mismo diseño que el formulario, en solo lectura */}
      {t.estado === 'Realizada' && s && (
        <div className="mt-4 flex flex-col gap-4" aria-readonly>
          <div>
            <p className="mb-2 text-xs font-medium">Asistencia</p>
            <div className="inline-flex rounded-lg border border-borde p-1">
              {[true, false].map((v) => (
                <span key={String(v)} className={`rounded-md px-5 py-1.5 text-xs ${s.asistio === v ? 'bg-primario text-white' : 'text-texto-suave/60'}`}>
                  {v ? 'Asistió' : 'No Asistió'}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Nivel de Progreso del Estudiante</p>
            <div className="flex gap-3">
              {NIVELES.map((n) => (
                <span key={n.valor} className={`${opcion(s.nivel_progreso === n.valor)} ${s.nivel_progreso === n.valor ? '' : 'opacity-50'}`}>
                  {n.icono} {n.valor}
                </span>
              ))}
            </div>
            {!s.nivel_progreso && <p className="mt-1 text-[11px] text-texto-suave">Sin nivel: el estudiante no asistió.</p>}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Observaciones de la sesión</p>
            <p className="rounded-lg bg-campo/60 px-3 py-2.5 text-sm">{s.observaciones}</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-exito-suave/60 px-3 py-2.5 text-xs text-exito">
            <CheckCircle2 size={15} className="mt-px shrink-0" />
            <p>Seguimiento registrado. La tutoría está <b>Realizada</b>.</p>
          </div>
        </div>
      )}

      {t.estado === 'Programada' && (
        <fieldset disabled={!editable} className="mt-4 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium">Asistencia</p>
            <div className="inline-flex rounded-lg border border-borde p-1">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => { setAsistio(v); if (!v) setNivel(null); }}
                  className={`rounded-md px-5 py-1.5 text-xs ${asistio === v ? 'bg-primario text-white' : 'text-texto-suave'}`}>
                  {v ? 'Asistió' : 'No Asistió'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">Nivel de Progreso del Estudiante</p>
            <div className="flex gap-3">
              {NIVELES.map((n) => (
                <button key={n.valor} type="button" disabled={!asistio} onClick={() => setNivel(n.valor)} className={opcion(nivel === n.valor)}>
                  {n.icono} {n.valor}
                </button>
              ))}
            </div>
            {errores.nivel && <p className="mt-1 text-xs text-peligro">{errores.nivel}</p>}
          </div>

          <div className="[&_label]:text-xs [&_label]:font-medium">
            <Campo etiqueta="Observaciones de la sesión" htmlFor="obs" error={errores.obs}>
              <textarea id="obs" rows={4} className={`${claseInput} resize-none bg-campo!`} value={obs} onChange={(e) => setObs(e.target.value)}
                placeholder="Detalle los temas cubiertos, dificultades observadas y próximos pasos…" aria-invalid={!!errores.obs} />
            </Campo>
          </div>

          {/* CP-05: el texto debe quedar idéntico */}
          <div className="flex items-start gap-2 rounded-lg border border-borde bg-fondo-tutor px-3 py-2.5 text-xs text-texto-suave">
            <Info size={15} className="mt-px shrink-0 fill-primario-oscuro text-white" />
            <p>
              {ocurrio
                ? <>Al guardar, el estado de la tutoría cambiará automáticamente a <b className="text-texto">Realizada</b>.</>
                : 'Solo se puede registrar seguimiento de tutorías ya realizadas'}
            </p>
          </div>
          {error && <Alerta>{error}</Alerta>}

          <div className="flex justify-end">
            <Boton cargando={enviando} onClick={guardar} className="!rounded-md !bg-primario-oscuro !py-1.5 text-xs font-medium hover:!bg-primario">
              <Save size={14} /> Guardar Seguimiento
            </Boton>
          </div>
        </fieldset>
      )}
    </div>
  );
}
