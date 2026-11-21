import {
  Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

interface Opcion { valor: string; texto: ReactNode; deshabilitada: boolean }

/** Lee los <option> hijos (también dentro de fragmentos y .map) */
function leerOpciones(hijos: ReactNode): Opcion[] {
  const lista: Opcion[] = [];
  Children.forEach(hijos, (h) => {
    if (!isValidElement(h)) return;
    const el = h as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === Fragment) return lista.push(...leerOpciones(el.props.children));
    if (el.type === 'option') {
      const texto = el.props.children;
      lista.push({ valor: String(el.props.value ?? texto ?? ''), texto, deshabilitada: !!el.props.disabled });
    }
  });
  return lista;
}

/**
 * Desplegable con el estilo del sistema (reemplaza al <select> nativo, cuya lista no se puede
 * estilizar). Se usa igual que un select: <Selector value onChange><option value="">…</option></Selector>.
 * La lista se dibuja en un portal para que no la recorten los modales.
 */
export function Selector({
  value, onChange, children, className = '', id, disabled, invalido, 'aria-label': ariaLabel, title,
}: {
  value: string | number;
  onChange?: (valor: string) => void;
  children: ReactNode;
  /** Clases del botón (las mismas que llevaba el select: claseInput, rellenos, tamaños…) */
  className?: string;
  id?: string;
  disabled?: boolean;
  invalido?: boolean;
  'aria-label'?: string;
  title?: string;
}) {
  const opciones = leerOpciones(children);
  const actual = opciones.find((o) => o.valor === String(value));
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = useId();

  // Posición de la lista junto al botón (debajo, o arriba si no cabe)
  const colocar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = Math.min(256, opciones.length * 38 + 8);
    const arriba = r.bottom + alto + 8 > window.innerHeight && r.top > alto + 8;
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, arriba });
  };
  useLayoutEffect(() => { if (abierto) colocar(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!boton.current?.contains(e.target as Node) && !lista.current?.contains(e.target as Node)) setAbierto(false);
    };
    const mover = (e: Event) => { if (!lista.current?.contains(e.target as Node)) colocar(); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('scroll', mover, true);
    window.addEventListener('resize', colocar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('scroll', mover, true);
      window.removeEventListener('resize', colocar);
    };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantener visible la opción activa al usar el teclado
  useEffect(() => {
    if (abierto) lista.current?.children[activa]?.scrollIntoView({ block: 'nearest' });
  }, [activa, abierto]);

  const abrir = () => {
    if (disabled) return;
    setActiva(Math.max(0, opciones.findIndex((o) => o.valor === String(value))));
    setAbierto(true);
  };
  const elegir = (o?: Opcion) => {
    if (!o || o.deshabilitada) return;
    setAbierto(false);
    boton.current?.focus();
    if (o.valor !== String(value)) onChange?.(o.valor);
  };
  const siguiente = (desde: number, paso: number) => {
    for (let i = desde + paso; i >= 0 && i < opciones.length; i += paso) if (!opciones[i].deshabilitada) return i;
    return desde;
  };

  const teclado = (e: React.KeyboardEvent) => {
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAbierto(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiva((a) => siguiente(a, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiva((a) => siguiente(a, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiva(siguiente(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActiva(siguiente(opciones.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(opciones[activa]); }
    else if (e.key === 'Tab') setAbierto(false);
  };

  // La opción vacía ("Todos…", "Selecciona…") se muestra en gris cuando está elegida
  const esMarcador = !actual || actual.valor === '';

  return (
    <>
      <button ref={boton} type="button" id={id} disabled={disabled} title={title}
        role="combobox" aria-haspopup="listbox" aria-expanded={abierto} aria-controls={idLista}
        aria-label={ariaLabel} aria-invalid={invalido || undefined}
        aria-activedescendant={abierto ? `${idLista}-${activa}` : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())} onKeyDown={teclado}
        className={`relative flex items-center text-left disabled:cursor-not-allowed ${className} !pr-9 ${abierto ? '!border-primario ring-2 ring-primario/20' : ''}`}>
        <span className={`block min-w-0 flex-1 truncate ${esMarcador ? 'text-texto-suave' : ''}`}>{actual?.texto ?? ''}</span>
        <ChevronDown size={16} className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && pos && createPortal(
        <ul ref={lista} id={idLista} role="listbox" aria-label={ariaLabel}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width, transform: pos.arriba ? 'translateY(-100%)' : undefined }}
          className="fixed z-[60] max-h-64 max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-borde bg-white p-1 text-sm shadow-xl shadow-primario/10">
          {opciones.map((o, i) => {
            const sel = o.valor === String(value);
            return (
              <li key={`${o.valor}-${i}`} id={`${idLista}-${i}`} role="option" aria-selected={sel} aria-disabled={o.deshabilitada || undefined}
                onMouseEnter={() => !o.deshabilitada && setActiva(i)}
                onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ${
                  o.deshabilitada ? 'cursor-default text-texto-suave/50'
                    : sel ? 'bg-primario-suave font-medium text-primario-oscuro'
                    : i === activa ? 'bg-fondo-tutor' : ''
                } ${o.valor === '' && !sel ? 'text-texto-suave' : ''}`}>
                <span className="min-w-0 flex-1 truncate">{o.texto}</span>
                {sel && <Check size={15} className="shrink-0 text-primario" />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
