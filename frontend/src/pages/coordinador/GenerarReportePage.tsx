import { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, CircleCheck, ClipboardList, Download, FileSpreadsheet, FileText, IdCard, Info, Table2 } from 'lucide-react';
import { catalogos, reportes, usuarios } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { fechaCorta, hoyISO } from '../../lib/fechas';
import { Alerta, Boton, Encabezado, Tarjeta, claseInput } from '../../components/ui';
import { Selector } from '../../components/Selector';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import {
  TIPOS_REPORTE, type EstadoTutoria, type FiltrosReporte, type ReporteGenerado, type TipoReporte, type VistaPreviaReporte,
} from '../../types';

/** 'YYYY-MM' -> primer y último día del mes */
const inicioMes = (m: string) => `${m}-01`;
const finMes = (m: string) => {
  const [a, mes] = m.split('-').map(Number);
  return new Date(Date.UTC(a, mes, 0)).toISOString().slice(0, 10);
};
const mesActual = hoyISO().slice(0, 7);
const mesAnterior = (() => {
  const [a, m] = mesActual.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
})();

/**
 * Qué contiene cada tipo de reporte (las columnas las arma el backend) y si el filtro
 * de Estado de la tutoría aplica. Solo el listado de tutorías se filtra por estado:
 *  - Asistencia y Progreso usan solo tutorías con seguimiento (= Realizadas).
 *  - Demanda y Gestión de solicitudes se basan en las solicitudes, no en las tutorías.
 */
const INFO_TIPO: Record<TipoReporte, { descripcion: string; filas: string; usaEstado: boolean }> = {
  'Tutorías realizadas': {
    descripcion: 'Listado de tutorías: fecha, hora, estudiante, tutor, asignatura, lugar y estado. Usa el filtro de Estado para elegir cuáles.',
    filas: 'Tutorías listadas', usaEstado: true,
  },
  'Asistencia estudiantil': {
    descripcion: 'Por estudiante: tutorías con seguimiento, asistencias, inasistencias y porcentaje de asistencia.',
    filas: 'Estudiantes', usaEstado: false,
  },
  'Progreso académico': {
    descripcion: 'Seguimientos registrados por los tutores: asistencia, nivel de progreso y observaciones.',
    filas: 'Seguimientos', usaEstado: false,
  },
  'Demanda por asignatura': {
    descripcion: 'Por asignatura: solicitudes recibidas, aprobadas, rechazadas, pendientes y tutorías realizadas.',
    filas: 'Asignaturas', usaEstado: false,
  },
  'Gestión de solicitudes': {
    descripcion: 'Cada solicitud con su estado, fecha de respuesta y motivo de rechazo.',
    filas: 'Solicitudes', usaEstado: false,
  },
};

