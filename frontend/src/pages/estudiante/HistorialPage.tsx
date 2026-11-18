import { useMemo, useState } from 'react';
import { CalendarDays, Clock, Lightbulb, Printer, TrendingUp, UserCheck } from 'lucide-react';
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

  const lista = useMemo(() => (datos ?? [])
    .filter((t) => !estado || t.estado === estado)
    .filter((t) => !asignatura || String(t.asignatura.id_asignatura) === asignatura)
    .filter((t) => !desde || t.franja.fecha >= desde)
    .filter((t) => !hasta || t.franja.fecha <= hasta)
    .sort((a, b) => (b.franja.fecha + b.franja.hora_inicio).localeCompare(a.franja.fecha + a.franja.hora_inicio)),
  [datos, estado, asignatura, desde, hasta]);

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;

  const asignaturas = [...new Map(datos.map((t) => [t.asignatura.id_asignatura, t.asignatura])).values()];
  const sel = lista.find((t) => t.id_tutoria === idSel) ?? lista[0];
  const filtros = estado || asignatura || desde || hasta;
  const select = `${claseInput} !w-auto !py-2`;

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
        <input type="date" className={select} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <span className="text-texto-suave">–</span>
        <input type="date" className={select} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        {filtros && (
          <button className="ml-auto text-sm font-semibold text-primario hover:underline"
            onClick={() => { setEstado(''); setAsignatura(''); setDesde(''); setHasta(''); }}>Limpiar filtros</button>
        )}
      </div>

      {lista.length === 0 ? <Vacio texto="No hay tutorías que coincidan con los filtros." /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[22rem_1fr]">
          <div className="rounded-2xl border border-borde bg-superficie p-3 print:hidden">
            <p className="px-2 pt-1 pb-3 font-semibold">Sesiones ({lista.length})</p>
            <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
              {lista.map((t) => (
                <button key={t.id_tutoria} onClick={() => setIdSel(t.id_tutoria)}
                  className={`rounded-xl border p-3 text-left transition-colors ${t.id_tutoria === sel?.id_tutoria ? 'border-l-4 border-primario bg-primario-suave/50' : 'border-borde hover:bg-fondo'}`}>
                  <div className="flex items-center justify-between">
                    <Badge estado={t.estado} />
                    <span className="flex items-center gap-1 text-xs text-texto-suave"><CalendarDays size={12} /> {diaMes(t.franja.fecha)}</span>
                  </div>
                  <p className="mt-2 font-semibold">{t.asignatura.nombre}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-texto-suave">
                    <Iniciales nombre={t.tutor.nombre_completo} className="size-5 text-[9px]" /> {t.tutor.nombre_completo}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {sel && (
            <div className="rounded-2xl border border-borde bg-superficie">
              <div className="border-b border-borde bg-gradient-to-r from-primario-suave/40 to-transparent p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-texto-suave">
                    <Badge estado={sel.estado} />
                    <span className="flex items-center gap-1"><Clock size={13} /> {sel.franja.hora_inicio} – {sel.franja.hora_fin} ({duracion(sel.franja.hora_inicio, sel.franja.hora_fin)})</span>
                  </div>
                  <Boton variante="secundario" className="print:hidden" onClick={() => window.print()}><Printer size={16} /> Imprimir</Boton>
                </div>
                <h2 className="mt-3 text-3xl font-bold">{sel.asignatura.nombre}</h2>
                <p className="mt-2 flex items-center gap-2 text-texto-suave"><CalendarDays size={18} /> {fechaConDia(sel.franja.fecha)}</p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-[1fr_1.4fr]">
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-borde p-4">
                    <p className="mb-3 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">Tutor asignado</p>
                    <div className="flex items-center gap-3">
                      <Iniciales nombre={sel.tutor.nombre_completo} className="size-11" />
                      <div>
                        <p className="font-semibold">{sel.tutor.nombre_completo}</p>
                        <p className="text-xs text-texto-suave">{sel.tutor.especialidad}</p>
                      </div>
                    </div>
                  </div>
                  {sel.seguimiento && (
                    <>
                      <div className="rounded-xl border border-borde p-4">
                        <p className="text-xs text-texto-suave">Asistencia</p>
                        <p className="mt-1 flex items-center gap-2 font-semibold"><UserCheck size={18} className="text-primario" /> {sel.seguimiento.asistio ? 'Asistió' : 'No asistió'}</p>
                      </div>
                      <div className="rounded-xl border border-borde p-4">
                        <p className="text-xs text-texto-suave">Nivel alcanzado</p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold"><TrendingUp size={18} className="text-primario" /> {sel.seguimiento.nivel_progreso ?? '—'}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl bg-primario-suave/60 p-5">
                  <p className="mb-3 flex items-center gap-2 text-lg font-medium"><Lightbulb size={18} /> Observaciones del Tutor</p>
                  <p className="text-sm leading-relaxed text-primario-oscuro">
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
