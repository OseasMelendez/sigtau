import { useMemo, useState } from 'react';
import { ArrowDownUp, CalendarDays, Clock, Download, Lightbulb, Quote, TrendingUp, UserCheck } from 'lucide-react';
import { tutorias } from '../../services';
import { useCarga } from '../../lib/hooks';
import { diaMes, duracion, fechaConDia } from '../../lib/fechas';
import { Alerta, Badge, Boton, Cargando, Encabezado, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import type { EstadoTutoria } from '../../types';

/** 8.2.5 Historial de tutorías (Figma 3:333). RF-09 */
export function HistorialPage() {
  const { datos, cargando, error } = useCarga(() => tutorias.mias(), []);
  const [estado, setEstado] = useState<EstadoTutoria | ''>('');
  const [asignatura, setAsignatura] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [idSel, setIdSel] = useState<number | null>(null);
  const [recientes, setRecientes] = useState(true); // orden de la lista

  const lista = useMemo(() => (datos ?? [])
    .filter((t) => !estado || t.estado === estado)
    .filter((t) => !asignatura || String(t.asignatura.id_asignatura) === asignatura)
    .filter((t) => !desde || t.franja.fecha >= desde)
    .filter((t) => !hasta || t.franja.fecha <= hasta)
    .sort((a, b) => (b.franja.fecha + b.franja.hora_inicio).localeCompare(a.franja.fecha + a.franja.hora_inicio) * (recientes ? 1 : -1)),
  [datos, estado, asignatura, desde, hasta, recientes]);

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;

  const asignaturas = [...new Map(datos.map((t) => [t.asignatura.id_asignatura, t.asignatura])).values()];
  const sel = lista.find((t) => t.id_tutoria === idSel) ?? lista[0];
  const filtros = estado || asignatura || desde || hasta;
  const select = `${claseInput} !w-auto !py-1.5 !text-xs`;
  /** '2026-06-15' -> '15 jun, 2026' */
  const fechaLista = (f: string) => `${diaMes(`${f}T00:00:00Z`)}, ${f.slice(0, 4)}`;
  const claseFecha = 'bg-transparent px-2 py-1.5 text-xs outline-none';

  return (
    <div>
      <Encabezado titulo="Historial de Tutorías" subtitulo="Revisa el registro y detalle de tus sesiones." />

      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <select className={select} value={estado} onChange={(e) => setEstado(e.target.value as EstadoTutoria | '')} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option>Programada</option><option>Realizada</option><option>Cancelada</option>
        </select>
        <select className={select} value={asignatura} onChange={(e) => setAsignatura(e.target.value)} aria-label="Asignatura">
          <option value="">Todas las asignaturas</option>
          {asignaturas.map((a) => <option key={a.id_asignatura} value={a.id_asignatura}>{a.nombre}</option>)}
        </select>
        {/* Rango de fechas en una sola caja, como en el Figma */}
        <div className="flex items-center gap-1 rounded-lg border border-borde bg-white px-1 focus-within:border-primario focus-within:ring-2 focus-within:ring-primario/20">
          <input type="date" className={claseFecha} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
          <span className="text-texto-suave">-</span>
          <input type="date" className={claseFecha} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        </div>
        <button className="ml-auto text-xs font-semibold text-primario hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-50"
          disabled={!filtros} onClick={() => { setEstado(''); setAsignatura(''); setDesde(''); setHasta(''); }}>Limpiar Filtros</button>
      </div>

      {lista.length === 0 ? <Vacio texto="No hay tutorías que coincidan con los filtros." /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[22rem_1fr]">
          <div className="rounded-2xl border border-borde bg-superficie p-3 print:hidden">
            <div className="flex items-center justify-between px-2 pt-1 pb-3">
              <p className="font-medium">Sesiones ({lista.length})</p>
              <button onClick={() => setRecientes(!recientes)} className="rounded p-1 text-texto-suave hover:bg-fondo"
                title={recientes ? 'Más recientes primero' : 'Más antiguas primero'} aria-label="Cambiar orden">
                <ArrowDownUp size={15} />
              </button>
            </div>
            <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
              {lista.map((t) => (
                <button key={t.id_tutoria} onClick={() => setIdSel(t.id_tutoria)}
                  className={`rounded-lg border p-3 text-left transition-colors ${t.id_tutoria === sel?.id_tutoria
                    ? 'border-primario/40 border-l-4 border-l-primario bg-primario-suave' : 'border-borde hover:bg-fondo'}`}>
                  <div className="flex items-center justify-between">
                    <Badge estado={t.estado} className="!px-2 !py-0 !text-[10px]" />
                    <span className="flex items-center gap-1 text-[10px] text-texto-suave"><CalendarDays size={11} /> {fechaLista(t.franja.fecha)}</span>
                  </div>
                  <p className="mt-2 text-[15px] font-medium">{t.asignatura.nombre}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-[11px] text-texto-suave">
                    <Iniciales nombre={t.tutor.nombre_completo} className="size-5 text-[8px]" /> {t.tutor.nombre_completo}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {sel && (
            <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
              <div className="relative overflow-hidden border-b border-borde bg-fondo-tutor p-6">
                {/* Círculo decorativo de la cabecera (Figma 3:333) */}
                <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primario-suave/50" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-texto-suave">
                      <Badge estado={sel.estado} className="!px-2 !py-0 !text-[10px]" />
                      <span className="flex items-center gap-1 text-[11px]"><Clock size={12} /> {sel.franja.hora_inicio} – {sel.franja.hora_fin} ({duracion(sel.franja.hora_inicio, sel.franja.hora_fin)})</span>
                    </div>
                    <Boton variante="secundario" className="!px-3 !py-1.5 text-xs font-medium print:hidden" onClick={() => window.print()}
                      title="Abre el diálogo de impresión (Guardar como PDF)">
                      <Download size={14} /> Descargar Reporte
                    </Boton>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold">{sel.asignatura.nombre}</h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-texto-suave"><CalendarDays size={16} className="text-primario" /> {fechaConDia(sel.franja.fecha)}</p>
                </div>
              </div>

              <div className="grid items-start gap-4 p-6 md:grid-cols-[1fr_1.1fr]">
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border border-borde p-3.5">
                    <p className="mb-3 text-[10px] tracking-wide text-texto-suave uppercase">Tutor asignado</p>
                    <div className="flex items-center gap-3">
                      <Iniciales nombre={sel.tutor.nombre_completo} className="size-10 text-sm" />
                      <div>
                        <p className="text-sm font-semibold">{sel.tutor.nombre_completo}</p>
                        <p className="text-[11px] text-texto-suave">{sel.tutor.especialidad}</p>
                      </div>
                    </div>
                  </div>
                  {sel.seguimiento && (
                    <>
                      <div className="rounded-lg border border-borde p-3.5">
                        <p className="text-[10px] text-texto-suave">Asistencia</p>
                        <p className="mt-1 flex items-center gap-2 font-semibold"><UserCheck size={17} className="text-primario" /> {sel.seguimiento.asistio ? 'Asistió' : 'No asistió'}</p>
                      </div>
                      <div className="rounded-lg border border-borde p-3.5">
                        <p className="text-[10px] text-texto-suave">Nivel Alcanzado</p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold"><TrendingUp size={17} className="text-primario" /> {sel.seguimiento.nivel_progreso ?? '—'}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="relative overflow-hidden rounded-lg border border-primario/25 bg-primario-suave p-4">
                  <Quote aria-hidden size={44} className="absolute top-2 right-3 fill-primario/15 text-transparent" />
                  <p className="relative mb-3 flex items-center gap-2 font-medium"><Lightbulb size={17} /> Observaciones del Tutor</p>
                  <p className="relative text-xs leading-relaxed text-primario-oscuro italic">
                    {sel.seguimiento ? `"${sel.seguimiento.observaciones}"`
                      : sel.estado === 'Cancelada' ? `Tutoría cancelada. Motivo: ${sel.motivo_cancelacion}`
                      : 'El tutor registrará las observaciones cuando se realice la sesión.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