/** 8.2.12 Generar reporte (Figma 96:366). RF-11: vista previa, PDF/XLSX e historial (regla 3.29.3) */
export function GenerarReportePage() {
  const asigs = useCarga(() => catalogos.asignaturas(), []);
  const tuts = useCarga(() => usuarios.listar({ rol: 'Tutor' }), []);
  const historial = useCarga(() => reportes.historial(), []);
  const avisar = useToast();

  const [desdeMes, setDesdeMes] = useState(mesAnterior);
  const [hastaMes, setHastaMes] = useState(mesActual);
  const [tipo, setTipo] = useState<TipoReporte>('Tutorías realizadas');
  const [idTutor, setIdTutor] = useState<number | undefined>();
  const [idAsignatura, setIdAsignatura] = useState<number | undefined>();
  const [estado, setEstado] = useState<EstadoTutoria | undefined>('Realizada');
  const [vista, setVista] = useState<VistaPreviaReporte | null>(null);
  const [verTabla, setVerTabla] = useState(true); // abierta: así se ve qué contiene cada tipo
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState<string | null>(null);

  const info = INFO_TIPO[tipo];
  const rangoInvalido = hastaMes < desdeMes;
  const filtros: FiltrosReporte = {
    tipo, fecha_desde: inicioMes(desdeMes), fecha_hasta: finMes(hastaMes),
    id_tutor: idTutor, id_asignatura: idAsignatura,
    // El estado solo se envía en el tipo que lo usa (ver INFO_TIPO)
    estado_filtro: info.usaEstado ? estado : undefined,
  };
  const clave = JSON.stringify(filtros);

  // La vista previa se actualiza sola al cambiar cualquier filtro
  useEffect(() => {
    if (rangoInvalido) return;
    let vigente = true;
    reportes.vistaPrevia(JSON.parse(clave))
      .then((v) => { if (vigente) { setVista(v); setError(''); } })
      .catch((e) => vigente && setError(mensajeError(e)));
    return () => { vigente = false; };
  }, [clave, rangoInvalido]);

  const exportar = async (formato: 'PDF' | 'XLSX') => {
    if (rangoInvalido) return;
    setDescargando(formato);
    try {
      await reportes.descargar(filtros, formato);
      avisar(`Reporte ${formato === 'PDF' ? 'PDF' : 'Excel'} generado.`);
      historial.recargar();
    } catch (e) { setError(mensajeError(e)); } finally { setDescargando(null); }
  };

  const redescargar = async (r: ReporteGenerado) => {
    setDescargando(`h${r.id_reporte}`);
    try { await reportes.descargarHistorial(r.id_reporte, r.formato); }
    catch (e) { avisar(mensajeError(e), 'error'); } finally { setDescargando(null); }
  };

  const sel = `${claseInput} !py-2`;
  const filtro = (etiqueta: string, control: React.ReactNode) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-texto-suave">{etiqueta}</span>
      <div className="relative">{control}</div>
    </label>
  );

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Generar Reporte" subtitulo="Genera, visualiza y exporta analíticas académicas detalladas." />

      <div className="mb-3 grid gap-3 md:grid-cols-[1.4fr_auto_1fr_1fr_1fr]">
        {/* El tipo va primero porque define qué filtros aplican */}
        {filtro('Tipo de reporte', (
          <Selector className={sel} value={tipo} onChange={(v) => setTipo(v as TipoReporte)}>
            {TIPOS_REPORTE.map((t) => <option key={t}>{t}</option>)}
          </Selector>
        ))}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-texto-suave">Período</span>
          <div className="flex gap-2">
            <input type="month" aria-label="Desde" className={`${claseInput} !w-36 !py-2`} value={desdeMes} max={hastaMes} onChange={(e) => e.target.value && setDesdeMes(e.target.value)} />
            <input type="month" aria-label="Hasta" className={`${claseInput} !w-36 !py-2`} value={hastaMes} min={desdeMes} onChange={(e) => e.target.value && setHastaMes(e.target.value)} />
          </div>
        </div>
        {filtro('Tutor', (
          <Selector className={sel} value={idTutor ?? ''} onChange={(v) => setIdTutor(v ? Number(v) : undefined)}>
            <option value="">Todos los tutores</option>
            {tuts.datos?.map((t) => <option key={t.id_usuario} value={t.id_usuario}>{t.nombre_completo}</option>)}
          </Selector>
        ))}
        {filtro('Asignatura', (
          <Selector className={sel} value={idAsignatura ?? ''} onChange={(v) => setIdAsignatura(v ? Number(v) : undefined)}>
            <option value="">Todas las asignaturas</option>
            {asigs.datos?.map((a) => <option key={a.id_asignatura} value={a.id_asignatura}>{a.nombre}</option>)}
          </Selector>
        ))}
        {filtro('Estado de la tutoría', info.usaEstado ? (
          <Selector className={sel} value={estado ?? ''} onChange={(v) => setEstado((v || undefined) as EstadoTutoria | undefined)}>
            <option value="">Todos</option><option value="Programada">Programadas</option><option value="Realizada">Realizadas</option><option value="Cancelada">Canceladas</option>
          </Selector>
        ) : (
          <Selector className={sel} value="No aplica" disabled title="Este tipo de reporte no se filtra por estado"><option>No aplica</option></Selector>
        ))}
      </div>
      <p className="mb-5 flex items-start gap-1.5 text-xs text-texto-suave">
        <Info size={14} className="mt-px shrink-0 text-primario" /> <span><b className="font-medium text-texto">{tipo}:</b> {info.descripcion}</span>
      </p>

      {rangoInvalido && <div className="mb-4"><Alerta>El mes final no puede ser anterior al mes inicial.</Alerta></div>}
      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Tarjeta className="!bg-fondo/60">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primario-suave text-primario"><ClipboardList size={20} /></span>
          <p className="mt-6 text-xs font-medium tracking-wide text-texto-suave uppercase">Total tutorías</p>
          <p className="flex items-end gap-2 text-5xl font-bold text-primario-oscuro">{vista?.total_tutorias ?? '—'} <BarChart3 size={20} className="mb-2 text-primario" /></p>
        </Tarjeta>
        <Tarjeta className="!bg-fondo/60">
          <div className="flex justify-between">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primario-suave text-primario"><IdCard size={20} /></span>
            <CircleCheck size={26} className="text-primario/70" />
          </div>
          <p className="mt-3 text-xs font-medium tracking-wide text-texto-suave uppercase">Tasa de asistencia</p>
          <p className="text-5xl font-bold">{vista?.tasa_asistencia ?? '—'}<span className="ml-1 text-2xl font-normal">%</span></p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-200">
            <div className="h-1.5 rounded-full bg-primario" style={{ width: `${vista?.tasa_asistencia ?? 0}%` }} />
          </div>
        </Tarjeta>
        {/* Tercera tarjeta: lo que cuenta este tipo de reporte (cambia con el tipo) */}
        <Tarjeta className="!bg-fondo/60">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primario-suave text-primario"><Table2 size={20} /></span>
          <p className="mt-6 text-xs font-medium tracking-wide text-texto-suave uppercase">{info.filas} en el reporte</p>
          <p className="text-5xl font-bold text-primario-oscuro">{vista?.filas.length ?? '—'}</p>
        </Tarjeta>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-5">
        <button className="flex items-center gap-1.5 text-sm font-semibold text-primario hover:underline" onClick={() => setVerTabla(!verTabla)}>
          {verTabla ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {verTabla ? 'Ocultar' : 'Ver'} datos del reporte ({vista?.filas.length ?? 0} filas)
        </button>
        <div className="flex gap-3">
          <Boton variante="secundario" disabled={rangoInvalido} cargando={descargando === 'XLSX'} onClick={() => exportar('XLSX')}><FileSpreadsheet size={16} /> Exportar a Excel</Boton>
          <Boton className="!bg-primario-oscuro" disabled={rangoInvalido} cargando={descargando === 'PDF'} onClick={() => exportar('PDF')}><FileText size={16} /> Exportar a PDF</Boton>
        </div>
      </div>

      {verTabla && vista && (
        <Tarjeta className="mb-6 !p-0">
          {vista.filas.length === 0 ? <p className="py-8 text-center text-sm text-texto-suave">No hay datos para estos filtros.</p> : (
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-fondo text-left"><tr>{vista.columnas.map((c) => <th key={c} className="px-4 py-2.5 font-medium">{c}</th>)}</tr></thead>
                <tbody>{vista.filas.map((fila, i) => <tr key={i} className="border-t border-borde">{fila.map((v, j) => <td key={j} className="px-4 py-2">{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      <div className="overflow-x-auto rounded-2xl border border-borde bg-white shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <h2 className="text-lg font-medium">Historial de Reportes Generados</h2>
          <p className="text-xs text-texto-suave">Últimos reportes generados en el sistema.</p>
        </div>
        {historial.datos?.length === 0 ? <p className="px-6 pb-6 text-sm text-texto-suave">Aún no se han generado reportes.</p> : (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-slate-100 text-left text-[11px] tracking-wide text-texto-suave uppercase">
              <tr><th className="px-6 py-3 font-medium">Tipo de reporte</th><th className="px-4 py-3 font-medium">Filtros aplicados</th>
                <th className="px-4 py-3 font-medium">Fecha de generación</th><th className="px-4 py-3 font-medium">Responsable</th><th className="px-4 py-3 text-center font-medium">Acción</th></tr>
            </thead>
            <tbody>
              {historial.datos?.slice(0, 10).map((r) => (
                <tr key={r.id_reporte} className="border-t border-borde">
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primario-suave text-primario">{r.formato === 'PDF' ? <FileText size={14} /> : <FileSpreadsheet size={14} />}</span>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{fechaCorta(r.fecha_desde)} – {fechaCorta(r.fecha_hasta)}</span>
                      {r.tutor && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Tutor: {r.tutor}</span>}
                      {r.asignatura && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{r.asignatura}</span>}
                      {r.estado_filtro && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{r.estado_filtro}s</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{fechaCorta(r.fecha_generacion)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2"><Iniciales nombre={r.responsable} className="size-6 text-[9px]" /> {r.responsable}</span></td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => redescargar(r)} disabled={descargando === `h${r.id_reporte}`} title={`Descargar ${r.formato}`}
                      className="rounded-lg p-1.5 text-texto-suave hover:bg-fondo hover:text-primario disabled:opacity-50"><Download size={17} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
