import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, FileBarChart, Info, UserPlus, X, XCircle } from 'lucide-react';
import { notificaciones } from '../services';
import { haceCuanto } from '../lib/fechas';
import type { Notificacion } from '../types';

const ICONOS: Record<string, React.ReactNode> = {
  Solicitud: <Info size={16} className="text-primario" />,
  Tutoría: <CheckCircle2 size={16} className="text-exito" />,
  Reprogramación: <CalendarClock size={16} className="text-amber-500" />,
  Cancelación: <XCircle size={16} className="text-peligro" />,
  Recordatorio: <Bell size={16} className="text-primario" />,
  Seguimiento: <CheckCircle2 size={16} className="text-primario" />,
  Usuario: <UserPlus size={16} className="text-primario" />,
  Reporte: <FileBarChart size={16} className="text-primario" />,
};

/** Campana + panel lateral de notificaciones (Figma 75:172, 88:3254, 162:2062). RF-10 */
export function NotificacionesPanel() {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<Notificacion[]>([]);

  const cargar = useCallback(() => {
    notificaciones.mias().then(setLista).catch(() => undefined);
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60_000); // revisa nuevas cada minuto
    return () => clearInterval(id);
  }, [cargar]);

  const noLeidas = lista.filter((n) => !n.leida).length;

  const leer = async (n: Notificacion) => {
    if (n.leida) return;
    setLista((l) => l.map((x) => (x.id_notificacion === n.id_notificacion ? { ...x, leida: true } : x)));
    await notificaciones.marcarLeida(n.id_notificacion).catch(cargar);
  };

  const leerTodas = async () => {
    setLista((l) => l.map((x) => ({ ...x, leida: true })));
    await notificaciones.marcarTodas().catch(cargar);
  };

  return (
    <>
      <button onClick={() => { setAbierto(true); cargar(); }} title="Notificaciones" aria-label={`Notificaciones (${noLeidas} sin leer)`}
        className="relative flex size-9 items-center justify-center rounded-full bg-fondo text-texto-suave hover:text-primario">
        <Bell size={18} />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primario px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)}>
          <aside onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 bottom-2 flex w-96 flex-col overflow-hidden rounded-2xl border border-borde bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-borde px-5 py-4">
              <Bell size={18} className="text-primario" />
              <h2 className="flex-1 text-lg font-semibold">Notificaciones</h2>
              <button onClick={() => setAbierto(false)} className="rounded p-1 hover:bg-fondo" aria-label="Cerrar"><X size={18} /></button>
            </div>
            {noLeidas > 0 && (
              <button onClick={leerTodas} className="border-b border-borde bg-fondo py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave/40">
                Marcar todas como leídas
              </button>
            )}
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
              {lista.length === 0 && <p className="py-10 text-center text-sm text-texto-suave">No tienes notificaciones.</p>}
              {lista.map((n) => (
                <button key={n.id_notificacion} onClick={() => leer(n)}
                  className={`flex gap-3 rounded-xl border p-3 text-left ${n.leida ? 'border-borde bg-white' : 'border-primario/25 bg-primario-suave/30'}`}>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-borde">
                    {ICONOS[n.tipo] ?? <Info size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.titulo}</p>
                    <p className="mt-0.5 text-sm text-texto-suave">{n.mensaje}</p>
                    <p className="mt-1 text-xs text-texto-suave">{haceCuanto(n.fecha_envio)}</p>
                  </div>
                  {!n.leida && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primario" />}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
