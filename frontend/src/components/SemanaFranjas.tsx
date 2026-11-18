import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { diaCorto, hoyISO, lunesDe, sumarDias } from '../lib/fechas';
import type { Franja } from '../types';

/**
 * Calendario semanal de franjas (lunes a domingo). Lo usan Detalle del Tutor
 * (estudiante elige una franja), Gestionar Horarios y Reprogramar (tutor).
 */
export function SemanaFranjas({
  lunes, onCambiarSemana, franjas, seleccionada, onElegir, renderAcciones, deshabilitar, estilo,
}: {
  lunes: string;
  onCambiarSemana: (lunes: string) => void;
  franjas: Franja[];
  seleccionada?: number | null;
  onElegir?: (f: Franja) => void;
  /** Botones extra dentro de cada franja (p. ej. editar/eliminar) */
  renderAcciones?: (f: Franja) => ReactNode;
  /** Devuelve true si la franja no se puede elegir */
  deshabilitar?: (f: Franja) => boolean;
  /** Clases de color propias para una franja (reemplaza las de Disponible/Ocupado) */
  estilo?: (f: Franja) => string | undefined;
}) {
  const hoy = hoyISO();
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const domingo = dias[6];
  const fmt = (f: string, o: Intl.DateTimeFormatOptions) => new Date(`${f}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', ...o });
  const titulo = `Semana del ${fmt(lunes, { day: 'numeric' })} al ${fmt(domingo, { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-center gap-4">
        <button type="button" onClick={() => onCambiarSemana(sumarDias(lunes, -7))} className="rounded-full p-1.5 hover:bg-fondo" aria-label="Semana anterior"><ChevronLeft size={18} /></button>
        <p className="min-w-64 text-center text-sm font-semibold">{titulo}</p>
        <button type="button" onClick={() => onCambiarSemana(sumarDias(lunes, 7))} className="rounded-full p-1.5 hover:bg-fondo" aria-label="Semana siguiente"><ChevronRight size={18} /></button>
        {lunes !== lunesDe(hoy) && (
          <button type="button" onClick={() => onCambiarSemana(lunesDe(hoy))} className="text-xs font-semibold text-primario hover:underline">Hoy</button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dias.map((d) => {
          const delDia = franjas.filter((f) => f.fecha === d).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
          return (
            <div key={d} className="flex min-h-56 flex-col gap-2">
              <div className={`rounded-lg py-1.5 text-center ${d === hoy ? 'bg-primario-suave' : ''}`}>
                <p className="text-sm font-semibold capitalize">{diaCorto(d)}</p>
                <p className="text-xs text-texto-suave">{Number(d.slice(8))}</p>
              </div>
              {delDia.length === 0 && <div className="flex-1 rounded-lg bg-fondo/70" />}
              {delDia.map((f) => {
                const pasada = f.fecha < hoy;
                const ocupada = f.estado === 'Ocupado';
                const bloqueada = deshabilitar ? deshabilitar(f) : ocupada || pasada;
                const sel = seleccionada === f.id_horario;
                const propio = estilo?.(f);
                return (
                  <div key={f.id_horario}
                    className={`group rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors ${
                      sel ? 'bg-primario-oscuro text-white ring-2 ring-primario ring-offset-2'
                        : propio ? propio
                        : ocupada ? 'bg-slate-200 text-slate-500'
                        : pasada ? 'bg-primario/30 text-white'
                        : 'bg-primario text-white'
                    } ${onElegir && !bloqueada ? 'cursor-pointer hover:bg-primario-oscuro' : ''}`}
                    onClick={() => onElegir && !bloqueada && onElegir(f)}
                    role={onElegir && !bloqueada ? 'button' : undefined}
                    title={ocupada ? 'Ocupado' : pasada ? 'Fecha pasada' : 'Disponible'}>
                    <span className="flex items-center justify-center gap-1">
                      {ocupada && !propio && <Lock size={11} />}{f.hora_inicio} – {f.hora_fin}
                    </span>
                    {renderAcciones?.(f)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-4 text-xs text-texto-suave">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primario" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-300" /> Ocupado</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-fondo ring-1 ring-borde" /> Sin disponibilidad</span>
      </div>
    </div>
  );
}
