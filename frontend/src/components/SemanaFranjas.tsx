import type { ReactNode } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { diaCorto, hoyISO, lunesDe, sumarDias } from '../lib/fechas';
import type { Franja } from '../types';

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** 13 -> '01:00 PM' */
const etiquetaHora = (h: number) => `${String(h % 12 || 12).padStart(2, '0')}:00 ${h < 12 ? 'AM' : 'PM'}`;

/**
 * Calendario semanal de franjas (lunes a domingo). Lo usan Detalle del Tutor
 * (estudiante elige una franja), Gestionar Horarios y Programación (tutor).
 *
 * Vistas:
 *  - por defecto: bloques apilados por día;
 *  - `cuadricula`: cuadrícula por horas con celdas lila (Figma Detalle Tutor 50:359);
 *  - `cuadricula` + `aspecto="calendario"`: agenda con líneas por hora (Figma Programación 276:248).
 */
export function SemanaFranjas({
  lunes, onCambiarSemana, franjas, seleccionada, onElegir, renderAcciones, deshabilitar, estilo,
  cuadricula = false, leyenda = true, aspecto = 'celdas', renderContenido, onElegirHueco,
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
  /** Vista de cuadrícula por horas en vez de bloques apilados */
  cuadricula?: boolean;
  /** false si la página muestra <LeyendaFranjas /> u otra leyenda propia */
  leyenda?: boolean;
  /** Solo con `cuadricula`: 'celdas' (lila) o 'calendario' (agenda con líneas por hora) */
  aspecto?: 'celdas' | 'calendario';
  /** Solo con `cuadricula`: contenido propio del bloque (reemplaza hora + ícono) */
  renderContenido?: (f: Franja) => ReactNode;
  /** Solo con aspecto "calendario": clic en una hora vacía de hoy en adelante (p. ej. crear franja) */
  onElegirHueco?: (fecha: string, hora: number) => void;
}) {
  const hoy = hoyISO();
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const domingo = dias[6];
  const fmt = (f: string, o: Intl.DateTimeFormatOptions) => new Date(`${f}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', ...o });
  const titulo = `Semana del ${fmt(lunes, { day: 'numeric' })} al ${fmt(domingo, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const calendario = cuadricula && aspecto === 'calendario';
  const altoHora = calendario ? 56 : 44;
  /** Margen superior de la agenda para que la etiqueta de la primera hora no se corte */
  const margen = calendario ? 10 : 0;

  /** Estado visual común a todas las vistas */
  const infoFranja = (f: Franja) => {
    const pasada = f.fecha < hoy;
    const ocupada = f.estado === 'Ocupado';
    const bloqueada = deshabilitar ? deshabilitar(f) : ocupada || pasada;
    const sel = seleccionada === f.id_horario;
    const propio = estilo?.(f);
    const elegible = !!onElegir && !bloqueada;
    return {
      ocupada, pasada, sel, propio, elegible,
      props: {
        onClick: () => elegible && onElegir!(f),
        role: elegible ? 'button' : undefined,
        title: `${f.hora_inicio} – ${f.hora_fin} · ${ocupada ? 'Ocupado' : pasada ? 'Fecha pasada' : 'Disponible'}`,
      },
    };
  };

  const cabeceraDia = (d: string) => (
    <div className={`rounded-lg py-1.5 text-center ${d === hoy ? 'bg-primario-suave' : ''}`}>
      <p className="text-sm font-semibold capitalize">{diaCorto(d)}</p>
      <p className="text-xs text-texto-suave">{Number(d.slice(8))}</p>
    </div>
  );

  // Rango de horas de la cuadrícula: de 07:00 a 18:00, ampliado si hay franjas fuera
  const inicio = Math.min(7, ...franjas.map((f) => Math.floor(minutos(f.hora_inicio) / 60)));
  const fin = Math.max(18, ...franjas.map((f) => Math.ceil(minutos(f.hora_fin) / 60)));
  const horas = Array.from({ length: fin - inicio }, (_, i) => inicio + i);

  const navegacion = calendario ? (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onCambiarSemana(sumarDias(lunes, -7))} className="rounded-full p-1.5 hover:bg-white" aria-label="Semana anterior"><ChevronLeft size={18} /></button>
        <p className="text-center text-base font-medium capitalize sm:min-w-52 sm:text-lg">
          {fmt(lunes, { day: 'numeric', month: 'short' })} – {fmt(domingo, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button type="button" onClick={() => onCambiarSemana(sumarDias(lunes, 7))} className="rounded-full p-1.5 hover:bg-white" aria-label="Semana siguiente"><ChevronRight size={18} /></button>
      </div>
      <button type="button" onClick={() => onCambiarSemana(lunesDe(hoy))}
        className="flex items-center gap-1.5 rounded-md border border-borde bg-white px-3 py-1.5 text-xs font-medium hover:bg-fondo">
        <CalendarDays size={14} /> Hoy
      </button>
    </div>
  ) : (
    <div className="mb-4 flex items-center justify-center gap-4">
      <button type="button" onClick={() => onCambiarSemana(sumarDias(lunes, -7))} className="rounded-full p-1.5 hover:bg-fondo" aria-label="Semana anterior"><ChevronLeft size={18} /></button>
      <p className="text-center text-sm font-semibold sm:min-w-64">{titulo}</p>
      <button type="button" onClick={() => onCambiarSemana(sumarDias(lunes, 7))} className="rounded-full p-1.5 hover:bg-fondo" aria-label="Semana siguiente"><ChevronRight size={18} /></button>
      {lunes !== lunesDe(hoy) && (
        <button type="button" onClick={() => onCambiarSemana(lunesDe(hoy))} className="text-xs font-semibold text-primario hover:underline">Hoy</button>
      )}
    </div>
  );

  /** Bloque de una franja posicionado por hora (vistas de cuadrícula) */
  const bloque = (f: Franja) => {
    const { ocupada, pasada, sel, propio, elegible, props } = infoFranja(f);
    const arriba = margen + ((minutos(f.hora_inicio) - inicio * 60) / 60) * altoHora;
    const alto = ((minutos(f.hora_fin) - minutos(f.hora_inicio)) / 60) * altoHora;
    const forma = calendario
      ? 'inset-x-1 flex flex-col items-start rounded-md px-1.5 py-1 text-left text-[10px]'
      : 'inset-x-0.5 flex flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-semibold';
    return (
      <div key={f.id_horario} {...props} style={{ top: arriba + 2, height: alto - 4 }}
        className={`absolute overflow-hidden transition-colors ${forma} ${
          sel ? 'bg-primario-oscuro text-white ring-2 ring-primario ring-offset-1'
            : propio ? propio
            : ocupada ? 'border border-borde bg-slate-200/80 text-slate-500'
            : pasada ? 'bg-primario/30 text-white'
            : 'bg-primario text-white'
        } ${elegible ? `cursor-pointer ${calendario ? 'hover:brightness-95' : 'hover:bg-primario-oscuro'}` : ''}`}>
        {renderContenido ? renderContenido(f) : (
          <>
            {sel ? <Check size={14} /> : ocupada && !propio ? <Lock size={13} /> : null}
            <span className="leading-tight">{f.hora_inicio} – {f.hora_fin}</span>
          </>
        )}
        {renderAcciones?.(f)}
      </div>
    );
  };

  let cuerpo: ReactNode;
  if (calendario) {
    const columnas = 'grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]';
    cuerpo = (
      <div className="overflow-hidden rounded-xl border border-borde bg-fondo-tutor">
        {navegacion}
        {/* En teléfono la semana se desplaza a lo ancho en lugar de aplastar las 7 columnas */}
        <div className="overflow-x-auto"><div className="min-w-[44rem]">
        {/* scrollbar-gutter: la cabecera reserva el mismo ancho que la barra de desplazamiento
            del cuerpo, así las líneas de las columnas quedan alineadas en cualquier navegador */}
        <div className={`${columnas} overflow-hidden border-y border-borde bg-white [scrollbar-gutter:stable]`}>
          <div />
          {dias.map((d) => (
            <div key={d} className={`border-l border-borde py-2 text-center ${d === hoy ? 'bg-primario-suave/60 text-primario' : 'text-texto-suave'}`}>
              <p className="text-[10px] font-medium uppercase">{diaCorto(d)}</p>
              <p className={`text-sm font-semibold ${d === hoy ? 'text-primario' : 'text-texto'}`}>{Number(d.slice(8))}</p>
            </div>
          ))}
        </div>
        <div className="max-h-[30rem] overflow-y-auto bg-white [scrollbar-gutter:stable]">
          <div className={columnas}>
            <div style={{ paddingTop: margen }}>
              {horas.map((h) => (
                <p key={h} style={{ height: altoHora }} className="-translate-y-1.5 pr-2 text-right text-[10px] text-texto-suave">
                  {String(h).padStart(2, '0')}:00
                </p>
              ))}
            </div>
            {dias.map((d) => (
              <div key={d} className={`relative border-l border-borde ${d === hoy ? 'bg-primario-suave/20' : ''}`} style={{ height: margen + horas.length * altoHora }}>
                {/* La línea inferior del margen es la de la primera hora */}
                <div style={{ height: margen }} className="border-b border-borde/60" />
                {horas.map((h) => {
                  const libre = !!onElegirHueco && d >= hoy;
                  return (
                    <div key={h} style={{ height: altoHora }} title={libre ? `Agregar franja a las ${String(h).padStart(2, '0')}:00` : undefined}
                      onClick={libre ? () => onElegirHueco!(d, h) : undefined}
                      className={`border-b border-borde/60 ${libre ? 'cursor-pointer hover:bg-primario-suave/40 hover:outline-1 hover:outline-dashed hover:outline-primario/50 hover:-outline-offset-2' : ''}`} />
                  );
                })}
                {franjas.filter((f) => f.fecha === d).map(bloque)}
              </div>
            ))}
          </div>
        </div>
        </div></div>
      </div>
    );
  } else if (cuadricula) {
    cuerpo = (
      <div>
        {navegacion}
        <div className="overflow-x-auto"><div className="min-w-[38rem]">
        <div className="grid grid-cols-[3.75rem_repeat(7,1fr)] gap-1.5 pr-2">
          <div />
          {dias.map((d) => <div key={d}>{cabeceraDia(d)}</div>)}
        </div>
        <div className="mt-2 max-h-[22rem] overflow-y-auto pr-1">
          <div className="grid grid-cols-[3.75rem_repeat(7,1fr)] gap-1.5">
            <div>
              {horas.map((h) => (
                <p key={h} style={{ height: altoHora }} className="pr-2 text-right text-[10px] leading-tight text-texto-suave">
                  {etiquetaHora(h).slice(0, 5)}<br />{etiquetaHora(h).slice(6)}
                </p>
              ))}
            </div>
            {dias.map((d) => (
              <div key={d} className="relative" style={{ height: horas.length * altoHora }}>
                {/* Celdas vacías ("Sin disponibilidad") */}
                {horas.map((h) => (
                  <div key={h} style={{ height: altoHora }} className="p-0.5">
                    <div className="size-full rounded-md bg-campo/50" />
                  </div>
                ))}
                {franjas.filter((f) => f.fecha === d).map(bloque)}
              </div>
            ))}
          </div>
        </div>
        </div></div>
      </div>
    );
  } else {
    cuerpo = (
      <div>
        {navegacion}
        <div className="overflow-x-auto"><div className="min-w-[40rem]">
        <div className="grid grid-cols-7 gap-2">
          {dias.map((d) => {
            const delDia = franjas.filter((f) => f.fecha === d).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
            return (
              <div key={d} className="flex min-h-56 flex-col gap-2">
                {cabeceraDia(d)}
                {delDia.length === 0 && <div className="flex-1 rounded-lg bg-fondo/70" />}
                {delDia.map((f) => {
                  const { ocupada, pasada, sel, propio, elegible, props } = infoFranja(f);
                  return (
                    <div key={f.id_horario} {...props}
                      className={`group rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors ${
                        sel ? 'bg-primario-oscuro text-white ring-2 ring-primario ring-offset-2'
                          : propio ? propio
                          : ocupada ? 'bg-slate-200 text-slate-500'
                          : pasada ? 'bg-primario/30 text-white'
                          : 'bg-primario text-white'
                      } ${elegible ? 'cursor-pointer hover:bg-primario-oscuro' : ''}`}>
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
        </div></div>
      </div>
    );
  }

  return (
    <div>
      {cuerpo}
      {leyenda && <LeyendaFranjas className="mt-4 justify-end" />}
    </div>
  );
}

export function LeyendaFranjas({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-4 text-xs text-texto-suave ${className}`}>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primario" /> Disponible</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-300" /> Ocupado</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-campo ring-1 ring-borde" /> Sin disponibilidad</span>
    </div>
  );
}
