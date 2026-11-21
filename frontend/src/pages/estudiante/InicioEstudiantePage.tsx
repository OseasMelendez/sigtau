import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Clock, FileText, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { notificaciones, solicitudes, tutorias } from '../../services';
import { useCarga } from '../../lib/hooks';
import { nombreTutor } from '../../lib/nombres';
import { hoyISO, horaActual, sumarDias } from '../../lib/fechas';
import { Alerta, Badge, Cargando, Tarjeta, Vacio } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import type { Tutoria } from '../../types';

/** 8.2.2 Vista de inicio del estudiante (Figma 1:5) */
export function InicioEstudiantePage() {
  const { usuario } = useAuth();
  const { datos, cargando, error } = useCarga(
    () => Promise.all([solicitudes.mias(), tutorias.mias(), notificaciones.mias()]),
    [],
  );

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;
  const [sols, tuts, notis] = datos;

  const hoy = hoyISO();
  const hora = horaActual();
  const proximas = tuts
    .filter((t) => t.estado === 'Programada' && (t.franja.fecha > hoy || (t.franja.fecha === hoy && t.franja.hora_fin > hora)))
    .sort((a, b) => (a.franja.fecha + a.franja.hora_inicio).localeCompare(b.franja.fecha + b.franja.hora_inicio));

  const textoProxima = (t?: Tutoria) => {
    if (!t) return 'Sin sesiones';
    if (t.franja.fecha === hoy) return 'Hoy';
    if (t.franja.fecha === sumarDias(hoy, 1)) return 'Mañana';
    return new Date(`${t.franja.fecha}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  };

  /** '2026-06-19' -> '19 de junio' (como en el Figma, sin año) */
  const diaYMes = (fecha: string) =>
    new Date(`${fecha}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', day: 'numeric', month: 'long' });

  return (
    <div className="relative max-w-3xl">
      {/* Manchas decorativas del fondo (Figma 1:5) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 top-16 left-0 -z-10 overflow-hidden md:left-56">
        <div className="absolute -top-10 left-[2%] size-[26rem] rounded-full bg-primario-suave/40 blur-2xl" />
        <div className="absolute top-[6%] right-[8%] size-[30rem] rounded-[45%] bg-primario-suave/45 blur-2xl" />
        <div className="absolute bottom-[-12%] left-[-4%] size-[34rem] rounded-full bg-primario-suave/35 blur-2xl" />
        <div className="absolute right-[18%] bottom-[2%] size-[22rem] rounded-[40%] bg-indigo-100/60 blur-2xl" />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">Bienvenido/a, {usuario?.nombre_completo}</h1>
      <p className="mt-1.5 mb-6 text-sm text-texto-suave">Aquí tienes un resumen de tu actividad académica.</p>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Estadistica Icono={FileText} etiqueta="Solicitudes" valor={sols.length} a="/estudiante/solicitudes" />
        <Estadistica Icono={CalendarDays} etiqueta="Próxima Sesión" valor={textoProxima(proximas[0])} pequeno />
        <Estadistica Icono={Bell} etiqueta="Notificaciones" valor={notis.filter((n) => !n.leida).length} />
      </div>

      {proximas.length === 0 ? (
        <Vacio texto="No tienes tutorías programadas.">
          <Link to="/estudiante/nueva-solicitud" className="font-semibold text-primario hover:underline">Solicitar una tutoría</Link>
        </Vacio>
      ) : (
        <div className="flex flex-col gap-5">
          {proximas.slice(0, 2).map((t, i) => (
            <Tarjeta key={t.id_tutoria} className="flex flex-wrap items-center gap-6 border-transparent !p-6 shadow-md shadow-primario/5">
              <div className="min-w-60 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-normal">{i === 0 ? 'Próxima Sesión' : 'Siguiente Sesión'}</h2>
                  <Badge estado={t.estado} />
                </div>
                <p className="mt-1 text-lg font-bold text-primario-oscuro">{t.asignatura.nombre}</p>
                <div className="mt-5 flex items-center gap-3">
                  <Iniciales id={t.tutor.id_usuario} nombre={t.tutor.nombre_completo} className="size-9 text-xs" />
                  <div>
                    <p className="text-sm font-medium">{nombreTutor(t.tutor)}</p>
                    <p className="text-xs text-texto-suave">Tutor Asignado</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 border-borde sm:border-l sm:pl-6">
                <p className="flex items-center gap-2 text-sm"><CalendarDays size={18} className="text-primario" /> {diaYMes(t.franja.fecha)}</p>
                <p className="flex items-center gap-2 text-sm"><Clock size={18} className="text-blue-600" /> {t.franja.hora_inicio} - {t.franja.hora_fin}</p>
                <Link to={`/estudiante/tutorias/${t.id_tutoria}`}
                  className="mt-2 rounded-full bg-primario-oscuro px-5 py-1.5 text-sm font-medium text-white hover:bg-primario">
                  Ver Detalles
                </Link>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}

function Estadistica({ Icono, etiqueta, valor, a, pequeno }: { Icono: LucideIcon; etiqueta: string; valor: string | number; a?: string; pequeno?: boolean }) {
  const contenido = (
    <Tarjeta className="relative h-full overflow-hidden border-transparent !p-4 shadow-md shadow-primario/5 transition-shadow hover:shadow-lg">
      {/* Ícono grande y tenue en la esquina, como en el Figma */}
      <Icono aria-hidden size={56} strokeWidth={1.5} className="absolute -right-2 -bottom-3 text-primario/10" />
      <p className="flex items-center gap-2 text-xs text-texto-suave"><Icono size={16} className="text-primario" /> {etiqueta}</p>
      <p className={`mt-1.5 ${pequeno ? 'text-xl font-semibold' : 'text-4xl font-bold'}`}>{valor}</p>
    </Tarjeta>
  );
  return a ? <Link to={a}>{contenido}</Link> : contenido;
}
