/**
 * Componentes base con el estilo del Figma. Úsalos en todas las pantallas para
 * mantener la consistencia visual.
 */
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Loader2, X } from 'lucide-react';

// ---------- Botón ----------
type Variante = 'primario' | 'secundario' | 'peligro' | 'peligro-borde' | 'exito' | 'fantasma';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-primario text-white hover:bg-primario-hover shadow-sm',
  secundario: 'border border-borde bg-white text-primario-oscuro hover:bg-fondo',
  peligro: 'bg-peligro text-white hover:bg-peligro/90',
  'peligro-borde': 'border border-peligro/60 bg-white text-peligro hover:bg-peligro-suave',
  exito: 'bg-exito text-white hover:bg-exito/90',
  fantasma: 'text-primario hover:bg-primario-suave/60',
};

export function Boton({
  variante = 'primario', cargando, className = '', children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {cargando && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

// ---------- Badge de estado ----------
const COLORES_ESTADO: Record<string, string> = {
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Aprobada: 'bg-exito-suave text-exito border-green-200',
  Rechazada: 'bg-peligro-suave text-peligro border-red-200',
  Programada: 'bg-primario-suave text-primario-oscuro border-violet-200',
  Realizada: 'bg-exito-suave text-exito border-green-200',
  Cancelada: 'bg-peligro-suave text-peligro border-red-200',
  'Reprogramación pendiente': 'bg-amber-50 text-amber-700 border-amber-200',
  Disponible: 'bg-primario-suave text-primario-oscuro border-violet-200',
  Ocupado: 'bg-slate-100 text-slate-600 border-slate-200',
  Activo: 'bg-exito-suave text-exito border-green-200',
  Inactivo: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function Badge({ estado, className = '' }: { estado: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${COLORES_ESTADO[estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'} ${className}`}>
      {estado}
    </span>
  );
}

// ---------- Tarjeta ----------
export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borde bg-superficie p-5 shadow-sm ${className}`}>{children}</div>;
}

// ---------- Encabezado de página ----------
export function Encabezado({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-1.5 text-texto-suave">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------- Estados de carga ----------
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-texto-suave">
      <Loader2 className="animate-spin" size={20} /> {texto}
    </div>
  );
}

export function Vacio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-borde bg-superficie py-14 text-center text-texto-suave">
      <Inbox size={32} className="text-primario/50" />
      <p>{texto}</p>
      {children}
    </div>
  );
}

export function Alerta({ tipo = 'error', children }: { tipo?: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-peligro-suave text-peligro',
    exito: 'bg-exito-suave text-exito',
    info: 'bg-primario-suave/60 text-primario-oscuro',
  }[tipo];
  const Icono = tipo === 'exito' ? CheckCircle2 : AlertCircle;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${estilos}`}>
      <Icono size={18} className="mt-px shrink-0" /> <div>{children}</div>
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  abierto, titulo, icono, onCerrar, children, pie, ancho = 'max-w-lg', claseCabecera = '',
}: {
  abierto: boolean; titulo: string; icono?: ReactNode; onCerrar: () => void;
  children: ReactNode; pie?: ReactNode; ancho?: string;
  /** Clases extra para la cabecera (p. ej. fondo lila y título morado del modal Aprobar) */
  claseCabecera?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onMouseDown={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${ancho}`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className={`flex items-center gap-2 border-b border-borde px-6 py-4 ${claseCabecera}`}>
          {icono}
          <h2 className="flex-1 text-xl font-semibold">{titulo}</h2>
          <button onClick={onCerrar} className="rounded p-1 text-texto-suave hover:bg-fondo" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {pie && <div className="flex justify-end gap-3 border-t border-borde bg-fondo/60 px-6 py-4">{pie}</div>}
      </div>
    </div>
  );
}

// ---------- Formularios ----------
export const claseInput =
  'w-full rounded-lg border border-borde bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primario focus:ring-2 focus:ring-primario/20 disabled:bg-slate-50 disabled:text-texto-suave aria-[invalid=true]:border-peligro';

export function Campo({
  etiqueta, error, ayuda, opcional, children, htmlFor, derecha,
}: {
  etiqueta: string; error?: string; ayuda?: string; opcional?: boolean;
  children: ReactNode; htmlFor?: string; derecha?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {etiqueta} {opcional && <span className="font-normal text-texto-suave">(Opcional)</span>}
        </label>
        {derecha && <span className="text-xs text-texto-suave">{derecha}</span>}
      </div>
      {children}
      {error ? <p className="mt-1 text-xs text-peligro">{error}</p> : ayuda && <p className="mt-1 text-xs text-texto-suave">{ayuda}</p>}
    </div>
  );
}

/** Texto etiquetado pequeño, como "MATERIA / Cálculo Integral" en las tarjetas. */
export function Dato({ icono, etiqueta, children }: { icono?: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      {icono && <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fondo text-texto-suave">{icono}</span>}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">{etiqueta}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}
