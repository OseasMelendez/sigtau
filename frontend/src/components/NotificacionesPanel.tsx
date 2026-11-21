import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, FileBarChart, Info, UserPlus, X, XCircle } from 'lucide-react';
import { notificaciones } from '../services';
import { haceCuanto } from '../lib/fechas';
import type { Notificacion } from '../types';

/** Ícono y color del círculo por tipo de notificación (Figma 75:172 / 88:3254 / 162:2062) */
const ICONOS: Record<string, { icono: React.ReactNode; fondo: string }> = {
  Solicitud: { icono: <Info size={16} />, fondo: 'bg-primario-suave text-primario' },
  Tutoría: { icono: <CheckCircle2 size={16} />, fondo: 'bg-primario-suave text-primario' },
  Reprogramación: { icono: <CalendarClock size={16} />, fondo: 'bg-amber-100 text-amber-600' },
  Cancelación: { icono: <XCircle size={16} />, fondo: 'bg-peligro-suave text-peligro' },
  Recordatorio: { icono: <Bell size={16} />, fondo: 'bg-primario-suave text-primario' },
  Seguimiento: { icono: <CheckCircle2 size={16} />, fondo: 'bg-exito-suave text-exito' },
  Usuario: { icono: <UserPlus size={16} />, fondo: 'bg-primario-suave text-primario' },
  Reporte: { icono: <FileBarChart size={16} />, fondo: 'bg-primario-suave text-primario' },
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
            className="absolute top-2 right-2 bottom-2 flex w-96 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-borde bg-fondo-tutor shadow-2xl">
            <div className="flex items-center gap-2 border-b border-borde bg-campo/60 px-5 py-3.5">
              <Bell size={18} className="text-primario" />
              <h2 className="flex-1 text-lg font-medium">Notificaciones</h2>
              <button onClick={() => setAbierto(false)} className="rounded p-1 hover:bg-fondo" aria-label="Cerrar"><X size={18} /></button>
            </div>
            {noLeidas > 0 && (
              <button onClick={leerTodas} className="py-2.5 text-xs font-medium text-primario hover:underline">
                Marcar todas como leídas
              </button>
            )}
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
              {lista.length === 0 && <p className="py-10 text-center text-sm text-texto-suave">No tienes notificaciones.</p>}
              {lista.map((n) => (
                <button key={n.id_notificacion} onClick={() => leer(n)}
                  className={`flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-campo/60 ${n.leida ? '' : 'bg-white/70'}`}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${ICONOS[n.tipo]?.fondo ?? 'bg-primario-suave text-primario'}`}>
                    {ICONOS[n.tipo]?.icono ?? <Info size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] ${n.leida ? 'font-medium' : 'font-semibold'}`}>{n.titulo}</p>
                    <p className="mt-0.5 text-xs text-texto-suave">{n.mensaje}</p>
                    <p className="mt-1 text-[11px] text-texto-suave">{haceCuanto(n.fecha_envio)}</p>
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
