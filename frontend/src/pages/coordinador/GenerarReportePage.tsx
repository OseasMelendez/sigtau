import { useState } from 'react';
import { Download, Eye, FileSpreadsheet, FileText, History } from 'lucide-react';
import { catalogos, reportes, usuarios } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { fechaCorta, fechaHora, hoyISO, sumarDias } from '../../lib/fechas';
import { Alerta, Boton, Campo, Encabezado, Tarjeta, claseInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { TIPOS_REPORTE, type EstadoTutoria, type FiltrosReporte, type TipoReporte, type VistaPreviaReporte } from '../../types';

/** 8.2.12 Generar reporte (Figma 96:366). RF-11: PDF o XLSX, con historial (regla 3.29.3) */
export function GenerarReportePage() {
  const asigs = useCarga(() => catalogos.asignaturas(), []);
  const tuts = useCarga(() => usuarios.listar({ rol: 'Tutor' }), []);
  const historial = useCarga(() => reportes.historial(), []);
  const avisar = useToast();

  const [f, setF] = useState<FiltrosReporte>({ tipo: 'Tutorías realizadas', fecha_desde: sumarDias(hoyISO(), -180), fecha_hasta: hoyISO() });
  const [vista, setVista] = useState<VistaPreviaReporte | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState<'vista' | 'PDF' | 'XLSX' | null>(null);

  const validar = () => {
    if (!f.fecha_desde || !f.fecha_hasta) return 'Selecciona el rango de fechas';
    if (f.fecha_hasta < f.fecha_desde) return 'La fecha final no puede ser anterior a la inicial';
    return '';
  };

  const previsualizar = async () => {
    const v = validar();
    if (v) return setError(v);
    setCargando('vista');
    setError('');
    try { setVista(await reportes.vistaPrevia(f)); } catch (e) { setError(mensajeError(e)); } finally { setCargando(null); }
  };

  const descargar = async (formato: 'PDF' | 'XLSX') => {
    const v = validar();
    if (v) return setError(v);
    setCargando(formato);
    setError('');
    try {
      await reportes.descargar(f, formato);
      avisar(`Reporte ${formato} generado.`);
      historial.recargar();
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(null); }
  };

  const cambiar = (cambios: Partial<FiltrosReporte>) => { setF({ ...f, ...cambios }); setVista(null); };

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Generar Reporte" subtitulo="Genera reportes estadísticos de las tutorías y expórtalos en PDF o Excel." />

      <div className="grid items-start gap-5 lg:grid-cols-[22rem_1fr]">
        <Tarjeta className="flex flex-col gap-4">
          <Campo etiqueta="Tipo de reporte" htmlFor="r-tipo">
            <select id="r-tipo" className={claseInput} value={f.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoReporte })}>
              {TIPOS_REPORTE.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde" htmlFor="r-desde">
              <input id="r-desde" type="date" className={claseInput} value={f.fecha_desde} onChange={(e) => cambiar({ fecha_desde: e.target.value })} />
            </Campo>
            <Campo etiqueta="Hasta" htmlFor="r-hasta">
              <input id="r-hasta" type="date" className={claseInput} value={f.fecha_hasta} onChange={(e) => cambiar({ fecha_hasta: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Tutor" opcional htmlFor="r-tutor">
            <select id="r-tutor" className={claseInput} value={f.id_tutor ?? ''} onChange={(e) => cambiar({ id_tutor: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Todos</option>
              {tuts.datos?.map((t) => <option key={t.id_usuario} value={t.id_usuario}>{t.nombre_completo}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Asignatura" opcional htmlFor="r-asig">
            <select id="r-asig" className={claseInput} value={f.id_asignatura ?? ''} onChange={(e) => cambiar({ id_asignatura: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Todas</option>
              {asigs.datos?.map((a) => <option key={a.id_asignatura} value={a.id_asignatura}>{a.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Estado de la tutoría" opcional htmlFor="r-estado">
            <select id="r-estado" className={claseInput} value={f.estado_filtro ?? ''} onChange={(e) => cambiar({ estado_filtro: (e.target.value || undefined) as EstadoTutoria | undefined })}>
              <option value="">Todos</option><option>Programada</option><option>Realizada</option><option>Cancelada</option>
            </select>
          </Campo>

          {error && <Alerta>{error}</Alerta>}
          <Boton variante="secundario" cargando={cargando === 'vista'} onClick={previsualizar}><Eye size={16} /> Vista previa</Boton>
          <div className="grid grid-cols-2 gap-3">
            <Boton cargando={cargando === 'PDF'} onClick={() => descargar('PDF')}><FileText size={16} /> PDF</Boton>
            <Boton variante="exito" cargando={cargando === 'XLSX'} onClick={() => descargar('XLSX')}><FileSpreadsheet size={16} /> Excel</Boton>
          </div>
        </Tarjeta>

        <div className="flex flex-col gap-5">
          <Tarjeta>
            {!vista ? (
              <p className="py-14 text-center text-sm text-texto-suave">Elige los filtros y pulsa <b>Vista previa</b> para ver el reporte antes de descargarlo.</p>
            ) : (
              <>
                <h2 className="text-lg font-semibold">{vista.titulo}</h2>
                <p className="mb-4 text-xs text-texto-suave">Del {fechaCorta(f.fecha_desde)} al {fechaCorta(f.fecha_hasta)}</p>
                {vista.resumen.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-3">
                    {vista.resumen.map((r) => (
                      <div key={r.etiqueta} className="rounded-xl bg-fondo px-4 py-2">
                        <p className="text-xs text-texto-suave">{r.etiqueta}</p>
                        <p className="text-lg font-bold">{r.valor}</p>
                      </div>
                    ))}
                  </div>
                )}
                {vista.filas.length === 0 ? <p className="py-6 text-center text-sm text-texto-suave">No hay datos para estos filtros.</p> : (
                  <div className="max-h-[50vh] overflow-auto rounded-lg border border-borde">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-fondo text-left"><tr>{vista.columnas.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
                      <tbody>{vista.filas.map((fila, i) => (
                        <tr key={i} className="border-t border-borde">{fila.map((v, j) => <td key={j} className="px-3 py-2">{v}</td>)}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><History size={18} /> Reportes generados</h2>
            {historial.datos?.length === 0 && <p className="text-sm text-texto-suave">Aún no se han generado reportes.</p>}
            <div className="flex flex-col">
              {historial.datos?.slice(0, 8).map((r) => (
                <div key={r.id_reporte} className="flex items-center gap-3 border-b border-borde py-2.5 text-sm last:border-0">
                  <Download size={15} className="text-primario" />
                  <span className="flex-1">{r.tipo} <span className="text-texto-suave">({fechaCorta(r.fecha_desde)} – {fechaCorta(r.fecha_hasta)})</span></span>
                  <span className="rounded bg-fondo px-1.5 py-0.5 text-xs font-semibold">{r.formato}</span>
                  <span className="text-xs text-texto-suave">{fechaHora(r.fecha_generacion)}</span>
                </div>
              ))}
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
